import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  getMetadata,
  waitForLCP,
  loadBlocks,
  loadCSS,
} from './lib-franklin.js';

const LCP_BLOCKS = []; // add your LCP blocks to the list
window.hlx.RUM_GENERATION = 'project-1'; // add your RUM generation information here
window.mack = window.mack || {};
window.mack.newsData = window.mack.newsData || {
  news: [],
  offset: 0,
  allLoaded: false,
};

export function findAndCreateImageLink(node) {
  const links = node.querySelectorAll('picture ~ a');

  [...links].forEach((link) => {
    let prevEl = link.previousElementSibling;

    if (prevEl.tagName.toLowerCase() === 'br') {
      prevEl = prevEl.previousElementSibling;
    }

    if (prevEl.tagName.toLowerCase() === 'picture') {
      link.innerHTML = '';
      link.appendChild(prevEl);
      link.setAttribute('target', '_blank');
      link.classList.add('image-link');
    }
  });
}

/**
 * Create an element with the given id and classes.
 * @param {string} tagName the tag
 * @param {string[]|string} classes the class or classes to add
 * @param {object} props any other attributes to add to the element
 * @returns the element
 */
export function createElement(tagName, classes, props) {
  const elem = document.createElement(tagName);
  if (classes) {
    const classesArr = (typeof classes === 'string') ? [classes] : classes;
    elem.classList.add(...classesArr);
  }
  if (props) {
    Object.keys(props).forEach((propName) => {
      elem.setAttribute(propName, props[propName]);
    });
  }

  return elem;
}

function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * loads more data from the query index
 * */
async function loadMoreNews() {
  if (!window.mack.newsData.allLoaded) {
    const queryLimit = 200;
    const resp = await fetch(`/mack-news.json?limit=${queryLimit}&offset=${window.mack.newsData.offset}`);
    const json = await resp.json();
    const { total, data } = json;
    window.mack.newsData.news.push(...data);
    window.mack.newsData.allLoaded = total <= (window.mack.newsData.offset + queryLimit);
    window.mack.newsData.offset += queryLimit;
  }
}

/**
 * @param {boolean} more indicates to force loading additional data from query index
 * @returns the currently loaded listed of posts from the query index pages
 */
export async function loadNews(more) {
  if (window.mack.newsData.news.length === 0 || more) {
    await loadMoreNews();
  }
  return window.mack.newsData.news;
}

/**
 * A function for sorting an array of posts by date
 */
function sortNewsByDate(newsA, newsB) {
  const aDate = Number(newsA.date || newsA.lastModified);
  const bDate = Number(newsB.date || newsB.lastModified);
  return bDate - aDate;
}

/**
 * Get the list of news from the query index. News are auto-filtered based on page context
 * e.g tags, etc. and sorted by date
 *
 * @param {string} filter the name of the filter to apply
 * one of: topic, subtopic, author, tag, post, auto, none
 * @param {number} limit the number of posts to return, or -1 for no limit
 * @returns the posts as an array
 */
export async function getNews(filter, limit) {
  const pages = await loadNews();
  // filter out anything that isn't a mack news (eg. must have an author)
  let finalNews;
  const allNews = pages.filter((page) => page.template === 'mack-news');
  const template = getMetadata('template');
  let applicableFilter = filter ? filter.toLowerCase() : 'none';
  if (applicableFilter === 'auto') {
    if (template === 'mack-news') {
      applicableFilter = 'mack-news';
    } else {
      applicableFilter = 'none';
    }
  }

  if (applicableFilter === 'mack-news') {
    finalNews = allNews
      .sort(sortNewsByDate);
  }
  return limit < 0 ? finalNews : finalNews.slice(0, limit);
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

async function loadTemplate(doc, templateName) {
  try {
    const cssLoaded = new Promise((resolve) => {
      loadCSS(`${window.hlx.codeBasePath}/templates/${templateName}/${templateName}.css`, resolve);
    });
    const decorationComplete = new Promise((resolve) => {
      (async () => {
        try {
          const mod = await import(`../templates/${templateName}/${templateName}.js`);
          if (mod.default) {
            await mod.default(doc);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log(`failed to load module for ${templateName}`, error);
        }
        resolve();
      })();
    });
    await Promise.all([cssLoaded, decorationComplete]);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`failed to load block ${templateName}`, error);
  }
}

/**
 * loads everything needed to get to LCP.
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    await waitForLCP(LCP_BLOCKS);
  }
}

/**
 * Adds the favicon.
 * @param {string} href The favicon URL
 */
export function addFavIcon(href) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = href;
  const existingLink = document.querySelector('head link[rel="icon"]');
  if (existingLink) {
    existingLink.parentElement.replaceChild(link, existingLink);
  } else {
    document.getElementsByTagName('head')[0].appendChild(link);
  }
}

/**
 * loads everything that doesn't need to be delayed.
 */
async function loadLazy(doc) {
  const templateName = getMetadata('template');
  if (templateName) {
    await loadTemplate(doc, templateName);
  }

  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  addFavIcon(`${window.hlx.codeBasePath}/styles/favicon.svg`);
  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/**
 * loads everything that happens a lot later, without impacting
 * the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
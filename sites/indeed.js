const { isRecent, isOlderThan } = require('../helpers/postedDate');
const { withFreshContext } = require('../helpers/freshContext');

const PER_PAGE  = 10; // Indeed's `start` offset increments by 10
const MAX_PAGES = 10; // safety cap; fromage + date boundary normally stop us first
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Scrape every job card currently in the DOM. Indeed changes its markup often,
// so we try several selector strategies.
function scrapeCards(page) {
  return page.evaluate(() => {
    const selectors = [
      '.job_seen_beacon',
      '[data-testid="slider_item"]',
      '.resultContent',
      '.jobsearch-ResultsList > li',
      '#mosaic-jobResults .result',
      '.mosaic-provider-jobcards > li',
      'table.jobCard_mainContent',
      '[data-jk]',
    ];

    let cards = [];
    for (const sel of selectors) {
      cards = [...document.querySelectorAll(sel)];
      if (cards.length > 0) break;
    }

    return cards.map(card => {
      const titleEl = card.querySelector(
        '[data-testid="jobTitle"] span, h2 a span, h2.jobTitle span, a[data-jk] span, .jobTitle a span'
      );
      const linkEl = card.querySelector(
        'a[data-testid="job-title-link"], h2 a, a[data-jk], .jobTitle a, a[id^="job_"]'
      );
      const href = linkEl?.getAttribute('href') || '';

      return {
        title: titleEl?.innerText?.trim() || linkEl?.innerText?.trim() || '',
        company: card.querySelector(
          '[data-testid="company-name"], .companyName, [data-company-name], .company_location .companyName'
        )?.innerText?.trim() || '',
        location: card.querySelector(
          '[data-testid="text-location"], .companyLocation, [data-testid="job-location"]'
        )?.innerText?.trim() || '',
        url: href.startsWith('http') ? href : (href ? 'https://uk.indeed.com' + href : ''),
        posted: card.querySelector(
          '[data-testid="myJobsStateDate"], .date, span.visually-hidden'
        )?.innerText?.trim() || '',
        board: 'Indeed',
      };
    });
  });
}

module.exports = {
  name: 'Indeed',
  async search(parentContext, term, location, maxDays = 7) {
    const browser = parentContext.browser();
    if (!browser) {
      console.warn('    ⚠️  Indeed: no browser handle available — skipping');
      return [];
    }

    const all = [];

    for (let p = 0; p < MAX_PAGES; p++) {
      // sort=date => newest first; fromage limits server-side to last N days.
      const url = `https://uk.indeed.com/jobs?q=${encodeURIComponent(term)}`
        + `&l=${encodeURIComponent(location)}&sort=date&fromage=${maxDays}&start=${p * PER_PAGE}`;

      let jobs;
      try {
        // Fresh context per page — Indeed blocks subsequent navigations within a
        // session, so each page request must look like a first visit.
        jobs = await withFreshContext(browser, async (page) => {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Wait for either job cards or a "no results" / blocked indicator
          await page.waitForSelector(
            '[data-testid="slider_item"], .job_seen_beacon, .jobsearch-ResultsList, .mosaic-provider-jobcards, #mosaic-jobResults',
            { timeout: 15000 }
          ).catch(() => {});

          // Extra wait for JS-rendered content
          await page.waitForTimeout(2000);

          return scrapeCards(page);
        });
      } catch (err) {
        console.warn(`    ⚠️  Indeed: error on page ${p + 1} — "${term}": ${err.message}`);
        break;
      }

      if (jobs.length === 0) break; // no more results (or blocked)

      all.push(...jobs.filter(j => j.title && j.url).filter(j => isRecent(j.posted, maxDays)));

      // Newest-first: a datably-old card means the rest are older too.
      if (jobs.some(j => isOlderThan(j.posted, maxDays))) break;

      await sleep(2000 + Math.floor(Math.random() * 1500)); // polite + lower block risk
    }

    return all;
  }
};

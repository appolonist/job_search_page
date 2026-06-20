const { isRecent, isOlderThan } = require('../helpers/postedDate');

const PER_PAGE  = 10; // Indeed's `start` offset increments by 10
const MAX_PAGES = 10; // safety cap; fromage + date boundary normally stop us first
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  name: 'Indeed',
  async search(context, term, location, maxDays = 7) {
    const page = await context.newPage();
    const all = [];

    try {
      for (let p = 0; p < MAX_PAGES; p++) {
        // sort=date => newest first; fromage limits server-side to last N days.
        const url = `https://uk.indeed.com/jobs?q=${encodeURIComponent(term)}`
          + `&l=${encodeURIComponent(location)}&sort=date&fromage=${maxDays}&start=${p * PER_PAGE}`;

        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (err) {
          console.warn(`    ⚠️  Indeed: error on page ${p + 1} — "${term}": ${err.message}`);
          break;
        }

        // Wait for either job cards or a "no results" / blocked indicator
        await page.waitForSelector(
          '[data-testid="slider_item"], .job_seen_beacon, .jobsearch-ResultsList, .mosaic-provider-jobcards, #mosaic-jobResults',
          { timeout: 15000 }
        ).catch(() => {});

        // Extra wait for JS-rendered content
        await page.waitForTimeout(2000);

        const jobs = await page.evaluate(() => {
          // Try multiple selector strategies — Indeed changes these frequently
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

        if (jobs.length === 0) break; // no more results (or blocked)

        all.push(...jobs.filter(j => j.title && j.url).filter(j => isRecent(j.posted, maxDays)));

        // Newest-first: a datably-old card means the rest are older too.
        if (jobs.some(j => isOlderThan(j.posted, maxDays))) break;

        await sleep(2000 + Math.floor(Math.random() * 1500)); // polite + lower block risk
      }
    } finally {
      await page.close();
    }

    return all;
  }
};

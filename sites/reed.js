const { isRecent, isOlderThan } = require('../helpers/postedDate');

const MAX_PAGES = 15; // safety cap; the date boundary normally stops us sooner
const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
  name: 'Reed',
  async search(context, term, location, maxDays = 7) {
    const page = await context.newPage();
    const query = encodeURIComponent(term).replace(/%20/g, '-');
    const loc   = encodeURIComponent(location).replace(/%20/g, '-');
    // sortby=DisplayDate => newest first, so we can stop once we cross the window.
    const base  = `https://www.reed.co.uk/jobs/${query}-jobs-in-${loc}`;

    const all = [];
    try {
      for (let p = 1; p <= MAX_PAGES; p++) {
        const url = `${base}?sortby=DisplayDate&pageno=${p}`;
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (err) {
          console.warn(`    ⚠️  Reed: error on page ${p} — "${term}": ${err.message}`);
          break;
        }

        await page.waitForSelector('article[data-qa="job-card"]', { timeout: 8000 }).catch(() => {});

        const jobs = await page.$$eval('article[data-qa="job-card"]', cards =>
          cards.map(card => ({
            title: card.querySelector('[data-qa="job-card-title"]')?.innerText?.trim() || '',
            company: card.querySelector('[data-qa="job-card-recruiter"]')?.innerText?.trim() || '',
            location: card.querySelector('[data-qa="job-card-location"]')?.innerText?.trim() || '',
            url: 'https://www.reed.co.uk' + (card.querySelector('a')?.getAttribute('href') || ''),
            posted: card.querySelector('[data-qa="job-card-date"]')?.innerText?.trim() || '',
            board: 'Reed',
          }))
        );

        if (jobs.length === 0) break; // no more results

        all.push(...jobs.filter(j => isRecent(j.posted, maxDays)));

        // Newest-first: a datably-old card means the rest are older too.
        if (jobs.some(j => isOlderThan(j.posted, maxDays))) break;

        await sleep(1500 + Math.floor(Math.random() * 1000)); // polite between pages
      }
    } finally {
      await page.close();
    }

    return all.filter(j => j.title && j.url);
  }
};

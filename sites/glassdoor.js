const { isRecent, isOlderThan } = require('../helpers/postedDate');
const { withFreshContext } = require('../helpers/freshContext');

const MAX_CLICKS = 15; // how many "Show more jobs" clicks to attempt at most
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Scrape every job card currently in the DOM. Glassdoor uses stable data-test
// hooks (job-link / emp-location / job-age); company sits in a hashed CSS-module
// class, matched by its stable substring.
function scrapeCards(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-test="jobListing"], .JobsList_jobListItem')];
    // Use textContent, not innerText: in headless Chrome innerText is often empty
    // because layout isn't computed, which silently drops every card.
    const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();

    return cards.map(card => {
      const link = card.querySelector('a[data-test="job-link"], a[href*="/job-listing/"]');
      const href = link?.getAttribute('href') || '';

      return {
        title: text(link),
        company: text(card.querySelector(
          '[class*="EmployerProfile_compactEmployerName"], [data-test="employer-short-name"], [class*="employerName"]'
        )),
        location: text(card.querySelector('[data-test="emp-location"]')),
        url: href.startsWith('http') ? href : (href ? 'https://www.glassdoor.co.uk' + href : ''),
        posted: text(card.querySelector('[data-test="job-age"]')),
        board: 'Glassdoor',
      };
    });
  });
}

module.exports = {
  name: 'Glassdoor',
  async search(parentContext, term, location, maxDays = 7) {
    const browser = parentContext.browser();
    if (!browser) {
      console.warn('    ⚠️  Glassdoor: no browser handle available — skipping');
      return [];
    }

    // Fresh context per term (Glassdoor paginates with an in-page "Show more"
    // button, so one context for the whole term — but a new one each term).
    return withFreshContext(browser, async (page) => {
      // Use the search-based URL instead of the fragile SRCH_IL format
      const url = `https://www.glassdoor.co.uk/Job/united-kingdom-${encodeURIComponent(term).replace(/%20/g, '-').toLowerCase()}-jobs-SRCH_IL.0,14_IN2_KO15,${15 + term.length}.htm?sortBy=date_desc`;

      let navigated = false;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        navigated = true;
      } catch {
        // Fallback: use Glassdoor's search page directly
        try {
          await page.goto(
            `https://www.glassdoor.co.uk/Job/jobs.htm?sc.keyword=${encodeURIComponent(term)}&locT=N&locId=2&locKeyword=United+Kingdom&sortBy=date_desc`,
            { waitUntil: 'domcontentloaded', timeout: 30000 }
          );
          navigated = true;
        } catch { /* both failed */ }
      }

      if (!navigated) return [];

      // Cards render client-side a few seconds after load. Poll (no reload — a
      // reload re-triggers the Cloudflare challenge) until they appear.
      let jobs = [];
      for (let attempt = 0; attempt < 4 && !jobs.length; attempt++) {
        await page.waitForTimeout(attempt === 0 ? 3500 : 2000);
        jobs = await scrapeCards(page);
      }
      if (!jobs.length) return [];

      // Glassdoor paginates with a "Show more jobs" button (sorted newest-first).
      // Click it until the loaded cards cross the date window, the button is gone,
      // or we hit the click cap. A sign-up modal can appear mid-scroll — dismiss it.
      for (let click = 0; click < MAX_CLICKS; click++) {
        if (jobs.some(j => isOlderThan(j.posted, maxDays))) break; // crossed the window

        // Best-effort: close any interstitial sign-up modal that blocks the button.
        await page.locator('[data-test="job-alert-modal-close"], button[aria-label="Close"], .modal_closeIcon')
          .first().click({ timeout: 1500 }).catch(() => {});

        const loadMore = page.locator('[data-test="load-more"], button[data-test="pagination-next"]').first();
        if (!(await loadMore.count())) break; // no more pages

        const before = jobs.length;
        await loadMore.scrollIntoViewIfNeeded().catch(() => {});
        await loadMore.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(2500);

        // Scrape into a temp: a click can pop a modal / Cloudflare challenge that
        // empties the DOM, and we must not let that clobber the cards we already
        // have. Only accept the re-scrape if it actually grew the list.
        const updated = await scrapeCards(page);
        if (updated.length <= before) break; // nothing new (or page broke) — keep prior
        jobs = updated;
      }

      return jobs
        .filter(j => j.title && j.url)
        .filter(j => isRecent(j.posted, maxDays));
    });
  }
};

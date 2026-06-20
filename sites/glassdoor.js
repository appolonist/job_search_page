const { isRecent, isOlderThan } = require('../helpers/postedDate');

const MAX_CLICKS = 15; // how many "Show more jobs" clicks to attempt at most
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Scrape every job card currently in the DOM.
function scrapeCards(page) {
  return page.evaluate(() => {
    const selectors = [
      '[data-test="jobListing"]',
      '.JobsList_jobListItem',
      'li[data-test]',
      '.jobCard',
      '[class*="JobCard"]',
      '[class*="jobListing"]',
      '.react-job-listing',
    ];

    let cards = [];
    for (const sel of selectors) {
      cards = [...document.querySelectorAll(sel)];
      if (cards.length > 0) break;
    }

    return cards.map(card => {
      const titleEl = card.querySelector(
        '[data-test="job-title"], a[class*="jobTitle"], a[class*="JobCard_jobTitle"], [class*="job-title"] a'
      );
      const href = titleEl?.getAttribute('href') || card.querySelector('a')?.getAttribute('href') || '';

      return {
        title: titleEl?.innerText?.trim() || '',
        company: card.querySelector(
          '[data-test="employer-name"], [class*="EmployerProfile"], [class*="employer"], [class*="companyName"]'
        )?.innerText?.trim() || '',
        location: card.querySelector(
          '[data-test="emp-location"], [class*="location"], [class*="Location"]'
        )?.innerText?.trim() || '',
        url: href.startsWith('http') ? href : (href ? 'https://www.glassdoor.co.uk' + href : ''),
        posted: card.querySelector(
          '[data-test="listed-date"], [class*="listingAge"], [class*="posted"]'
        )?.innerText?.trim() || '',
        board: 'Glassdoor',
      };
    });
  });
}

module.exports = {
  name: 'Glassdoor',
  async search(context, term, location, maxDays = 7) {
    const page = await context.newPage();

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

    if (!navigated) {
      await page.close();
      return [];
    }

    // Wait for job listings to appear
    await page.waitForSelector(
      '[data-test="jobListing"], .JobsList_jobListItem, li[data-test], .jobCard, [class*="JobCard"], [class*="jobListing"]',
      { timeout: 15000 }
    ).catch(() => {});
    await page.waitForTimeout(2000);

    // Glassdoor paginates with a "Show more jobs" button (sorted newest-first).
    // Click it until the loaded cards cross the date window, the button is gone,
    // or we hit the click cap. A sign-up modal can appear mid-scroll — dismiss it.
    let jobs = await scrapeCards(page);
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

      jobs = await scrapeCards(page);
      if (jobs.length <= before) break; // nothing new loaded — stop
    }

    await page.close();

    return jobs
      .filter(j => j.title && j.url)
      .filter(j => isRecent(j.posted, maxDays));
  }
};

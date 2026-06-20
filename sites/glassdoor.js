module.exports = {
  name: 'Glassdoor',
  async search(context, term, location) {
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

    const jobs = await page.evaluate(() => {
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

    await page.close();
    return jobs.filter(j => j.title);
  }
};

module.exports = {
  name: 'Indeed',
  async search(context, term, location) {
    const page = await context.newPage();
    const url = `https://uk.indeed.com/jobs?q=${encodeURIComponent(term)}&l=${encodeURIComponent(location)}&sort=date`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

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

    await page.close();
    return jobs.filter(j => j.title && j.url);
  }
};

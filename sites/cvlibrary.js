module.exports = {
  name: 'CV-Library',
  async search(context, term, location) {
    const page = await context.newPage();

    // CV-Library is a Next.js SPA — navigate to homepage first, then use form
    await page.goto('https://www.cv-library.co.uk', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Accept cookies
    await page.click('#onetrust-accept-btn-handler').catch(() => {});
    await page.waitForTimeout(500);

    // Fill search form using React-compatible interaction
    const keywordInput = page.locator('input[name="keyword"]').first();
    await keywordInput.click();
    await keywordInput.fill('');
    await keywordInput.pressSequentially(term, { delay: 40 });
    await page.waitForTimeout(800);

    // Wait for and catch navigation/API response
    const [searchResponse] = await Promise.all([
      page.waitForResponse(
        resp => resp.url().includes('/api/job-search/jobs') && resp.url().includes('keyword'),
        { timeout: 10000 }
      ).catch(() => null),
      page.locator('button[type="submit"]:has-text("Find Jobs")').first().click(),
    ]);

    // If the internal API responds successfully, parse results from it
    if (searchResponse && searchResponse.status() === 200) {
      try {
        const data = await searchResponse.json();
        const items = data.jobs || data.results || (Array.isArray(data) ? data : []);
        return items.map(j => ({
          title: j.title || j.job_title || '',
          company: j.company || j.agency || '',
          location: j.location || j.geo || '',
          url: j.url ? (j.url.startsWith('http') ? j.url : 'https://www.cv-library.co.uk' + j.url) : '',
          posted: j.posted || j.date || '',
          board: 'CV-Library',
        })).filter(j => j.title && j.url);
      } catch { /* fall through to DOM scraping */ }
    }

    // Fallback: wait for DOM to render results
    await page.waitForTimeout(3000);

    const jobs = await page.evaluate(() => {
      const selectors = [
        'article.job',
        '.job-card',
        '[data-job-id]',
        '[data-testid*="job"]',
        'li[class*="job"]',
        'div[class*="JobCard"]',
        'a[class*="job"]',
      ];

      let cards = [];
      for (const sel of selectors) {
        cards = [...document.querySelectorAll(sel)];
        if (cards.length > 0) break;
      }

      return cards.map(card => {
        const titleEl = card.querySelector('a[class*="title"], h2 a, h3 a') || card;
        const href = (card.tagName === 'A' ? card : card.querySelector('a'))?.getAttribute('href') || '';
        return {
          title: titleEl?.innerText?.trim() || '',
          company: card.querySelector('[class*="company"]')?.innerText?.trim() || '',
          location: card.querySelector('[class*="location"]')?.innerText?.trim() || '',
          url: href.startsWith('http') ? href : (href ? 'https://www.cv-library.co.uk' + href : ''),
          posted: card.querySelector('time, [class*="posted"], [class*="date"]')?.innerText?.trim() || '',
          board: 'CV-Library',
        };
      });
    });

    await page.close();

    if (jobs.length === 0) {
      console.warn(`    ⚠️  CV-Library: likely blocked by anti-bot protection`);
    }

    return jobs.filter(j => j.title && j.url);
  }
};

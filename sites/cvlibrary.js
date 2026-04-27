module.exports = {
  name: 'CV-Library',
  async search(context, term, location) {
    const page = await context.newPage();
    const url = `https://www.cv-library.co.uk/search-jobs?q=${encodeURIComponent(term)}&geo=${encodeURIComponent(location)}&us=1&distance=50&order=d`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Accept cookie banner
    await page.click('#cookie-consent-button, [id*="accept"], [class*="cookie"] button')
      .catch(() => {});
    await page.waitForTimeout(1000);

    const jobs = await page.evaluate(() => {
      // Both regular and featured job cards
      const cards = [...document.querySelectorAll('article.job.search-card, li.results__item article.job')];

      return cards.map(card => {
        const titleEl = card.querySelector('a.job__title, h2 a, h3 a');
        const href = titleEl?.getAttribute('href') || '';

        return {
          title: titleEl?.innerText?.trim() || '',
          company: card.querySelector('.job__company, [class*="company"]')?.innerText?.trim() || '',
          location: card.querySelector('.job__location, [class*="location"]')?.innerText?.trim() || '',
          url: href.startsWith('http') ? href : 'https://www.cv-library.co.uk' + href,
          posted: card.querySelector('.job__posted-row time, time, [class*="posted"]')?.innerText?.trim() || '',
          board: 'CV-Library',
        };
      });
    });

    await page.close();
    return jobs.filter(j => j.title && j.url);
  }
};
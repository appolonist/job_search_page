module.exports = {
  name: 'Reed',
  async search(context, term, location) {
    const page = await context.newPage();
    const query = encodeURIComponent(term);
    const loc = encodeURIComponent(location);
    await page.goto(`https://www.reed.co.uk/jobs/${query.replace(/%20/g, '-')}-jobs-in-${loc.replace(/%20/g, '-')}`, { waitUntil: 'domcontentloaded' });

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

    await page.close();
    return jobs;
  }
};
module.exports = {
  name: 'Glassdoor',
  async search(context, term, location) {
    const page = await context.newPage();
    await page.goto(`https://www.glassdoor.co.uk/Job/uk-${encodeURIComponent(term).replace(/%20/g,'-')}-jobs-SRCH_IL.0,2_IN2_KO3,${3+term.length}.htm`, { waitUntil: 'domcontentloaded' });

    const jobs = await page.$$eval('[data-test="jobListing"]', cards =>
      cards.map(card => ({
        title: card.querySelector('[data-test="job-title"]')?.innerText?.trim() || '',
        company: card.querySelector('[data-test="employer-name"]')?.innerText?.trim() || '',
        location: card.querySelector('[data-test="emp-location"]')?.innerText?.trim() || '',
        url: card.querySelector('a[data-test="job-title"]')?.href || '',
        posted: card.querySelector('[data-test="listed-date"]')?.innerText?.trim() || '',
        board: 'Glassdoor',
      }))
    );

    await page.close();
    return jobs.filter(j => j.title);
  }
};

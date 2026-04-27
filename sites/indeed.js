module.exports = {
  name: 'Indeed',
  async search(context, term, location) {
    const page = await context.newPage();
    const url = `https://uk.indeed.com/jobs?q=${encodeURIComponent(term)}&l=${encodeURIComponent(location)}&sort=date`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('[data-testid="slider_item"], .job_seen_beacon', { timeout: 10000 }).catch(() => {});

    const jobs = await page.$$eval('.job_seen_beacon, [data-testid="slider_item"]', cards =>
      cards.map(card => ({
        title: card.querySelector('[data-testid="jobTitle"] span, h2 a span')?.innerText?.trim() || '',
        company: card.querySelector('[data-testid="company-name"]')?.innerText?.trim() || '',
        location: card.querySelector('[data-testid="text-location"]')?.innerText?.trim() || '',
        url: 'https://uk.indeed.com' + (card.querySelector('a[data-testid="job-title-link"], h2 a')?.getAttribute('href') || ''),
        posted: card.querySelector('[data-testid="myJobsStateDate"]')?.innerText?.trim() || '',
        board: 'Indeed',
      }))
    );

    await page.close();
    return jobs.filter(j => j.title);
  }
};
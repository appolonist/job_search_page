// debug.js
const { chromium } = require('playwright');

async function debug(site, url, waitFor) {
  const browser = await chromium.launch({ headless: false }); // headed so you can see
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  console.log(`\n=== ${site} ===`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  if (waitFor) {
    await page.waitForSelector(waitFor, { timeout: 10000 }).catch(() => console.log('Selector not found:', waitFor));
  }

  await page.waitForTimeout(3000); // let JS render

  // Dump all likely job card candidates
  const candidates = await page.evaluate(() => {
    const tags = ['article', 'li', 'div'];
    const results = [];
    for (const tag of tags) {
      document.querySelectorAll(tag).forEach(el => {
        const cls = el.className;
        if (typeof cls === 'string' && (cls.includes('job') || cls.includes('result') || cls.includes('listing'))) {
          results.push({ tag, class: cls.substring(0, 80) });
        }
      });
    }
    return [...new Map(results.map(r => [r.class, r])).values()].slice(0, 20);
  });

  console.log('Candidate elements:');
  candidates.forEach(c => console.log(` <${c.tag} class="${c.class}">`));

  const deeper = await page.evaluate(() => {
  const container = document.querySelector('.results-container');
  if (!container) return ['No .results-container found'];
  const children = [...container.querySelectorAll('*')];
  const hits = [];
  for (const el of children) {
    const cls = el.className;
    if (typeof cls === 'string' && cls.length > 0) {
      hits.push(`<${el.tagName.toLowerCase()} class="${cls.substring(0, 80)}">`);
    }
  }
  // Deduplicate and return first 25
  return [...new Set(hits)].slice(0, 25);
});
console.log('\nDeeper inside .results-container:');
deeper.forEach(d => console.log(' ', d));

  await page.waitForTimeout(5000); // stay open so you can inspect
  await browser.close();
}

async function run() {
  await debug(
    'TotalJobs',
    'https://www.totaljobs.com/jobs/qa-engineer/in-united-kingdom',
    null
  );
  await debug(
    'CV-Library',
    'https://www.cv-library.co.uk/search-jobs?q=QA+Engineer&geo=United+Kingdom&us=1',
    null
  );
}

run().catch(console.error);
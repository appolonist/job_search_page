// Standalone verification for the rewritten CV-Library scraper.
// Builds the same browser context production uses, waits out any rate-limit
// cooldown, then runs a few real searches and prints what comes back.
const { chromium } = require('playwright');
const cvlib = require('../sites/cvlibrary');

const COOLDOWN_MS = Number(process.env.COOLDOWN_MS ?? 0);
const TERMS = [
  'Software QA Engineer', 'Software QA Automation Engineer', 'Testing Lead',
  'Test Lead', 'QA Engineer', 'QA Automation Engineer', 'Test Automation Engineer',
  'SDET', 'Software Engineer in Test', 'Test Engineer', 'QA Lead',
];

(async () => {
  if (COOLDOWN_MS > 0) {
    console.log(`Cooling down ${COOLDOWN_MS / 1000}s to clear any rate-limit flag...`);
    await new Promise(r => setTimeout(r, COOLDOWN_MS));
  }

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = window.chrome || { runtime: {} };
  });

  for (const term of TERMS) {
    const t0 = Date.now();
    const jobs = await cvlib.search(context, term, 'United Kingdom');
    console.log(`\n=== "${term}" → ${jobs.length} results (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    jobs.slice(0, 3).forEach(j =>
      console.log(`   • ${j.title} | ${j.company} | ${j.location} | ${j.posted} | ${j.url}`));
  }

  await browser.close();
  console.log('\nDone.');
})();

// helpers/debugger.js
// Run with: node helpers/debugger.js
// Opens headed browser to visually inspect what each site returns.
// Saves screenshots + candidate selectors to output/debug/

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '..', 'output', 'debug');

async function debug(site, url, context) {
  const page = await context.newPage();
  console.log(`\n=== ${site} ===`);
  console.log(`URL: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    console.log(`Navigation failed: ${err.message}`);
    await page.close();
    return;
  }

  await page.waitForTimeout(4000);

  // Save screenshot
  const slug = site.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const screenshotPath = path.join(DEBUG_DIR, `${slug}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot: ${screenshotPath}`);

  // Log page title
  const title = await page.title();
  console.log(`Page title: "${title}"`);

  // Check for common block/CAPTCHA indicators
  const blockIndicators = await page.evaluate(() => {
    const body = document.body?.innerText?.substring(0, 2000) || '';
    const indicators = [];
    const checks = ['captcha', 'robot', 'verify', 'blocked', 'access denied', 'unusual traffic', 'security check', 'challenge'];
    for (const c of checks) {
      if (body.toLowerCase().includes(c)) indicators.push(c);
    }
    return { indicators, bodyPreview: body.substring(0, 500) };
  });

  if (blockIndicators.indicators.length > 0) {
    console.log(`⚠️  BLOCK DETECTED — keywords found: ${blockIndicators.indicators.join(', ')}`);
    console.log(`Page text preview:\n${blockIndicators.bodyPreview}`);
  }

  // Dump candidate elements that look like job cards
  const candidates = await page.evaluate(() => {
    const tags = ['article', 'li', 'div', 'a'];
    const results = [];
    for (const tag of tags) {
      document.querySelectorAll(tag).forEach(el => {
        const cls = el.className;
        const dataAttrs = [...el.attributes]
          .filter(a => a.name.startsWith('data-'))
          .map(a => `${a.name}="${a.value}"`)
          .join(' ');
        if (typeof cls === 'string' && (cls.includes('job') || cls.includes('result') || cls.includes('listing') || cls.includes('card'))) {
          results.push({ tag, class: cls.substring(0, 100), data: dataAttrs.substring(0, 100) });
        }
      });
    }
    return [...new Map(results.map(r => [r.class + r.data, r])).values()].slice(0, 30);
  });

  console.log(`Candidate job-card elements (${candidates.length}):`);
  candidates.forEach(c => {
    const dataStr = c.data ? ` ${c.data}` : '';
    console.log(`  <${c.tag} class="${c.class}"${dataStr}>`);
  });

  // Save HTML for offline inspection
  const html = await page.content();
  const htmlPath = path.join(DEBUG_DIR, `${slug}.html`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`HTML saved: ${htmlPath}`);

  await page.close();
}

async function run() {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false,
    channel: 'chrome', // real Chrome — bundled Chromium is fingerprinted & blocked by CV-Library
    args: ['--disable-blink-features=AutomationControlled'],
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
  });

  await debug('Indeed',
    'https://uk.indeed.com/jobs?q=QA+Engineer&l=United+Kingdom&sort=date',
    context);

  // NOTE: /search-jobs?q=... now returns 403; the working entry point is the
  // SEO path URL /<Keyword>-jobs (see sites/cvlibrary.js).
  await debug('CV-Library',
    'https://www.cv-library.co.uk/QA-Engineer-jobs?order=d',
    context);

  await debug('Glassdoor',
    'https://www.glassdoor.co.uk/Job/united-kingdom-qa-engineer-jobs-SRCH_IL.0,14_IN2_KO15,26.htm?sortBy=date_desc',
    context);

  await browser.close();
  console.log(`\n✅ Debug complete — check ${DEBUG_DIR} for screenshots and HTML`);
}

run().catch(console.error);

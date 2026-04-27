const { chromium } = require('playwright');

const URL = `https://www.totaljobs.com/jobs/qa-engineer/in-united-kingdom?sort=2`;

async function debugTotalJobs() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`\n=== TotalJobs Deep Debugger v2 ===`);
  console.log(`URL: ${URL}\n`);

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // --- Step 1: Accept cookie banner ---
  console.log('Step 1: Attempting to accept cookie banner...');
  await page.waitForTimeout(2000);
  const cookieAccepted = await page.click(
    '#onetrust-accept-btn-handler, [class*="accept-cookies"], button[id*="accept"], [class*="cookie"] button[class*="accept"]'
  ).then(() => true).catch(() => false);
  console.log(cookieAccepted ? '  ✅ Cookie banner accepted' : '  ⚠️  No cookie banner found');
  await page.waitForTimeout(3000); // wait for page to settle after cookie dismiss

  // --- Step 2: Dump ALL unique class names on the page ---
  console.log('\nStep 2: ALL unique class names found anywhere on the page:');
  const allClasses = await page.evaluate(() => {
    const classes = new Set();
    document.querySelectorAll('*').forEach(el => {
      if (typeof el.className === 'string') {
        el.className.trim().split(/\s+/).forEach(c => {
          if (c.length > 0) classes.add(c);
        });
      }
    });
    return [...classes].sort();
  });
  // Filter to ones likely related to jobs/results/listings
  const relevant = allClasses.filter(c =>
    /job|result|listing|card|item|vacancy|post|search|role/i.test(c)
  );
  console.log('  Relevant classes:', relevant);
  console.log('\n  ALL classes (full list):');
  allClasses.forEach(c => console.log('   .' + c));

  // --- Step 3: Dump ALL data-* attributes on the page ---
  console.log('\nStep 3: Elements with data-* attributes (first 30):');
  const dataAttrs = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('*').forEach(el => {
      const attrs = [...el.attributes].filter(a => a.name.startsWith('data-'));
      if (attrs.length > 0) {
        results.push({
          tag: el.tagName.toLowerCase(),
          class: (typeof el.className === 'string' ? el.className : '').substring(0, 60),
          attrs: attrs.map(a => `${a.name}="${a.value.substring(0, 40)}"`).join(' ')
        });
      }
    });
    return [...new Map(results.map(r => [r.attrs, r])).values()].slice(0, 30);
  });
  dataAttrs.forEach(el => console.log(`  <${el.tag} class="${el.class}" ${el.attrs}>`));

  // --- Step 4: Find any anchor tags that look like job links ---
  console.log('\nStep 4: Anchor tags containing "/job" in href (first 10):');
  const jobLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')]
      .filter(a => (a.getAttribute('href') || '').includes('/job'))
      .slice(0, 10)
      .map(a => ({
        text: a.innerText.trim().substring(0, 80),
        href: a.getAttribute('href'),
        parentTag: a.parentElement?.tagName?.toLowerCase(),
        parentClass: (typeof a.parentElement?.className === 'string'
          ? a.parentElement.className : '').substring(0, 80),
        grandParentClass: (typeof a.parentElement?.parentElement?.className === 'string'
          ? a.parentElement.parentElement.className : '').substring(0, 80),
      }));
  });
  if (jobLinks.length === 0) {
    console.log('  ❌ No job links found at all — page may be blocked or JS not rendered');
  } else {
    jobLinks.forEach((l, i) => {
      console.log(`\n  [${i + 1}]`);
      console.log(`    TEXT:         "${l.text}"`);
      console.log(`    HREF:         ${l.href}`);
      console.log(`    PARENT:       <${l.parentTag} class="${l.parentClass}">`);
      console.log(`    GRANDPARENT:  <class="${l.grandParentClass}">`);
    });
  }

  // --- Step 5: Page body text snapshot ---
  console.log('\nStep 5: Page body text (first 800 chars):');
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log(bodyText);

  // --- Step 6: Screenshot ---
  await page.screenshot({ path: 'totaljobs-debug.png', fullPage: false });
  console.log('\n📸 Screenshot saved → totaljobs-debug.png');

  console.log('\n✅ Debug complete — closing in 10 seconds...');
  await page.waitForTimeout(10000);
  await browser.close();
}

debugTotalJobs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
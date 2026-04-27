// helpers/debugger-totaljobs-network.js
// Watches ALL network requests TotalJobs makes and logs any JSON responses
// that look like job data — this tells us exactly which API to call.

const { chromium } = require('playwright');

const URL = 'https://www.totaljobs.com/jobs/qa-engineer/in-united-kingdom?sort=2';

async function debugNetwork() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  console.log('\n=== TotalJobs Network Interceptor ===');
  console.log('Watching ALL requests...\n');

  const jsonResponses = [];

  // Intercept every response
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    const contentType = response.headers()['content-type'] || '';

    // Log all requests
    console.log(`  [${status}] ${url.substring(0, 120)}`);

    // Capture JSON responses that might contain job data
    if (contentType.includes('application/json') && status === 200) {
      try {
        const body = await response.json();
        const bodyStr = JSON.stringify(body);

        // Check if it looks like job data
        if (
          bodyStr.includes('jobTitle') ||
          bodyStr.includes('job_title') ||
          bodyStr.includes('"title"') ||
          bodyStr.includes('"jobs"') ||
          bodyStr.includes('"results"') ||
          bodyStr.includes('employer') ||
          bodyStr.includes('salary')
        ) {
          jsonResponses.push({ url, body });
          console.log(`\n  ⭐ POTENTIAL JOB DATA FOUND at: ${url}`);
          console.log(`     Keys: ${Object.keys(body).join(', ')}`);
          console.log(`     Preview: ${bodyStr.substring(0, 300)}\n`);
        }
      } catch (_) {}
    }
  });

  // Accept cookies via request interception if needed
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 40000 });

  // Try accepting cookie banner
  await page.click(
    '#onetrust-accept-btn-handler, .ccmgt_accept_button, [class*="accept"] button, .primary-button'
  ).then(() => {
    console.log('\n  ✅ Cookie banner accepted — waiting for re-render...');
  }).catch(() => {
    console.log('\n  ⚠️  No cookie banner clicked');
  });

  await page.waitForTimeout(5000);

  // --- Summary ---
  console.log('\n\n=== SUMMARY ===');
  if (jsonResponses.length === 0) {
    console.log('❌ No JSON responses containing job data were detected.');
    console.log('   TotalJobs may be serving a fully server-side rendered page,');
    console.log('   or blocking API calls for automated browsers.');
    console.log('\n   Recommendation: Use their Reed/Indeed equivalent or check');
    console.log('   if there is an Accept header needed for JSON responses.');
  } else {
    console.log(`✅ Found ${jsonResponses.length} JSON response(s) with job data:\n`);
    jsonResponses.forEach((r, i) => {
      console.log(`[${i + 1}] URL: ${r.url}`);
      console.log(`    Keys: ${Object.keys(r.body).join(', ')}`);
      console.log(`    Sample: ${JSON.stringify(r.body).substring(0, 500)}\n`);
    });
  }

  await page.screenshot({ path: 'totaljobs-network-debug.png' });
  console.log('\n📸 Screenshot saved → totaljobs-network-debug.png');

  console.log('\nClosing in 10 seconds...');
  await page.waitForTimeout(10000);
  await browser.close();
}

debugNetwork().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
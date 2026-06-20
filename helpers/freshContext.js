// Shared browser-context helpers for the anti-bot-protected boards.
//
// Several job boards (CV-Library, Indeed, Glassdoor) clear the *first* page view
// of a browser session and then block every subsequent navigation in that
// session. Opening a brand-new context per request makes each request look like
// a first visit, which is what gets through. We also strip the most obvious
// headless-automation fingerprints.

const CONTEXT_OPTS = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-GB',
  timezoneId: 'Europe/London',
  extraHTTPHeaders: { 'Accept-Language': 'en-GB,en;q=0.9' },
};

const applyStealth = context => context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en'] });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  window.chrome = window.chrome || { runtime: {} };
});

// Run `fn(page)` in a throwaway context (a fresh "first visit" each call) and
// always tear it down afterwards. Returns whatever `fn` returns.
async function withFreshContext(browser, fn) {
  const context = await browser.newContext(CONTEXT_OPTS);
  await applyStealth(context);
  const page = await context.newPage();
  try {
    return await fn(page);
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = { CONTEXT_OPTS, applyStealth, withFreshContext };

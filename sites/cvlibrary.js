const sleep = ms => new Promise(r => setTimeout(r, ms));

// CV-Library is a Next.js app fronted by an anti-bot layer. Two things matter:
//
//  1. Entry point: the query endpoint (/search-jobs?q=...) now returns HTTP 403
//     ("Blocked") and there is no public JSON API. The SEO landing pages
//     (/<Keyword>-jobs) are still server-rendered with the job cards in the
//     initial HTML, so we navigate there and parse the cards directly.
//
//  2. Session handling: the anti-bot clears the *first* page view of a browser
//     session, then blocks every subsequent navigation in that session with a
//     403. So we open a FRESH browser context per search term — each request is
//     treated as a first visit and succeeds. (Real Google Chrome is also
//     required; the bundled Chromium fingerprint is blocked outright — see
//     launchBrowser() in scraper.js.)
//
// Cards carry stable, build-independent hooks (data-qa / itemprop) — unlike the
// hashed CSS-module class names (JobCard_title__d61kV) which change every deploy.
const BASE = 'https://www.cv-library.co.uk';

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

// Turn a search term / location into a URL path segment: "QA Engineer" -> "QA-Engineer"
const slugify = s => (s || '')
  .trim()
  .replace(/[^\w\s-]/g, '')   // drop punctuation the path can't carry
  .replace(/\s+/g, '-');

// Locations meaning "the whole UK" — for these we search nationally (no -in-<loc>).
const NATIONWIDE = /^(united kingdom|uk|u\.k\.|great britain|britain|england|gb)$/i;

// One request in its own throwaway context. Returns { status, jobs }.
// jobs === null signals a block (caller may retry with another fresh context).
async function fetchCards(browser, url) {
  const context = await browser.newContext(CONTEXT_OPTS);
  await applyStealth(context);
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const status = resp?.status() ?? 0;
    if (status === 403 || /blocked/i.test(await page.title().catch(() => ''))) {
      return { status, jobs: null };
    }

    // Cards are in the server-rendered HTML; give hydration a brief moment.
    await page.waitForSelector('[itemprop="itemListElement"]', { timeout: 8000 }).catch(() => {});

    const jobs = await page.$$eval('[itemprop="itemListElement"]', cards =>
      cards.map(card => {
        const link = card.querySelector('a[data-qa="job-title-link"]');
        const href = link?.getAttribute('href') || '';
        const time = card.querySelector('time');
        return {
          title:    (link?.textContent || '').replace(/\s+/g, ' ').trim(),
          company:  (card.querySelector('[data-qa="company-name-link"]')?.textContent || '').trim(),
          location: (card.querySelector('[data-qa^="job-card-location"]')?.textContent || '').trim(),
          url:      href ? (href.startsWith('http') ? href : 'https://www.cv-library.co.uk' + href).split('?')[0] : '',
          posted:   (time?.getAttribute('datetime') || '').split('T')[0] || (time?.textContent || '').trim(),
          board:    'CV-Library',
        };
      })
    );
    return { status, jobs };
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = {
  name: 'CV-Library',

  async search(parentContext, term, location) {
    const browser = parentContext.browser();
    if (!browser) {
      console.warn('    ⚠️  CV-Library: no browser handle available — skipping');
      return [];
    }

    let path = `${slugify(term)}-jobs`;
    if (location && !NATIONWIDE.test(location.trim())) {
      path += `-in-${slugify(location)}`;
    }
    const url = `${BASE}/${path}?order=d`; // order=d => newest first

    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        let result;
        try {
          result = await fetchCards(browser, url);
        } catch (err) {
          if (attempt === 3) throw err;
          await sleep(4000 * attempt);
          continue;
        }

        if (result.jobs === null) { // blocked — a fresh context next try usually clears it
          if (attempt < 3) { await sleep(5000 * attempt); continue; }
          console.warn(`    ⚠️  CV-Library: blocked by anti-bot (HTTP ${result.status}) — "${term}"`);
          return [];
        }

        return result.jobs.filter(j => j.title && j.url);
      }
      return [];
    } finally {
      // Be polite between terms so we don't trip the rate limiter.
      await sleep(3000 + Math.floor(Math.random() * 2000));
    }
  },
};

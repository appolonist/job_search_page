const https = require('https');
const { isRecent } = require('../helpers/postedDate');

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

const PER_PAGE  = 50;  // Adzuna's maximum results_per_page
const MAX_PAGES = 20;  // safety cap (1000 jobs/term) — max_days_old normally stops us first

module.exports = {
  name: 'Adzuna (TotalJobs+)',

  async search(context, term, location, maxDays = 7) {
    if (!APP_ID || !APP_KEY) {
      console.error('  ❌ [Adzuna] Missing ADZUNA_APP_ID or ADZUNA_APP_KEY env vars.');
      console.error('     Sign up free at https://developer.adzuna.com');
      return [];
    }

    const all = [];
    let totalCount = Infinity; // learned from the first response

    for (let page = 1; page <= MAX_PAGES; page++) {
      // NOTE: 'content-type' must use a hyphen (not underscore)
      // NOTE: 'where' must be a city/region name — omit it to search all of UK
      // max_days_old makes the API return only jobs posted within the window.
      const params = new URLSearchParams({
        app_id:           APP_ID,
        app_key:          APP_KEY,
        results_per_page: PER_PAGE,
        what:             term,
        sort_by:          'date',
        max_days_old:     maxDays,
        'content-type':   'application/json',
      });

      // Correct endpoint: api.adzuna.com (not www), /gb/ for Great Britain
      const url = `https://api.adzuna.com/v1/api/jobs/gb/search/${page}?${params}`;

      let data;
      try {
        data = await fetchJSON(url);
      } catch (err) {
        console.error(`  ❌ [Adzuna] Request failed for "${term}" (page ${page}): ${err.message}`);
        break;
      }

      if (data?.exception) {
        console.error(`  ❌ [Adzuna] API exception for "${term}": ${data.display || data.exception}`);
        break;
      }

      if (typeof data?.count === 'number') totalCount = data.count;

      const results = data?.results || [];
      if (results.length === 0) break; // no more pages

      for (const j of results) {
        all.push({
          title:    j.title || '',
          company:  j.company?.display_name || '',
          location: j.location?.display_name || '',
          url:      j.redirect_url || '',
          posted:   j.created ? j.created.split('T')[0] : '',
          board:    'Adzuna (TotalJobs+)',
        });
      }

      // Stop once we've pulled everything the API reports, or hit a short page.
      if (page * PER_PAGE >= totalCount) break;
      if (results.length < PER_PAGE) break;

      await sleep(400); // be polite between API pages
    }

    const jobs = all
      .filter(j => j.title && j.url)
      .filter(j => isRecent(j.posted, maxDays));

    console.log(`  ✅ [Adzuna] "${term}" → ${jobs.length} jobs (last ${maxDays}d, ${Number.isFinite(totalCount) ? totalCount : '?'} total reported)`);
    return jobs;
  },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Simple promise-based HTTPS GET — no extra dependencies needed
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.substring(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON parse failed: ' + raw.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

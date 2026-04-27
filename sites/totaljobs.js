const https = require('https');
 
const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;
 
module.exports = {
  name: 'Adzuna (TotalJobs+)',
 
  async search(context, term, location) {
    if (!APP_ID || !APP_KEY) {
      console.error('  ❌ [Adzuna] Missing ADZUNA_APP_ID or ADZUNA_APP_KEY env vars.');
      console.error('     Sign up free at https://developer.adzuna.com');
      return [];
    }
 
    // NOTE: 'content-type' must use a hyphen (not underscore)
    // NOTE: 'where' must be a city/region name — omit it to search all of UK
    const params = new URLSearchParams({
      app_id:           APP_ID,
      app_key:          APP_KEY,
      results_per_page: 50,
      what:             term,
      sort_by:          'date',
      'content-type':   'application/json',
    });
 
    // Correct endpoint: api.adzuna.com (not www), /gb/ for Great Britain
    const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?${params}`;
 
    try {
      const data = await fetchJSON(url);
 
      if (data?.exception) {
        console.error(`  ❌ [Adzuna] API exception for "${term}": ${data.display || data.exception}`);
        return [];
      }
 
      const jobs = data?.results || [];
      console.log(`  ✅ [Adzuna] "${term}" → ${jobs.length} jobs`);
 
      return jobs.map(j => ({
        title:    j.title || '',
        company:  j.company?.display_name || '',
        location: j.location?.display_name || '',
        url:      j.redirect_url || '',
        posted:   j.created ? j.created.split('T')[0] : '',
        board:    'Adzuna (TotalJobs+)',
      })).filter(j => j.title && j.url);
 
    } catch (err) {
      console.error(`  ❌ [Adzuna] Request failed for "${term}": ${err.message}`);
      return [];
    }
  }
};
 
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
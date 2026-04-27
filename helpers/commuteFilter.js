// helpers/commuteFilter.js
//
// Rules:
//   🌐 Fully remote  → always include, no commute check needed
//   🔀 Hybrid        → commute check required (still need to reach the office)
//   🏢 Office-based  → commute check required
//
// Commute passes if EITHER:
//   - Drive time <= 1 hour (TomTom API, next weekday 8am departure)
//   - Estimated transit time <= 2 hours (drive × multiplier, marked ~est)
//     Multiplier: 1.8× for <80km straight line, 1.4× for longer (trains competitive)

const https = require('https');

const API_KEY = process.env.TOMTOM_API_KEY;
const HOME_PC = (process.env.HOME_POSTCODE || 'LL139AY').trim();

const MAX_DRIVE_SECS   = 2 * 60 * 60;      // 1 hour by car
const MAX_TRANSIT_SECS = 4 * 60 * 60;  // 2 hours by public transport

const geocodeCache = new Map();

// Keywords that mean the role is AT LEAST partly remote
const HYBRID_KEYWORDS  = ['hybrid', 'work from home', 'wfh', 'home working', 'home-based', 'flexible working', 'home based'];
// Keywords that mean the role is FULLY remote (no office trips expected)
const REMOTE_KEYWORDS  = ['fully remote', 'fully-remote', '100% remote', 'remote only', 'remote first', 'remote-first'];

// ─── Public API ───────────────────────────────────────────────────────────────

async function filterByCommute(jobs) {
  if (!API_KEY) {
    console.warn('\n  ⚠️  [Commute Filter] TOMTOM_API_KEY not set — skipping commute filter.');
    console.warn('     Get a free key at https://developer.tomtom.com\n');
    return jobs.map(j => ({ ...j, commuteNote: '⚠️ No API key' }));
  }

  let homeCoords;
  try {
    homeCoords = await geocode(HOME_PC);
    console.log(`\n  🏠 Home: ${HOME_PC} → ${homeCoords.lat.toFixed(4)}, ${homeCoords.lng.toFixed(4)}`);
  } catch (err) {
    console.error(`  ❌ [Commute Filter] Cannot geocode "${HOME_PC}": ${err.message}`);
    return jobs.map(j => ({ ...j, commuteNote: '⚠️ Home geocode failed' }));
  }

  // Classify each job
  const fullyRemote    = [];  // bypass commute check entirely
  const needsChecking  = [];  // hybrid + office-based — must pass commute

  for (const job of jobs) {
    if (isFullyRemote(job)) {
      fullyRemote.push({ ...job, commuteNote: '🌐 Remote' });
    } else {
      // Hybrid and office-based both need commute validation
      needsChecking.push(job);
    }
  }

  console.log(`  📋 ${jobs.length} jobs: ${fullyRemote.length} fully remote (auto-pass) | ${needsChecking.length} need commute check`);

  const passing = [];
  let checked = 0;

  for (const job of needsChecking) {
    checked++;
    const isHybrid = isHybridRole(job);
    const result   = await checkCommute(job, homeCoords, isHybrid);

    if (result.passes) {
      passing.push({ ...job, commuteNote: result.note });
    } else {
      console.log(`    ✂️  [${checked}/${needsChecking.length}] EXCLUDED: "${job.title}" @ "${job.location}" — ${result.note}`);
    }

    await sleep(250);
  }

  const total = fullyRemote.length + passing.length;
  console.log(`\n  ✅ ${passing.length}/${needsChecking.length} hybrid+office jobs within commute range`);
  console.log(`  📊 Final: ${total} jobs (${fullyRemote.length} remote + ${passing.length} hybrid/office)\n`);

  return [...fullyRemote, ...passing];
}

// ─── Commute check ────────────────────────────────────────────────────────────

async function checkCommute(job, homeCoords, isHybrid) {
  const locationStr = extractLocation(job.location);
  const typeLabel   = isHybrid ? '🔀 Hybrid' : '🏢 Office';

  if (!locationStr) {
    return { passes: true, note: `${typeLabel} | 📍 Location not provided` };
  }

  let jobCoords;
  try {
    jobCoords = await geocode(locationStr);
  } catch (err) {
    console.log(`    ⚠️  Cannot geocode "${locationStr}": ${err.message}`);
    // Genuinely can't verify — include with warning rather than wrongly exclude
    return { passes: true, note: `${typeLabel} | 📍 Location unverified (${locationStr})` };
  }

  // Driving time from TomTom
  let driveSecs;
  try {
    driveSecs = await getDriveTime(homeCoords, jobCoords);
  } catch (err) {
    console.log(`    ⚠️  Drive time failed for "${locationStr}": ${err.message}`);
    return { passes: true, note: `${typeLabel} | 📍 Commute API error` };
  }

  // Transit estimate (TomTom publicTransport unreliable for rural UK/Wales)
  const distKm      = haversineKm(homeCoords, jobCoords);
  const multiplier  = distKm > 80 ? 1.4 : 1.8;  // trains faster than drive ratio at long distance
  const transitSecs = Math.round(driveSecs * multiplier);

  const driveOk   = driveSecs   <= MAX_DRIVE_SECS;
  const transitOk = transitSecs <= MAX_TRANSIT_SECS;
  const passes    = driveOk || transitOk;

  const driveStr   = `🚗 ${formatMins(driveSecs)}${driveOk ? '' : ' ❌'}`;
  const transitStr = `🚌 ~${formatMins(transitSecs)}${transitOk ? '' : ' ❌'}`;

  return { passes, note: `${typeLabel} | ${driveStr} | ${transitStr}` };
}

// ─── Classification helpers ───────────────────────────────────────────────────

function isFullyRemote(job) {
  const text = [job.title, job.location].filter(Boolean).join(' ').toLowerCase();
  // Must match a "fully remote" keyword AND not also say "hybrid"
  const hasRemote = REMOTE_KEYWORDS.some(kw => text.includes(kw));
  // Also treat plain "remote" in the location field (not title) as fully remote
  const locationIsRemote = (job.location || '').toLowerCase().trim() === 'remote'
    || (job.location || '').toLowerCase().includes('remote, ');
  const hasHybrid = HYBRID_KEYWORDS.some(kw => text.includes(kw));
  return (hasRemote || locationIsRemote) && !hasHybrid;
}

function isHybridRole(job) {
  const text = [job.title, job.location].filter(Boolean).join(' ').toLowerCase();
  return HYBRID_KEYWORDS.some(kw => text.includes(kw));
}

// ─── Location extraction ──────────────────────────────────────────────────────

function extractLocation(raw) {
  if (!raw) return null;

  const str = raw.trim();

  // These are not geocodable locations
  const skip = ['remote', 'united kingdom', 'uk', 'nationwide', 'home based', 'work from home', 'wfh', ''];
  if (skip.includes(str.toLowerCase())) return null;

  const cleaned = str
    .replace(/,?\s*(United Kingdom|UK|England|Scotland|Wales|Northern Ireland)$/i, '')
    .replace(/,?\s*[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}$/i, '') // strip trailing postcodes
    .trim();

  if (!cleaned) return null;

  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}, UK`;
  }
  return `${parts[0]}, UK`;
}

// ─── TomTom routing ───────────────────────────────────────────────────────────

async function getDriveTime(origin, dest) {
  const departAt = nextWeekdayMorning();
  const url = `https://api.tomtom.com/routing/1/calculateRoute/`
    + `${origin.lat},${origin.lng}:${dest.lat},${dest.lng}/json`
    + `?key=${API_KEY}`
    + `&travelMode=car`
    + `&routeType=fastest`
    + `&traffic=true`
    + `&departAt=${encodeURIComponent(departAt)}`;

  const data = await fetchJSON(url);
  const secs = data?.routes?.[0]?.summary?.travelTimeInSeconds;
  if (secs == null) throw new Error('No travelTimeInSeconds in response');
  return secs;
}

async function geocode(query) {
  const key = query.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json`
    + `?key=${API_KEY}&countrySet=GB&limit=1`;

  const data  = await fetchJSON(url);
  const result = data?.results?.[0];
  if (!result) throw new Error(`No geocode result for "${query}"`);

  const coords = { lat: result.position.lat, lng: result.position.lon };
  geocodeCache.set(key, coords);
  return coords;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function haversineKm(a, b) {
  const R    = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h    = Math.sin(dLat / 2) ** 2
             + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
function toRad(d) { return d * Math.PI / 180; }

function nextWeekdayMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T08:00:00`;
}

function formatMins(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}min` : `${h}h`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${raw.substring(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('JSON parse failed: ' + raw.substring(0, 100))); }
      });
    }).on('error', reject);
  });
}

module.exports = { filterByCommute };
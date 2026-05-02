// helpers/commuteFilter.js
//
// Filtruje oferty pracy według czasu dojazdu z HOME_POSTCODE.
//
// CACHE: Wyniki TomTom API są zapisywane w cache/commute-cache.json
// Klucz cache = URL oferty (unikalny identyfikator każdej oferty)
// Przy kolejnych uruchomieniach scrapera oferty już sprawdzone nie generują
// żadnych requestów do API — wartości są pobierane z pliku na dysku.
//
// Format wpisu w cache:
// {
//   "https://reed.co.uk/jobs/123": {
//     "locationStr": "Manchester, Greater Manchester, UK",
//     "driveSecs": 3847,
//     "transitSecs": 6924,
//     "cachedAt": "2025-04-27T08:00:00.000Z"
//   }
// }
//
// Reguły filtrowania:
//   🌐 Fully remote  → zawsze przechodzi, bez sprawdzania
//   🔀 Hybrid        → wymaga sprawdzenia dojazdu (trzeba dojeżdżać do biura)
//   🏢 Office-based  → wymaga sprawdzenia dojazdu
//
// Oferta przechodzi jeśli KTÓRYKOLWIEK warunek jest spełniony:
//   - Czas jazdy samochodem <= MAX_DRIVE_SECS  (domyślnie 1h)
//   - Szacowany czas komunikacją <= MAX_TRANSIT_SECS (domyślnie 2h)

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const API_KEY = process.env.TOMTOM_API_KEY;
const HOME_PC = (process.env.HOME_POSTCODE || 'LL139AY').trim();

const MAX_DRIVE_SECS   = 2 * 60 * 60;      // 1 godzina samochodem
const MAX_TRANSIT_SECS = 4 * 60 * 60;  // 2 godziny komunikacją

// Plik cache — tworzony automatycznie przy pierwszym uruchomieniu
const CACHE_DIR  = path.join(__dirname, '..', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'commute-cache.json');

const geocodeCache = new Map(); // geocode cache (tylko w pamięci, resetowany przy każdym uruchomieniu)

// Słowa kluczowe
const HYBRID_KEYWORDS = ['hybrid', 'work from home', 'wfh', 'home working', 'home-based', 'flexible working', 'home based'];
const REMOTE_KEYWORDS = ['fully remote', 'fully-remote', '100% remote', 'remote only', 'remote first', 'remote-first'];

// ─── Cache na dysku ───────────────────────────────────────────────────────────

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`  ⚠️  [Cache] Nie można wczytać cache: ${err.message} — zaczynam od nowa`);
    return {};
  }
}

function saveCache(cache) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.warn(`  ⚠️  [Cache] Nie można zapisać cache: ${err.message}`);
  }
}

// ─── Główna funkcja ───────────────────────────────────────────────────────────

async function filterByCommute(jobs) {
  if (!API_KEY) {
    console.warn('\n  ⚠️  [Commute Filter] Brak TOMTOM_API_KEY — pomijam filtrowanie.');
    console.warn('     Zarejestruj się na https://developer.tomtom.com\n');
    return jobs.map(j => ({ ...j, commuteNote: '⚠️ Brak klucza API' }));
  }

  // Wczytaj cache z dysku
  const cache = loadCache();
  const cacheKeys = Object.keys(cache);
  console.log(`\n  💾 [Cache] Wczytano ${cacheKeys.length} zapisanych wyników dojazdu`);

  // Geocode domu (tylko raz)
  let homeCoords;
  try {
    homeCoords = await geocode(HOME_PC);
    console.log(`  🏠 Dom: ${HOME_PC} → ${homeCoords.lat.toFixed(4)}, ${homeCoords.lng.toFixed(4)}`);
  } catch (err) {
    console.error(`  ❌ [Commute Filter] Nie można geocodować "${HOME_PC}": ${err.message}`);
    return jobs.map(j => ({ ...j, commuteNote: '⚠️ Błąd geocodowania domu' }));
  }

  // Podziel oferty na kategorie
  const fullyRemote   = [];
  const needsChecking = [];

  for (const job of jobs) {
    if (isFullyRemote(job)) {
      fullyRemote.push({ ...job, commuteNote: '🌐 Remote' });
    } else {
      needsChecking.push(job);
    }
  }

  // Zlicz ile z nich jest już w cache
  const cachedCount  = needsChecking.filter(j => j.url && cache[j.url]).length;
  const freshCount   = needsChecking.length - cachedCount;

  console.log(`  📋 ${jobs.length} ofert: ${fullyRemote.length} w pełni remote (auto-pass) | ${needsChecking.length} do sprawdzenia`);
  console.log(`  💾 Z cache: ${cachedCount} | Nowe zapytania API: ${freshCount}`);

  const passing = [];
  let apiCallsMade = 0;
  let cacheHits    = 0;

  for (const job of needsChecking) {
    const isHybrid = isHybridRole(job);
    const result   = await checkCommute(job, homeCoords, isHybrid, cache);

    if (result.fromCache) cacheHits++;
    else                  apiCallsMade++;

    if (result.passes) {
      passing.push({ ...job, commuteNote: result.note });
    } else {
      console.log(`    ✂️  WYKLUCZONA: "${job.title}" @ "${job.location}" — ${result.note}`);
    }

    // Małe opóźnienie tylko dla nowych requestów API
    if (!result.fromCache) await sleep(250);
  }

  // Zapisz zaktualizowany cache na dysk
  saveCache(cache);

  const total = fullyRemote.length + passing.length;
  console.log(`\n  📊 Statystyki API: ${apiCallsMade} nowych requestów | ${cacheHits} z cache | zaoszczędzono ${cacheHits} requestów`);
  console.log(`  ✅ ${passing.length}/${needsChecking.length} ofert biurowych/hybrid w zasięgu dojazdu`);
  console.log(`  📊 Wynik końcowy: ${total} ofert (${fullyRemote.length} remote + ${passing.length} biurowych/hybrid)\n`);

  return [...fullyRemote, ...passing];
}

// ─── Sprawdzanie dojazdu (z cache) ───────────────────────────────────────────

async function checkCommute(job, homeCoords, isHybrid, cache) {
  const locationStr = extractLocation(job.location);
  const typeLabel   = isHybrid ? '🔀 Hybrid' : '🏢 Office';

  if (!locationStr) {
    return { passes: true, fromCache: false, note: `${typeLabel} | 📍 Brak lokalizacji` };
  }

  // ── Sprawdź cache ──────────────────────────────────────────────────────────
  const cacheKey = job.url; // URL jest unikalnym identyfikatorem oferty

  if (cacheKey && cache[cacheKey]) {
    const cached = cache[cacheKey];

    // Walidacja: czy lokalizacja się nie zmieniła (na wszelki wypadek)
    if (cached.locationStr === locationStr) {
      const driveOk   = cached.driveSecs   <= MAX_DRIVE_SECS;
      const transitOk = cached.transitSecs <= MAX_TRANSIT_SECS;
      const passes    = driveOk || transitOk;

      const note = buildNote(typeLabel, cached.driveSecs, cached.transitSecs, driveOk, transitOk, true);
      return { passes, fromCache: true, note };
    }
    // Lokalizacja się różni — usuń stary wpis i sprawdź od nowa
    console.log(`    🔄 Zmiana lokalizacji dla "${job.title}" — pobieram nowe dane`);
    delete cache[cacheKey];
  }

  // ── Nowe zapytanie API ─────────────────────────────────────────────────────
  let jobCoords;
  try {
    jobCoords = await geocode(locationStr);
  } catch (err) {
    console.log(`    ⚠️  Nie można geocodować "${locationStr}": ${err.message}`);
    return { passes: true, fromCache: false, note: `${typeLabel} | 📍 Nie można zweryfikować (${locationStr})` };
  }

  let driveSecs;
  try {
    driveSecs = await getDriveTime(homeCoords, jobCoords);
  } catch (err) {
    console.log(`    ⚠️  Błąd API dojazdu dla "${locationStr}": ${err.message}`);
    return { passes: true, fromCache: false, note: `${typeLabel} | 📍 Błąd API dojazdu` };
  }

  // Szacowanie czasu komunikacją publiczną
  const distKm      = haversineKm(homeCoords, jobCoords);
  const multiplier  = distKm > 80 ? 1.4 : 1.8;
  const transitSecs = Math.round(driveSecs * multiplier);

  // Zapisz wynik w cache (obiekt cache jest mutowany in-place, zapisany na końcu)
  if (cacheKey) {
    cache[cacheKey] = {
      locationStr,
      driveSecs,
      transitSecs,
      distKm:   Math.round(distKm),
      cachedAt: new Date().toISOString(),
    };
  }

  const driveOk   = driveSecs   <= MAX_DRIVE_SECS;
  const transitOk = transitSecs <= MAX_TRANSIT_SECS;
  const passes    = driveOk || transitOk;

  const note = buildNote(typeLabel, driveSecs, transitSecs, driveOk, transitOk, false);
  return { passes, fromCache: false, note };
}

// ─── Pomocnicze ──────────────────────────────────────────────────────────────

function buildNote(typeLabel, driveSecs, transitSecs, driveOk, transitOk, fromCache) {
  const cacheIndicator = fromCache ? ' 💾' : '';
  const driveStr   = `🚗 ${formatMins(driveSecs)}${driveOk ? '' : ' ❌'}`;
  const transitStr = `🚌 ~${formatMins(transitSecs)}${transitOk ? '' : ' ❌'}`;
  return `${typeLabel} | ${driveStr} | ${transitStr}${cacheIndicator}`;
}

function isFullyRemote(job) {
  const text       = [job.title, job.location].filter(Boolean).join(' ').toLowerCase();
  const hasRemote  = REMOTE_KEYWORDS.some(kw => text.includes(kw));
  const locRemote  = (job.location || '').toLowerCase().trim() === 'remote'
                  || (job.location || '').toLowerCase().startsWith('remote,');
  const hasHybrid  = HYBRID_KEYWORDS.some(kw => text.includes(kw));
  return (hasRemote || locRemote) && !hasHybrid;
}

function isHybridRole(job) {
  const text = [job.title, job.location].filter(Boolean).join(' ').toLowerCase();
  return HYBRID_KEYWORDS.some(kw => text.includes(kw));
}

function extractLocation(raw) {
  if (!raw) return null;
  const str  = raw.trim();
  const skip = ['remote', 'united kingdom', 'uk', 'nationwide', 'home based', 'work from home', 'wfh', ''];
  if (skip.includes(str.toLowerCase())) return null;

  const cleaned = str
    .replace(/,?\s*(United Kingdom|UK|England|Scotland|Wales|Northern Ireland)$/i, '')
    .replace(/,?\s*[A-Z]{1,2}\d{1,2}\s*\d[A-Z]{2}$/i, '')
    .trim();

  if (!cleaned) return null;
  const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
  return parts.length >= 2 ? `${parts[0]}, ${parts[1]}, UK` : `${parts[0]}, UK`;
}

async function getDriveTime(origin, dest) {
  const departAt = nextWeekdayMorning();
  const url = `https://api.tomtom.com/routing/1/calculateRoute/`
    + `${origin.lat},${origin.lng}:${dest.lat},${dest.lng}/json`
    + `?key=${API_KEY}&travelMode=car&routeType=fastest&traffic=true`
    + `&departAt=${encodeURIComponent(departAt)}`;

  const data = await fetchJSON(url);
  const secs = data?.routes?.[0]?.summary?.travelTimeInSeconds;
  if (secs == null) throw new Error('Brak travelTimeInSeconds w odpowiedzi TomTom');
  return secs;
}

async function geocode(query) {
  const key = query.toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json`
    + `?key=${API_KEY}&countrySet=GB&limit=1`;

  const data   = await fetchJSON(url);
  const result = data?.results?.[0];
  if (!result) throw new Error(`Brak wyniku geocodowania dla "${query}"`);

  const coords = { lat: result.position.lat, lng: result.position.lon };
  geocodeCache.set(key, coords);
  return coords;
}

function haversineKm(a, b) {
  const R    = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h    = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
function toRad(d) { return d * Math.PI / 180; }

function nextWeekdayMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T08:00:00`;
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
        catch { reject(new Error('Błąd parsowania JSON: ' + raw.substring(0, 100))); }
      });
    }).on('error', reject);
  });
}

module.exports = { filterByCommute };
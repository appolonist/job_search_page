// helpers/postedDate.js
//
// Parses a job card's "posted" value — either an ISO date ("2026-06-18") or a
// relative phrase ("Today", "Posted 3 days ago", "2 weeks ago", "30+ days ago")
// — and decides whether it falls within the last N days.
//
// Every board sorts newest-first, so the scrapers use these helpers two ways:
//   • isRecent()    → keep a job that's inside the date window
//   • isOlderThan() → once a datable job crosses the window, the rest of the
//                     (newest-first) results are older too, so stop paginating.
//
// Unparseable dates are treated as "unknown": kept by isRecent (we don't drop a
// job we merely can't date) but never trigger isOlderThan (don't stop on doubt).

const DAY_MS = 24 * 60 * 60 * 1000;

// Job age in whole days (0 = today), or null when the value can't be parsed.
function ageInDays(posted, now = Date.now()) {
  if (!posted) return null;
  const s = String(posted).toLowerCase().trim();

  // Absolute date anywhere in the string: "2026-06-18", "2026-06-18T09:00:00Z"
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) {
    const t = Date.parse(iso[0]);
    if (!Number.isNaN(t)) return Math.max(0, Math.floor((now - t) / DAY_MS));
  }

  // Same-day phrasings
  if (/\b(just\s*posted|just\s*now|today|moments?\s*ago|new today|posted today|active today|new)\b/.test(s)) return 0;
  if (/\b\d+\s*(hour|hr|minute|min|second|sec)s?\b/.test(s)) return 0;
  if (/\byesterday\b/.test(s)) return 1;

  // "N day(s) ago", "N+ days ago", "30+ days ago"
  let m = s.match(/(\d+)\s*\+?\s*day/);
  if (m) return parseInt(m[1], 10);

  m = s.match(/(\d+)\s*\+?\s*week/);
  if (m) return parseInt(m[1], 10) * 7;

  m = s.match(/(\d+)\s*\+?\s*month/);
  if (m) return parseInt(m[1], 10) * 30;

  return null;
}

// Inside the last `maxDays` days? Unknown dates default to `keepUnknown`.
function isRecent(posted, maxDays = 7, keepUnknown = true) {
  const age = ageInDays(posted);
  if (age === null) return keepUnknown;
  return age <= maxDays;
}

// Datably older than the window — the signal to stop paginating. Unknown → false.
function isOlderThan(posted, maxDays = 7) {
  const age = ageInDays(posted);
  return age !== null && age > maxDays;
}

module.exports = { ageInDays, isRecent, isOlderThan };

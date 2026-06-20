#!/usr/bin/env node
/**
 * list-relevant-jobs.js
 *
 * Reviews the "new" job records in tracker-state.json and classifies them by
 * relevance to a Senior SDET / Software QA skillset (Playwright/TS/JS, test
 * automation, API testing, CI/CD — see cv_SSQE_Karol_Piotrowski).
 *
 * The scrapers search QA/test terms but the boards return a lot of noise:
 * hardware/electrical/mechanical "test" roles, manufacturing/lab/food "quality"
 * roles, and plain dev/management roles. This filters those out.
 *
 * Output: a deduped, prioritised list (remote/hybrid first) printed to stdout
 * and written to relevant-qa-jobs.md.
 *
 * Usage:  node scripts/list-relevant-jobs.js
 */
const fs = require('fs')
const path = require('path')

const STATE = path.resolve(__dirname, '..', 'tracker-state.json')
const REPORT = path.resolve(__dirname, '..', 'relevant-qa-jobs.md')

// Roles that are NOT software QA even when they say "test"/"quality"/"engineer".
const EXCLUDE = [
  // hardware / electrical / mechanical / industrial test & inspection
  /electric|electronic/, /\bmechanical\b/, /commissioning/, /\bndt\b|non[- ]destructive/,
  /\binspector\b/, /calibration|metrolog/, /\bate\b/, /\bpcb\b/, /\brf\b/, /avionic|do[- ]?178/,
  /\bweld/, /machining|fabrication|\bcnc\b/, /\bhvac\b/, /geotechnical/, /\bsonar\b/,
  /service engineer/, /field (service )?engineer/, /\bpnt\b/, /simulation engineer/,
  /test and inspection/, /\bi&t\b/, /environmental test/, /materials? engineer/,
  // manufacturing / production / lab / pharma / food quality
  /manufactur|production|factory|shop ?floor/, /\bfood\b|bakery|hygiene|haccp|\bbrc\b/,
  /pharma|clinical|laborator|\blab\b|gmp|gxp|detox/, /supplier quality/, /quality technician/,
  /quality inspector|quality controller|quality control\b|quality auditor|incoming quality/,
  /\bqc\b/, /textile|garment|construction|highways|\bcivil\b/,
  // non-QA software / dev / data / management noise
  /data engineer/, /full[- ]?stack/, /front[- ]?end|back[- ]?end/, /\bdevops\b/, /\bsre\b/,
  /delivery manager/, /project manager/, /product manager/, /programme manager|program manager/,
  /operations manager/, /journey manager/, /outcome manager/, /account manager/, /general manager/,
  /\bvice president\b|\bsvp\b/, /data analyst/, /business analyst/, /technology lead/,
  /scrum master/, /\barchitect\b/, /\bnurse\b|social care|\bcarer\b/, /\bdriver\b/, /\bsales\b/,
  /recruit|teacher|lecturer|finance|accountant|marketing/,
]

// Strong, unambiguous software-test signals.
const STRONG = [
  /\bsdet\b/, /\bseit\b/, /engineer in test/, /software engineer.*test|test.*software engineer/,
  /qa automation|automation qa/, /test automation|automation test|automated test/,
  /\bqa\b.*engineer|engineer.*\bqa\b/, /quality assurance engineer/, /quality assurance analyst/,
  /software test|software qa|software tester|test software/, /\bqa analyst\b/,
  /playwright|cypress|selenium|webdriver|appium/, /qa consultant|test consultant/,
  /principal.*(sdet|test|qa)/, /\bqa lead\b|lead.*\bqa\b|lead sdet|qa team lead/,
  /data quality engineer/, /qa specialist/, /quality assurance specialist/,
]

// Plausible but ambiguous — needs a human eye (generic "test"/"quality").
const MAYBE = [
  /test engineer/, /test lead/, /test manager/, /test analyst/, /\bqa\b/,
  /quality engineer/, /quality assurance/, /automation engineer/,
  /quality manager/, /quality lead/, /tester\b/,
]

function classify(title) {
  const t = (title || '').toLowerCase()
  if (EXCLUDE.some(r => r.test(t))) return 'exclude'
  if (STRONG.some(r => r.test(t))) return 'strong'
  if (MAYBE.some(r => r.test(t))) return 'maybe'
  return 'exclude'
}

function mode(commuteNote) {
  const c = (commuteNote || '').toLowerCase()
  if (c.includes('remote')) return 'Remote'
  if (c.includes('hybrid')) return 'Hybrid'
  return 'Office'
}

// Pull the car-commute snippet e.g. "🚗 2h 22min ❌" for office roles.
function commute(commuteNote) {
  const m = (commuteNote || '').match(/🚗[^|🚌]*/)
  return m ? m[0].trim() : ''
}

const state = JSON.parse(fs.readFileSync(STATE, 'utf8'))
const news = state.jobs.filter(j => j.status === 'new')

const buckets = { strong: [], maybe: [], exclude: [] }
for (const j of news) buckets[classify(j.title)].push(j)

// Dedupe by title + company (or location when company is blank): the same
// posting is replicated across nearby towns / boards.
function dedupe(list) {
  const map = new Map()
  for (const j of list) {
    const key = `${(j.title || '').toLowerCase().trim()}||${(j.company || j.location || '').toLowerCase().trim()}`
    if (!map.has(key)) {
      map.set(key, { ...j, _count: 1, _locations: new Set([j.location].filter(Boolean)) })
    } else {
      const e = map.get(key)
      e._count++
      if (j.location) e._locations.add(j.location)
      // prefer a remote/hybrid variant if one exists in the group
      if (mode(j.commuteNote) !== 'Office' && mode(e.commuteNote) === 'Office') e.commuteNote = j.commuteNote
    }
  }
  // remote/hybrid first, then by company
  const order = { Remote: 0, Hybrid: 1, Office: 2 }
  return [...map.values()].sort((a, b) =>
    (order[mode(a.commuteNote)] - order[mode(b.commuteNote)]) ||
    (a.company || '').localeCompare(b.company || ''))
}

const strong = dedupe(buckets.strong)
const maybe = dedupe(buckets.maybe)

function row(j) {
  const loc = [...j._locations][0] || j.location || '—'
  const more = j._count > 1 ? ` _(+${j._count - 1} more postings)_` : ''
  const m = mode(j.commuteNote)
  const cm = m === 'Office' ? ` · ${commute(j.commuteNote)}` : ''
  return `- **${j.title}** — ${j.company || '(company n/a)'} · ${loc} · ${m}${cm}${more}\n  ${j.url}`
}

const remoteHybrid = [...strong, ...maybe].filter(j => mode(j.commuteNote) !== 'Office')
const strongOffice = strong.filter(j => mode(j.commuteNote) === 'Office')
const maybeOffice = maybe.filter(j => mode(j.commuteNote) === 'Office')

let md = `# Relevant QA / SDET jobs (from ${news.length} new records)\n\n`
md += `Classified against Senior SDET skillset. Counts: **${buckets.strong.length} strong**, `
md += `**${buckets.maybe.length} possible**, ${buckets.exclude.length} filtered out as not software-QA.\n\n`
md += `After de-duplicating replicated postings: **${strong.length} strong** distinct roles, **${maybe.length} possible** distinct roles.\n\n`
md += `## ⭐ Remote / Hybrid (most actionable for a remote candidate) — ${remoteHybrid.length}\n\n`
md += (remoteHybrid.map(row).join('\n') || '_none_') + '\n\n'
md += `## Strong match — office-based (${strongOffice.length})\n\n`
md += (strongOffice.map(row).join('\n') || '_none_') + '\n\n'
md += `## Possible match — needs a quick look (${maybeOffice.length})\n\n`
md += (maybeOffice.map(row).join('\n') || '_none_') + '\n'

fs.writeFileSync(REPORT, md)

// Console summary
console.log(`NEW records: ${news.length}`)
console.log(`  strong: ${buckets.strong.length}  maybe: ${buckets.maybe.length}  excluded: ${buckets.exclude.length}`)
console.log(`Deduped: strong ${strong.length}, maybe ${maybe.length}`)
console.log(`Remote/Hybrid relevant: ${remoteHybrid.length}, Strong-office: ${strongOffice.length}, Maybe-office: ${maybeOffice.length}`)
console.log(`Report written: ${REPORT}`)
console.log('\n=== ⭐ REMOTE / HYBRID RELEVANT ===')
remoteHybrid.forEach(j => console.log(`[${mode(j.commuteNote)}] ${j.title} — ${j.company || 'n/a'} · ${[...j._locations][0] || j.location}`))
console.log('\n=== STRONG MATCH (office) — top 60 deduped ===')
strongOffice.slice(0, 60).forEach(j => console.log(`${j.title} — ${j.company || 'n/a'} · ${[...j._locations][0] || j.location} · ${commute(j.commuteNote)}`))

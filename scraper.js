// scraper.js
require('dotenv').config();

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const { filterByCommute } = require('./helpers/commuteFilter');


const SEARCH_TERMS = [
  'Software QA Engineer',
  'Software QA Automation Engineer',
  'Testing Lead',
  'Test Lead',
  'QA Engineer',
  'QA Automation Engineer',
  'Test Automation Engineer',
  'SDET',
  'Software Engineer in Test',
  'Test Engineer',
  'QA Lead'
];

const LOCATION = 'United Kingdom';
const OUT_DIR  = path.join(__dirname, 'output');

async function runScraper() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
  });
  
  let allJobs = [];
  
  const scrapers = [
    require('./sites/indeed'),
    require('./sites/reed'),
    require('./sites/totaljobs'),
    require('./sites/cvlibrary'),
    require('./sites/glassdoor'),
  ];

  for (const scraper of scrapers) {
    for (const term of SEARCH_TERMS) {
      try {
        console.log(`Scraping ${scraper.name} for: ${term}`);
        const jobs = await scraper.search(context, term, LOCATION);
        console.log(`  → ${jobs.length} results`);
        allJobs = allJobs.concat(jobs.map(j => ({ ...j, searchTerm: term })));
      } catch (err) {
        console.error(`  ❌ ${scraper.name} | "${term}" → ERROR: ${err.message}`);
      }
    }
  }

  await browser.close();

  // Deduplicate by URL
  const seen   = new Set();
  const unique = allJobs.filter(j => {
    if (!j.url || seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });

  console.log(`\n📦 ${unique.length} unique jobs before commute filter`);

  const filtered = await filterByCommute(unique);

  saveReport(filtered);
}

function saveReport(jobs) {
  const date = new Date().toISOString().split('T')[0];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ── Save CSV ──────────────────────────────────────────────────────────────
  const csvFilename = `jobs-${date}.csv`;
  const csvPath     = path.join(OUT_DIR, csvFilename);

  const csv = [
    'Title,Company,Location,Board,Search Term,Commute,URL,Posted',
    ...jobs.map(j =>
      [j.title, j.company, j.location, j.board, j.searchTerm, j.commuteNote, j.url, j.posted]
        .map(v => `"${(v || '').replace(/"/g, '""')}"`)
        .join(',')
    )
  ].join('\n');

  fs.writeFileSync(csvPath, csv, 'utf8');
  console.log(`✅ CSV saved → ${csvFilename} (${jobs.length} jobs)`);

  // ── Update output/index.json ──────────────────────────────────────────────
  // Lists all CSV files so tracker.html can auto-discover them via fetch()
  updateIndex(csvFilename, jobs.length, date);

  console.log(`✅ Done → output/${csvFilename}`);
}

function updateIndex(newFilename, jobCount, date) {
  const indexPath = path.join(OUT_DIR, 'index.json');

  // Load existing index or start fresh
  let index = { generated: '', files: [] };
  try {
    if (fs.existsSync(indexPath)) {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    }
  } catch (_) {}

  // Remove any existing entry for the same date (re-run scenario)
  index.files = (index.files || []).filter(f => f.date !== date);

  // Add today's entry at the front
  index.files.unshift({
    filename: newFilename,
    date,
    jobCount,
  });

  // Keep only the last 90 days of entries (avoid index growing forever)
  index.files = index.files.slice(0, 90);
  index.generated = new Date().toISOString();

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  console.log(`📋 index.json updated — ${index.files.length} total scrape(s) recorded`);
}

runScraper().catch(console.error);
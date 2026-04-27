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

async function runScraper() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
  });

  let allJobs = [];

  const scrapers = [
    require('./sites/indeed'),
    require('./sites/reed'),
    require('./sites/totaljobs'),   // now uses Adzuna API
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
  const seen = new Set();
  const unique = allJobs.filter(j => {
    if (!j.url || seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });

  console.log(`\n📦 ${unique.length} unique jobs before commute filter`);

  // ── Commute filter ────────────────────────────────────────────────────────
  const filtered = await filterByCommute(unique);

  saveReport(filtered);
}

function saveReport(jobs) {
  const date   = new Date().toISOString().split('T')[0];
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  // CSV
  const csv = [
    'Title,Company,Location,Board,Search Term,Commute,URL,Posted',
    ...jobs.map(j =>
      `"${esc(j.title)}","${esc(j.company)}","${esc(j.location)}","${esc(j.board)}","${esc(j.searchTerm)}","${esc(j.commuteNote || '')}","${j.url}","${j.posted || ''}"`
    )
  ].join('\n');
  fs.writeFileSync(path.join(outDir, `jobs-${date}.csv`), csv);

  // HTML
  const html = generateHTML(jobs, date);
  fs.writeFileSync(path.join(outDir, `jobs-${date}.html`), html);

  console.log(`\n✅ Done! ${jobs.length} jobs saved → output/jobs-${date}.html`);
}

function esc(str) {
  return (str || '').replace(/"/g, '""');
}

function generateHTML(jobs, date) {
  // Group by commute type for summary badges
  const remote  = jobs.filter(j => j.commuteNote?.includes('Remote') || j.commuteNote?.includes('🌐'));
  const hybrid  = jobs.filter(j => j.commuteNote?.includes('Hybrid') || j.commuteNote?.includes('🔀'));
  const office  = jobs.filter(j => j.commuteNote?.includes('🚗'));
  const unknown = jobs.filter(j => !j.commuteNote || j.commuteNote.includes('unverified') || j.commuteNote.includes('Flexible'));

  const rows = jobs.map(j => {
    const isRemote = j.commuteNote?.includes('🌐') || j.commuteNote?.includes('Remote');
    const isHybrid = j.commuteNote?.includes('🔀') || j.commuteNote?.includes('Hybrid');
    const rowClass = isRemote ? 'row-remote' : isHybrid ? 'row-hybrid' : '';
    return `
    <tr class="${rowClass}">
      <td><a href="${j.url}" target="_blank">${j.title}</a></td>
      <td>${j.company || '—'}</td>
      <td>${j.location || '—'}</td>
      <td><span class="badge badge-${(j.board || '').replace(/[^a-z]/gi,'').toLowerCase().substring(0,8)}">${j.board}</span></td>
      <td>${j.searchTerm}</td>
      <td class="commute">${j.commuteNote || '—'}</td>
      <td>${j.posted || '—'}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QA Jobs – ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; color: #1e293b; padding: 24px; }
    h1 { font-size: 1.5rem; margin-bottom: 4px; }
    .subtitle { color: #64748b; margin-bottom: 20px; font-size: 0.9rem; }

    .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .card { background: white; border-radius: 10px; padding: 14px 20px; min-width: 120px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .card .num { font-size: 1.8rem; font-weight: 700; }
    .card .lbl { font-size: 0.78rem; color: #64748b; margin-top: 2px; }

    .controls { margin-bottom: 12px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    input[type=text] { padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; width: 260px; }
    select { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; }
    label { font-size: 0.85rem; color: #475569; }

    .table-wrap { overflow-x: auto; background: white; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
    th { background: #2563eb; color: white; padding: 10px 12px; text-align: left; white-space: nowrap; cursor: pointer; user-select: none; }
    th:hover { background: #1d4ed8; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8fafc; }
    tr.row-remote td { background: #f0fdf4; }
    tr.row-remote:hover td { background: #dcfce7; }
    tr.row-hybrid td { background: #eff6ff; }
    tr.row-hybrid:hover td { background: #dbeafe; }

    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }

    .commute { white-space: nowrap; font-size: 0.8rem; color: #475569; }

    .badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600; background: #e2e8f0; color: #475569; }

    .legend { display: flex; gap: 14px; margin-bottom: 14px; font-size: 0.8rem; flex-wrap: wrap; }
    .legend span { display: flex; align-items: center; gap: 5px; }
    .dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    .dot-remote { background: #bbf7d0; border: 1px solid #86efac; }
    .dot-hybrid { background: #bfdbfe; border: 1px solid #93c5fd; }
    .dot-office { background: white; border: 1px solid #cbd5e1; }

    #no-results { display: none; padding: 30px; text-align: center; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>🔍 QA / Test Engineer Jobs – ${date}</h1>
  <p class="subtitle">Home: ${process.env.HOME_POSTCODE || 'LL139AY'} &nbsp;|&nbsp; Filter: ≤1h drive or ≤2h transit, plus all remote/hybrid</p>

  <div class="summary">
    <div class="card"><div class="num">${jobs.length}</div><div class="lbl">Total jobs</div></div>
    <div class="card"><div class="num">${remote.length}</div><div class="lbl">🌐 Remote</div></div>
    <div class="card"><div class="num">${hybrid.length}</div><div class="lbl">🔀 Hybrid</div></div>
    <div class="card"><div class="num">${office.length}</div><div class="lbl">🏢 Office (in range)</div></div>
    <div class="card"><div class="num">${unknown.length}</div><div class="lbl">📍 Unverified</div></div>
  </div>

  <div class="controls">
    <input type="text" id="search" placeholder="Filter by title, company, location…" oninput="applyFilter()">
    <select id="typeFilter" onchange="applyFilter()">
      <option value="">All types</option>
      <option value="🌐">Remote only</option>
      <option value="🔀">Hybrid only</option>
      <option value="🚗">Office (in range)</option>
    </select>
    <select id="boardFilter" onchange="applyFilter()">
      <option value="">All boards</option>
      ${[...new Set(jobs.map(j => j.board))].map(b => `<option value="${b}">${b}</option>`).join('')}
    </select>
    <label><input type="checkbox" id="remoteOnly" onchange="applyFilter()"> Remote / Hybrid only</label>
  </div>

  <div class="legend">
    <span><i class="dot dot-remote"></i> Remote</span>
    <span><i class="dot dot-hybrid"></i> Hybrid</span>
    <span><i class="dot dot-office"></i> Office (within commute)</span>
  </div>

  <div class="table-wrap">
    <table id="jobTable">
      <thead>
        <tr>
          <th onclick="sortTable(0)">Job Title ↕</th>
          <th onclick="sortTable(1)">Company ↕</th>
          <th onclick="sortTable(2)">Location ↕</th>
          <th onclick="sortTable(3)">Board ↕</th>
          <th onclick="sortTable(4)">Search Term ↕</th>
          <th>Commute</th>
          <th onclick="sortTable(6)">Posted ↕</th>
        </tr>
      </thead>
      <tbody id="tableBody">
        ${rows}
      </tbody>
    </table>
    <div id="no-results">No jobs match your filters.</div>
  </div>

  <script>
    let sortDir = {};

    function applyFilter() {
      const q         = document.getElementById('search').value.toLowerCase();
      const typeF     = document.getElementById('typeFilter').value;
      const boardF    = document.getElementById('boardFilter').value;
      const remoteF   = document.getElementById('remoteOnly').checked;
      const rows      = document.querySelectorAll('#tableBody tr');
      let visible = 0;

      rows.forEach(row => {
        const text    = row.innerText.toLowerCase();
        const commute = row.querySelector('.commute')?.innerText || '';
        const board   = row.querySelector('.badge')?.innerText || '';

        const matchQ      = !q      || text.includes(q);
        const matchType   = !typeF  || commute.includes(typeF);
        const matchBoard  = !boardF || board === boardF;
        const matchRemote = !remoteF || commute.includes('🌐') || commute.includes('🔀') || commute.includes('🏠');

        const show = matchQ && matchType && matchBoard && matchRemote;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      document.getElementById('no-results').style.display = visible === 0 ? 'block' : 'none';
    }

    function sortTable(col) {
      const tbody = document.getElementById('tableBody');
      const rows  = [...tbody.querySelectorAll('tr')];
      sortDir[col] = !sortDir[col];

      rows.sort((a, b) => {
        const aT = a.querySelectorAll('td')[col]?.innerText?.trim() || '';
        const bT = b.querySelectorAll('td')[col]?.innerText?.trim() || '';
        return sortDir[col]
          ? aT.localeCompare(bT)
          : bT.localeCompare(aT);
      });

      rows.forEach(r => tbody.appendChild(r));
    }
  </script>
</body>
</html>`;
}

runScraper().catch(console.error);
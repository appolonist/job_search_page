#requires -Version 5
<#
.SYNOPSIS
  Once-per-day job-scrape pipeline, meant to run at logon.

.DESCRIPTION
  Runs at most once per calendar day (the first logon of the day). On later
  logons/reboots the same day it detects the date marker and exits immediately.

  Steps:
    1. Claim today's slot (so a 2nd/3rd boot won't re-run).
    2. Run the scraper (node scraper.js) - Indeed/CV-Library/Glassdoor/Reed/Adzuna.
    3. Commit & push output/ to GitHub. The tracker reads its data FROM GitHub
       (raw.githubusercontent.com + the GitHub API), not from local disk, so the
       fresh CSV must be pushed before it can appear in the UI.
    4. Start the tracker dev server on :3000 (reused if already running).
    5. Open Chrome at the tracker, which auto-syncs the new data on load.

  State + logs live in %LOCALAPPDATA%\job-scraper-daily\ (outside the repo).

.PARAMETER Force
  Ignore the once-a-day guard and run anyway (handy for manual re-runs).

.PARAMETER Port
  Port for the tracker dev server (default 3000).
#>
[CmdletBinding()]
param(
  [switch] $Force,
  [int]    $Port = 3000
)

$ErrorActionPreference = 'Stop'

# --- Paths -------------------------------------------------------------------
$RepoRoot  = Split-Path -Parent $PSScriptRoot          # scripts\ -> repo root
$Tracker   = Join-Path $RepoRoot 'job-tracker'
$StateDir  = Join-Path $env:LOCALAPPDATA 'job-scraper-daily'
$StateFile = Join-Path $StateDir 'last-run.txt'
$Today     = Get-Date -Format 'yyyy-MM-dd'
$Url       = "http://localhost:$Port/job_search_page/"

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$Log = Join-Path $StateDir "run-$Today.log"

function Log([string]$m) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -LiteralPath $Log -Value $line
  Write-Host $line
}

function Test-Port([int]$p) {
  try { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop | Out-Null; return $true }
  catch { return $false }
}

# --- Once-a-day guard --------------------------------------------------------
if (-not $Force -and (Test-Path $StateFile) -and ((Get-Content $StateFile -Raw).Trim() -eq $Today)) {
  Log "Already ran today ($Today) - exiting. Use -Force to run again."
  exit 0
}
# Claim the slot up front so a near-simultaneous or later logon won't double-run.
Set-Content -LiteralPath $StateFile -Value $Today -Encoding ascii
Log "===== Daily run claimed for $Today ====="

# --- Resolve tools -----------------------------------------------------------
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) { $Node = Join-Path $env:ProgramFiles 'nodejs\node.exe' }
$Npm = Join-Path (Split-Path $Node) 'npm.cmd'
if (-not (Test-Path $Npm)) { $Npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source }
Log "node = $Node"

# --- 1. Scrape ---------------------------------------------------------------
Log 'Running scraper (node scraper.js)...'
Push-Location $RepoRoot
try {
  & $Node 'scraper.js' *>> $Log
  $scrapeExit = $LASTEXITCODE
} finally { Pop-Location }

if ($scrapeExit -ne 0) {
  Log "Scraper exited with code $scrapeExit - continuing (tracker will show whatever is already on GitHub)."
} else {
  Log 'Scraper finished OK.'
}

# --- 2. Commit & push output so the GitHub-backed tracker can read it ---------
Push-Location $RepoRoot
try {
  & git add cache/commute-cache.json output/index.json output/jobs-*.csv 2>> $Log
  & git diff --staged --quiet
  if ($LASTEXITCODE -ne 0) {
    Log 'Committing & pushing scraper output...'
    & git commit -m "scrape: $Today - local auto update" *>> $Log
    & git pull --rebase *>> $Log
    & git push *>> $Log
    if ($LASTEXITCODE -eq 0) { Log 'Pushed output to GitHub.' }
    else { Log "git push FAILED (exit $LASTEXITCODE) - tracker may show stale data. Check 'git push' works in this repo." }
  } else {
    Log 'No output changes to commit (scraper produced nothing new).'
  }
} finally { Pop-Location }

# --- 3. Start the tracker dev server on :Port (reuse if already up) -----------
if (-not (Test-Path (Join-Path $Tracker 'node_modules'))) {
  Log 'Installing job-tracker dependencies (first run)...'
  Push-Location $Tracker
  try { & $Npm install *>> $Log } finally { Pop-Location }
}

if (Test-Port $Port) {
  Log "Dev server already listening on :$Port - reusing it."
} else {
  Log "Starting tracker dev server on :$Port..."
  $outLog = Join-Path $StateDir "devserver-$Today.out.log"
  $errLog = Join-Path $StateDir "devserver-$Today.err.log"
  # Detached: the process keeps running (serving :Port) after this script exits.
  Start-Process -FilePath $Npm `
    -ArgumentList @('run', 'dev', '--', '--port', "$Port", '--strictPort') `
    -WorkingDirectory $Tracker -WindowStyle Hidden `
    -RedirectStandardOutput $outLog -RedirectStandardError $errLog
}

# --- 4. Wait for the server, then open Chrome --------------------------------
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  if (Test-Port $Port) { $ready = $true; break }
  Start-Sleep -Seconds 1
}
if ($ready) { Start-Sleep -Seconds 2 }   # let Vite finish its first build
else        { Log "Dev server did not come up on :$Port within 60s - opening anyway." }

$Chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($Chrome) {
  Log "Opening Chrome -> $Url"
  Start-Process -FilePath $Chrome -ArgumentList $Url
} else {
  Log "Chrome not found - opening default browser -> $Url"
  Start-Process $Url
}

Log '===== Done ====='

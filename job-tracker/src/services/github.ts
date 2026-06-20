// src/services/github.ts
import type { GitHubConfig, TrackerState, ScrapeEntry } from '../types'
import { parseCSV } from './csvParser'

const STATE_FILE = 'tracker-state.json'
const INDEX_PATH = 'output/index.json'

// ── Read tracker-state.json ───────────────────────────────────────────────────
// IMPORTANT: The GitHub Contents API only serves blobs up to 1 MB. Our
// tracker-state.json grows past that (hundreds of jobs/day), at which point the
// Contents API responds 403 — which aborted the whole sync and left the page
// showing zero jobs. Fix: read the blob SHA from the Git Trees API (no size
// limit) and pull the file body from the raw CDN (no size limit, cache-busted).

export async function readState(
  cfg: GitHubConfig,
): Promise<{ state: TrackerState; sha: string } | null> {
  // 1. Resolve the file's blob SHA via the Trees API — works for any size.
  const treeUrl = `https://api.github.com/repos/${cfg.user}/${cfg.repo}/git/trees/${cfg.branch}?recursive=1&_=${Date.now()}`
  const treeRes = await fetch(treeUrl, { headers: ghHeaders(cfg) })

  if (treeRes.status === 404) return null
  if (!treeRes.ok) throw new Error(`GitHub Trees API ${treeRes.status}: ${await treeRes.text()}`)

  const tree  = (await treeRes.json()) as { tree?: Array<{ path: string; sha: string }> }
  const entry = (tree.tree ?? []).find(item => item.path === STATE_FILE)

  // File not committed yet — first run, treat as empty state.
  if (!entry) return null

  // 2. Download the body from the raw CDN (no 1 MB cap). Force UTF-8 so emoji
  // in commuteNote/notes survive regardless of the CDN's Content-Type charset.
  const res = await fetch(rawUrl(cfg, STATE_FILE))

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status} reading ${STATE_FILE}`)

  const buffer  = await res.arrayBuffer()
  const text    = new TextDecoder('utf-8').decode(buffer)
  const decoded = JSON.parse(text) as TrackerState

  return { state: decoded, sha: entry.sha }
}

// ── Write tracker-state.json ──────────────────────────────────────────────────

export async function writeState(
  cfg:   GitHubConfig,
  state: TrackerState,
  sha:   string | null,
): Promise<string> {
  const json = JSON.stringify(state, null, 2)

  // IMPORTANT: never use btoa(json) directly — btoa is latin-1 only and
  // silently corrupts emoji (🚗 🔀 🌐) in commuteNote fields.
  // TextEncoder → Uint8Array → base64 is the correct unicode-safe path.
  const content = uint8ArrayToBase64(new TextEncoder().encode(json))

  const body: Record<string, unknown> = {
    message: `tracker: sync state ${today()}`,
    content,
    branch: cfg.branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(
    `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/${STATE_FILE}`,
    { method: 'PUT', headers: ghHeaders(cfg), body: JSON.stringify(body) },
  )

  if (res.status === 409) return 'conflict'

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `GitHub write failed: ${res.status}`)
  }

  const data = await res.json()
  return data.content.sha as string
}

// ── Read output/index.json ────────────────────────────────────────────────────

export async function readIndex(cfg: GitHubConfig): Promise<ScrapeEntry[] | null> {
  const url = rawUrl(cfg, INDEX_PATH)
  const res  = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return (data.files ?? []) as ScrapeEntry[]
}

// ── Read a CSV file ───────────────────────────────────────────────────────────
// Uses arrayBuffer + TextDecoder to force UTF-8 decoding regardless of what
// Content-Type header GitHub's CDN sends (which is often missing charset).

export async function readCSV(cfg: GitHubConfig, filename: string) {
  const url = rawUrl(cfg, `output/${filename}`)
  const res  = await fetch(url)

  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${filename}`)

  // Force UTF-8 — fixes garbled emoji when GitHub CDN omits charset header
  const buffer = await res.arrayBuffer()
  const text   = new TextDecoder('utf-8').decode(buffer)

  return parseCSV(text)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ghHeaders(cfg: GitHubConfig): HeadersInit {
  return {
    Authorization:  `token ${cfg.token}`,
    Accept:         'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

function rawUrl(cfg: GitHubConfig, path: string): string {
  return `https://raw.githubusercontent.com/${cfg.user}/${cfg.repo}/${cfg.branch}/${path}?_=${Date.now()}`
}

// Unicode-safe Uint8Array → base64
// Processes in 8KB chunks to avoid call stack overflow on large state files
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192
  let binary  = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}
// src/services/github.ts
import type { GitHubConfig, TrackerState, ScrapeEntry } from '../types'
import { parseCSV } from './csvParser'

const STATE_FILE = 'tracker-state.json'
const INDEX_PATH = 'output/index.json'

// ── Read tracker-state.json ───────────────────────────────────────────────────

export async function readState(
  cfg: GitHubConfig,
): Promise<{ state: TrackerState; sha: string } | null> {
  const url = `https://api.github.com/repos/${cfg.user}/${cfg.repo}/contents/${STATE_FILE}?ref=${cfg.branch}&_=${Date.now()}`
  const res  = await fetch(url, { headers: ghHeaders(cfg) })

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const sha  = data.sha as string

  // GitHub returns content as base64 — decode it safely with TextDecoder
  // to preserve any unicode characters in notes/titles
  const bytes   = base64ToUint8Array(data.content.replace(/\n/g, ''))
  const text    = new TextDecoder('utf-8').decode(bytes)
  const decoded = JSON.parse(text) as TrackerState

  return { state: decoded, sha }
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

// base64 → Uint8Array (for decoding GitHub API responses)
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}
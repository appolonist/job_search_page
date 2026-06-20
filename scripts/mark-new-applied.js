#!/usr/bin/env node
/**
 * mark-new-applied.js
 *
 * Bulk-clears the "Needs Action" queue: moves every job currently in status
 * "new" to "applied", so the next scrape's genuinely-new records stand out.
 *
 * - Only touches status === "new" (leaves applied / interview / offer / rejected
 *   alone — e.g. the 6 "offer" records are preserved).
 * - Sets appliedDate to today when blank, matching the app's cycleStatus().
 * - Clears meta.lastNewIds so the "New Today" tab is empty too.
 * - Writes JSON.stringify(state, null, 2) — the same format the web app writes,
 *   so the diff stays clean.
 *
 * Idempotent: running it again when there are no "new" jobs is a no-op.
 *
 * Usage:  node scripts/mark-new-applied.js
 * Then commit + push tracker-state.json for it to reach the live page.
 */
const fs = require('fs')
const path = require('path')

const STATE = path.resolve(__dirname, '..', 'tracker-state.json')
const today = new Date().toISOString().split('T')[0]

const state = JSON.parse(fs.readFileSync(STATE, 'utf8'))

const before = {}
state.jobs.forEach(j => { before[j.status] = (before[j.status] || 0) + 1 })

let moved = 0
for (const job of state.jobs) {
  if (job.status === 'new') {
    job.status = 'applied'
    if (!job.appliedDate) job.appliedDate = today
    moved++
  }
}

// Clear the "new today" highlight set — those ids are no longer new.
state.meta = state.meta || {}
state.meta.lastNewIds = []

fs.writeFileSync(STATE, JSON.stringify(state, null, 2))

const after = {}
state.jobs.forEach(j => { after[j.status] = (after[j.status] || 0) + 1 })

console.log(`Moved ${moved} job(s) from "new" -> "applied" (appliedDate=${today} where blank)`)
console.log('Before:', JSON.stringify(before))
console.log('After: ', JSON.stringify(after))
console.log('meta.lastNewIds cleared ->', state.meta.lastNewIds.length)

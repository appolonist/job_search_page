// src/hooks/useGitHubSync.ts
import { useState, useRef, useCallback } from 'react'
import type { Job, TrackerState, TrackerMeta, GitHubConfig, SyncStatus } from '../types'
import { readState, writeState, readIndex, readCSV } from '../services/github'
import { STATUS_CYCLE } from '../constants'

const EMPTY_META: TrackerMeta = {
  importedFiles: {},
  lastNewIds:    [],
  scrapeIndex:   [],
}

const EMPTY_STATE: TrackerState = {
  jobs: [],
  meta: EMPTY_META,
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function useGitHubSync(config: GitHubConfig | null) {
  const [state,       setState_]      = useState<TrackerState>(EMPTY_STATE)
  const [syncStatus,  setSyncStatus]  = useState<SyncStatus>('idle')
  const [syncLabel,   setSyncLabel]   = useState('Not connected')

  const shaRef       = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef    = useRef(false)

  // ── Sync ─────────────────────────────────────────────────────────────────
  // Returns the number of newly imported jobs so the caller (App.tsx) can
  // update banner/tab state directly — no useEffect needed on the call site.

  const sync = useCallback(async (): Promise<number> => {
    if (!config) return 0

    setSyncStatus('syncing')
    setSyncLabel('Syncing…')

    try {
      // 1. Load remote tracker state
      const remote = await readState(config)
      let current: TrackerState = EMPTY_STATE

      if (remote) {
        shaRef.current = remote.sha
        current = {
          jobs: remote.state.jobs ?? [],
          meta: { ...EMPTY_META, ...remote.state.meta },
        }
      }

      // 2. Import any CSV files not yet seen
      const files = await readIndex(config)
      let totalNew = 0
      const newIds: string[] = []

      if (files?.length) {
        current.meta.scrapeIndex    = files
        const existingUrls          = new Set(current.jobs.map(j => j.url))
        const importedFiles         = { ...current.meta.importedFiles }

        for (const entry of files) {
          if (importedFiles[entry.filename]) continue

          try {
            const parsed = await readCSV(config, entry.filename)

            for (const raw of parsed) {
              if (!raw.url || existingUrls.has(raw.url)) continue

              const job: Job = {
                ...raw,
                id:          uid(),
                status:      'new',
                appliedDate: '',
                nextStep:    '',
                notes:       '',
                addedAt:     new Date().toISOString(),
                sourceFile:  entry.filename,
              }

              current.jobs.unshift(job)
              existingUrls.add(raw.url)
              newIds.push(job.id)
              totalNew++
            }

            importedFiles[entry.filename] = true
          } catch (e) {
            console.warn(`Could not load ${entry.filename}:`, e)
          }
        }

        current.meta.importedFiles = importedFiles

        if (totalNew > 0) {
          current.meta.lastNewIds = newIds
          shaRef.current = await writeState(config, current, shaRef.current) as string
        }
      }

      setState_(current)

      const latest = files?.[0]
      setSyncStatus('saved')
      setSyncLabel(`Synced · ${latest?.date ?? '—'}`)

      // Return count so App.tsx can set banner/tab without a useEffect
      return totalNew

    } catch (err) {
      setSyncStatus('error')
      setSyncLabel(`Sync error: ${(err as Error).message}`)
      return 0
    }
  }, [config])

  // ── Debounced save ────────────────────────────────────────────────────────

  const setState = useCallback((nextState: TrackerState) => {
    setState_(nextState)
    setSyncStatus('syncing')

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(async () => {
      if (savingRef.current || !config) return
      savingRef.current = true

      try {
        const result = await writeState(config, nextState, shaRef.current)

        if (result === 'conflict') {
          const remote = await readState(config)
          if (remote) {
            shaRef.current = remote.sha
            const merged   = mergeStates(nextState, remote.state)
            setState_(merged)
            shaRef.current = await writeState(config, merged, shaRef.current) as string
          }
        } else {
          shaRef.current = result
        }

        setSyncStatus('saved')
        setSyncLabel(
          `Saved · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        )
      } catch (err) {
        setSyncStatus('error')
        setSyncLabel(`Save failed: ${(err as Error).message}`)
      }

      savingRef.current = false
    }, 1500)
  }, [config])

  return { state, setState, syncStatus, syncLabel, sync }
}

// ── Merge: more progressed status wins ───────────────────────────────────────

function mergeStates(local: TrackerState, remote: TrackerState): TrackerState {
  const localMap = new Map(local.jobs.map(j => [j.url, j]))

  for (const rj of remote.jobs) {
    const lj = localMap.get(rj.url)

    if (!lj) {
      local.jobs.push(rj)
    } else {
      const lPos = STATUS_CYCLE.indexOf(lj.status)
      const rPos = STATUS_CYCLE.indexOf(rj.status)
      if (rPos > lPos) {
        lj.status      = rj.status
        lj.appliedDate = rj.appliedDate || lj.appliedDate
        lj.notes       = rj.notes       || lj.notes
        lj.nextStep    = rj.nextStep    || lj.nextStep
      }
    }
  }

  return local
}
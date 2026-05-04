// src/hooks/useJobFilter.ts
import { useMemo, useState } from 'react'
import type { Job, TabId } from '../types'

export interface FilterState {
  query:   string
  board:   string
  type:    string
  sortKey: keyof Job
  sortAsc: boolean
}

const DEFAULT_FILTERS: FilterState = {
  query:   '',
  board:   '',
  type:    '',
  sortKey: 'addedAt',
  sortAsc: false,
}

export function useJobFilter(jobs: Job[], activeTab: TabId, newIds: Set<string>) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const filtered = useMemo(() => {
    return jobs
      .filter(j => {
        // Tab filter
        switch (activeTab) {
          case 'needs-action': if (j.status !== 'new') return false; break
          case 'new':          if (!newIds.has(j.id))  return false; break
          case 'all':          break // Show all jobs
          case 'applied':
            if (!['applied', 'interview', 'offer'].includes(j.status)) return false
            break
          case 'interview': if (j.status !== 'interview') return false; break
          case 'offer':     if (j.status !== 'offer') return false; break
          case 'rejected':  if (j.status !== 'rejected') return false; break
        }

        // Text search
        if (filters.query) {
          const text = [j.title, j.company, j.location, j.notes]
            .join(' ')
            .toLowerCase()
          if (!text.includes(filters.query.toLowerCase())) return false
        }

        // Board filter
        if (filters.board && j.board !== filters.board) return false

        // Type filter
        if (filters.type) {
          const note = j.commuteNote.toLowerCase()
          if (filters.type === 'remote' && !note.includes('remote')) return false
          if (filters.type === 'hybrid' && !note.includes('hybrid')) return false
          if (filters.type === 'office' &&
              (note.includes('remote') || note.includes('hybrid'))) return false
        }

        return true
      })
      .sort((a, b) => {
        const av = String(a[filters.sortKey] ?? '').toLowerCase()
        const bv = String(b[filters.sortKey] ?? '').toLowerCase()
        return filters.sortAsc
          ? av.localeCompare(bv)
          : bv.localeCompare(av)
      })
  }, [jobs, activeTab, newIds, filters])

  // Accepts a partial so callers only need to supply changed keys
  const updateFilters = (partial: Partial<FilterState>) =>
    setFilters(current => ({ ...current, ...partial }))

  const toggleSort = (key: keyof Job) =>
    setFilters(f => ({
      ...f,
      sortKey: key,
      sortAsc: f.sortKey === key ? !f.sortAsc : true,
    }))

  const boards = useMemo(
    () => [...new Set(jobs.map(j => j.board).filter(Boolean))].sort(),
    [jobs],
  )

  return {
    filtered,
    filters,
    setFilters: updateFilters,   // (f: Partial<FilterState>) => void
    toggleSort,
    boards,
  }
}
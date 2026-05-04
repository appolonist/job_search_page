// src/App.tsx
import { useState, useCallback } from 'react'
import type { TabId, Job }       from './types'
import { useConfig }             from './hooks/useConfig'
import { useGitHubSync }         from './hooks/useGitHubSync'
import { useJobFilter }          from './hooks/useJobFilter'
import { exportCSV }             from './services/exportCsv'
import { STATUS_CYCLE }          from './constants'
import { Header }                from './components/layout/Header'
import { StatBar }               from './components/layout/StatBar'
import { TabBar }                from './components/layout/TabBar'
import { Toolbar }               from './components/layout/Toolbar'
import { JobList }               from './components/jobs/JobList'
import { NewBanner }             from './components/ui/NewBanner'
import { LoadingOverlay }        from './components/ui/LoadingOverlay'
import { EditJobModal }          from './components/modals/EditJobModal'
import { SetupModal }            from './components/modals/SetupModal'
import { HistoryModal }          from './components/modals/HistoryModal'

export default function App() {
  const { config, saveConfig, envDefaults }                 = useConfig()
  const { state, setState, syncStatus, syncLabel, sync }    = useGitHubSync(config)

  const [activeTab,    setActiveTab]    = useState<TabId>('needs-action')
  const [showSetup,    setShowSetup]    = useState(!config)
  const [showHistory,  setShowHistory]  = useState(false)
  const [showBanner,   setShowBanner]   = useState(false)
  const [newCount,     setNewCount]     = useState(0)
  const [editJob,      setEditJob]      = useState<{ job?: Job; index?: number } | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [loadingMsg,   setLoadingMsg]   = useState('Connecting to GitHub…')

  const newIds = new Set(state.meta.lastNewIds ?? [])

  const { filtered, filters, setFilters, toggleSort, boards } = useJobFilter(
    state.jobs,
    activeTab,
    newIds,
  )

  // ── Sync helpers ───────────────────────────────────────────────────────────
  // All setState calls happen directly in the async function — never inside
  // a useEffect body — which avoids cascading render warnings.

  const runSync = useCallback(async () => {
    setLoading(true)
    setLoadingMsg('Connecting to GitHub…')

    const count = await sync()

    // Derive banner/tab state directly from the sync result here,
    // not in a separate effect watching `count`.
    if (count > 0) {
      setNewCount(count)
      setShowBanner(true)
      setActiveTab('new')
    }

    setLoading(false)
  }, [sync])

  // Boot: run sync once on mount if config is already present.
  // useState initialiser runs only once — no effect needed.
  useState(() => {
    if (config) runSync()
  })

  // ── Mutations ──────────────────────────────────────────────────────────────

  function cycleStatus(idx: number) {
    const jobs = [...state.jobs]
    const job  = { ...jobs[idx] }
    const pos  = STATUS_CYCLE.indexOf(job.status)
    job.status = STATUS_CYCLE[(pos + 1) % STATUS_CYCLE.length]
    if (job.status === 'applied' && !job.appliedDate) {
      job.appliedDate = new Date().toISOString().split('T')[0]
    }
    jobs[idx] = job
    setState({ ...state, jobs })
  }

  function deleteJob(idx: number) {
    if (!confirm(`Remove "${state.jobs[idx].title}"?`)) return
    const jobs = state.jobs.filter((_, i) => i !== idx)
    setState({ ...state, jobs })
  }

  function saveJob(job: Job, index?: number) {
    const jobs = [...state.jobs]
    if (index === undefined) {
      jobs.unshift(job)
    } else {
      jobs[index] = { ...jobs[index], ...job }
    }
    setState({ ...state, jobs })
  }

  function clearAll() {
    if (!confirm('Delete ALL tracked applications? This cannot be undone.')) return
    setState({
      jobs: [],
      meta: { importedFiles: {}, lastNewIds: [], scrapeIndex: [] },
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // Map filtered index back to real index in state.jobs for mutations
  function realIndex(filteredIdx: number): number {
    return state.jobs.indexOf(filtered[filteredIdx])
  }

  return (
    <div className="min-h-screen bg-[#0d0f12] text-slate-200 flex flex-col">
      <LoadingOverlay show={loading} message={loadingMsg} />

      <Header
        syncStatus={syncStatus}
        syncLabel={syncLabel}
        onSync={runSync}
        onHistory={() => setShowHistory(true)}
        onSetup={() => setShowSetup(true)}
        onAdd={() => setEditJob({})}
        onExport={() => exportCSV(state.jobs)}
      />

      {showBanner && (
        <NewBanner
          newCount={newCount}
          totalNew={state.jobs.filter(j => j.status === 'new').length}
          onShowNew={() => setActiveTab('new')}
          onShowAction={() => setActiveTab('needs-action')}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      <TabBar
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={{
          'needs-action': state.jobs.filter(j => j.status === 'new').length,
          'new':          newIds.size,
        }}
      />

      <StatBar jobs={state.jobs} />

      <Toolbar
        filters={filters}
        onChange={setFilters}
        boards={boards}
        onClearAll={clearAll}
      />

      {state.jobs.length === 0 && !loading ? (
        <div className="text-center py-20 text-slate-500">
          <p className="text-base font-semibold text-slate-400 mb-2">No jobs tracked yet</p>
          <p className="text-sm">Run the scraper, push to GitHub, then click ⟳ Sync.</p>
        </div>
      ) : (
        <JobList
          jobs={filtered}
          newIds={newIds}
          onEdit={i   => setEditJob({ job: filtered[i], index: realIndex(i) })}
          onDelete={i => deleteJob(realIndex(i))}
          onCycle={i  => cycleStatus(realIndex(i))}
          onSort={toggleSort}
          sortKey={filters.sortKey}
          sortAsc={filters.sortAsc}
        />
      )}

      {editJob !== null && (
        <EditJobModal
          job={editJob.job}
          onSave={job => { saveJob(job, editJob.index); setEditJob(null) }}
          onClose={() => setEditJob(null)}
        />
      )}

      {showSetup && (
        <SetupModal
          initial={config ?? undefined}
          envDefaults={envDefaults}
          onSave={cfg => {
            saveConfig(cfg)
            setShowSetup(false)
            runSync()
          }}
          onClose={() => setShowSetup(false)}
        />
      )}

      {showHistory && (
        <HistoryModal
          scrapeIndex={state.meta.scrapeIndex}
          importedFiles={state.meta.importedFiles}
          jobs={state.jobs}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
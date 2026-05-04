// src/components/layout/Header.tsx
import type { SyncStatus } from '../../types'

interface Props {
  syncStatus: SyncStatus
  syncLabel:  string
  onSync:     () => void
  onHistory:  () => void
  onSetup:    () => void
  onAdd:      () => void
  onExport:   () => void
}

const DOT_CLASS: Record<SyncStatus, string> = {
  idle:    'bg-emerald-400 shadow-[0_0_8px_#00e5a0]',
  syncing: 'bg-amber-400   shadow-[0_0_8px_#f59e0b] animate-pulse',
  saved:   'bg-emerald-400 shadow-[0_0_8px_#00e5a0]',
  error:   'bg-red-400     shadow-[0_0_8px_#ef4444]',
}

export function Header({
  syncStatus, syncLabel,
  onSync, onHistory, onSetup, onAdd, onExport,
}: Props) {
  return (
    <header className="
      px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3
      border-b border-slate-800 bg-[#0d0f12]
    ">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLASS[syncStatus]}`} />
        <div>
          <h1 className="text-lg font-black tracking-tight leading-none">
            QA Jobs <span className="text-emerald-400">Tracker</span>
          </h1>
          <p className="text-[0.65rem] font-mono text-slate-500 mt-0.5 truncate max-w-[200px] sm:max-w-none">
            {syncLabel}
          </p>
        </div>
      </div>

      {/* Actions — collapse to icon-only on small screens */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onSync}    className="btn-ghost text-xs">⟳ Sync</button>
        <button onClick={onHistory} className="btn-ghost text-xs hidden sm:inline-flex">📋 History</button>
        <button onClick={onExport}  className="btn-ghost text-xs hidden sm:inline-flex">⬇ Export</button>
        <button onClick={onSetup}   className="btn-ghost text-xs">⚙</button>
        <button onClick={onAdd}     className="btn-primary text-xs">+ Add Job</button>
      </div>
    </header>
  )
}
// src/components/layout/Toolbar.tsx
import type { FilterState } from '../../hooks/useJobFilter'

interface Props {
  filters:    FilterState
  onChange:   (f: Partial<FilterState>) => void
  boards:     string[]
  onClearAll: () => void
}

export function Toolbar({ filters, onChange, boards, onClearAll }: Props) {
  return (
    <div className="
      flex flex-wrap gap-2 px-4 sm:px-6 py-3
      border-b border-slate-800 bg-slate-900/30
    ">
      {/* Search */}
      <input
        type="text"
        value={filters.query}
        placeholder="Search title, company, location…"
        onChange={e => onChange({ query: e.target.value })}
        className="
          flex-1 min-w-[160px] max-w-xs
          bg-slate-800 border border-slate-700 text-slate-200
          font-mono text-xs px-3 py-2 rounded-lg outline-none
          placeholder:text-slate-600
          focus:border-emerald-500 transition-colors
        "
      />

      {/* Board filter */}
      <select
        value={filters.board}
        onChange={e => onChange({ board: e.target.value })}
        className="input-select"
      >
        <option value="">All boards</option>
        {boards.map(b => <option key={b} value={b}>{b}</option>)}
      </select>

      {/* Type filter */}
      <select
        value={filters.type}
        onChange={e => onChange({ type: e.target.value })}
        className="input-select"
      >
        <option value="">All types</option>
        <option value="remote">🌐 Remote</option>
        <option value="hybrid">🔀 Hybrid</option>
        <option value="office">🏢 Office</option>
      </select>

      {/* Clear all — pushed right */}
      <button
        onClick={onClearAll}
        className="
          ml-auto text-xs font-mono px-3 py-2 rounded-lg
          border border-red-900 text-red-400
          hover:bg-red-950 transition-colors
        "
      >
        🗑 Clear all
      </button>
    </div>
  )
}
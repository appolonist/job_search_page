// src/components/layout/TabBar.tsx
import type { TabId } from '../../types'
import { TABS } from '../../constants'

interface Props {
  activeTab: TabId
  onChange:  (tab: TabId) => void
  counts:    Partial<Record<TabId, number>>
}

export function TabBar({ activeTab, onChange, counts }: Props) {
  return (
    <div className="
      flex gap-0.5 overflow-x-auto scrollbar-none
      px-4 sm:px-6 pt-3 bg-slate-900/50 border-b border-slate-800
    ">
      {TABS.map(({ id, label }) => {
        const count   = counts[id]
        const isActive = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`
              relative shrink-0 px-4 py-2 text-xs font-mono rounded-t-lg
              border border-b-0 transition-all whitespace-nowrap
              ${isActive
                ? 'bg-[#0d0f12] text-emerald-400 border-slate-700 border-b-[#0d0f12] -mb-px z-10'
                : 'text-slate-500 border-transparent hover:text-slate-300'
              }
            `}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span className="
                ml-1.5 inline-block bg-emerald-400 text-black
                text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full align-middle
              ">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
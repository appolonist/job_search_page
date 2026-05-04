// src/components/layout/StatBar.tsx
import type { Job, JobStatus } from '../../types'

interface Props {
  jobs: Job[]
}

interface StatConfig {
  label:  string
  status: JobStatus | null   // null = total
  color:  string
}

const STATS: StatConfig[] = [
  { label: 'Total',     status: null,        color: 'text-slate-200'  },
  { label: 'New',       status: 'new',       color: 'text-blue-400'   },
  { label: 'Applied',   status: 'applied',   color: 'text-emerald-400'},
  { label: 'Interview', status: 'interview', color: 'text-amber-400'  },
  { label: 'Offer',     status: 'offer',     color: 'text-violet-400' },
  { label: 'Rejected',  status: 'rejected',  color: 'text-red-400'    },
]

export function StatBar({ jobs }: Props) {
  const counts = jobs.reduce<Record<string, number>>(
    (acc, j) => { acc[j.status] = (acc[j.status] ?? 0) + 1; return acc },
    {},
  )

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-800 border-b border-slate-800">
      {STATS.map(({ label, status, color }) => (
        <div key={label} className="flex flex-col gap-0.5 px-4 py-3 bg-slate-900/50">
          <span className={`font-mono text-xl font-medium leading-none ${color}`}>
            {status === null ? jobs.length : (counts[status] ?? 0)}
          </span>
          <span className="text-[0.6rem] uppercase tracking-widest text-slate-600">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
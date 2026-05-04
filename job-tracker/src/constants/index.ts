import type { JobStatus, TabId } from '../types'

export const STATUS_CYCLE: JobStatus[] = [
  'new', 'applied', 'interview', 'offer', 'rejected', 'withdrawn',
]

export const STATUS_ICONS: Record<JobStatus, string> = {
  new:       '🔵',
  applied:   '✅',
  interview: '🟡',
  offer:     '🟣',
  rejected:  '❌',
  withdrawn: '⚫',
}

export const STATUS_COLORS: Record<JobStatus, string> = {
  new:       'bg-blue-950 text-blue-400 border-blue-900',
  applied:   'bg-emerald-950 text-emerald-400 border-emerald-900',
  interview: 'bg-amber-950 text-amber-400 border-amber-900',
  offer:     'bg-violet-950 text-violet-400 border-violet-900',
  rejected:  'bg-red-950 text-red-400 border-red-900',
  withdrawn: 'bg-neutral-900 text-neutral-500 border-neutral-800',
}

export const TABS: { id: TabId; label: string }[] = [
  { id: 'needs-action', label: 'Needs Action' },
  { id: 'new',          label: 'New Today'    },
  { id: 'all',          label: 'All Jobs'     },
  { id: 'applied',      label: 'Applied'      },
  { id: 'interview',    label: 'Interviews'   },
]
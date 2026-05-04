// src/components/jobs/JobTable.tsx
import type { Job } from '../../types'
import { STATUS_ICONS, STATUS_COLORS } from '../../constants'

interface Props {
  jobs:     Job[]
  newIds:   Set<string>
  onEdit:   (idx: number) => void
  onDelete: (idx: number) => void
  onCycle:  (idx: number) => void
  onSort:   (key: keyof Job) => void
  sortKey:  keyof Job
  sortAsc:  boolean
}

interface Column {
  label:   string
  sortKey?: keyof Job
  className?: string
}

const COLUMNS: Column[] = [
  { label: 'Title',    sortKey: 'title',       className: 'min-w-[220px]' },
  { label: 'Location', sortKey: 'location',    className: 'min-w-[130px]' },
  { label: 'Commute',                          className: 'min-w-[160px]' },
  { label: 'Board',    sortKey: 'board',       className: 'min-w-[100px]' },
  { label: 'Status',   sortKey: 'status',      className: 'min-w-[120px]' },
  { label: 'Applied',  sortKey: 'appliedDate', className: 'min-w-[100px]' },
  { label: 'Notes',                            className: 'min-w-[160px]' },
  { label: '',                                 className: 'w-[72px]'      },
]

export function JobTable({
  jobs, newIds, onEdit, onDelete, onCycle, onSort, sortKey, sortAsc,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">

        {/* ── Head ── */}
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.label}
                onClick={() => col.sortKey && onSort(col.sortKey)}
                className={`
                  px-3 py-2.5 text-left text-[0.65rem] font-mono uppercase
                  tracking-widest text-slate-500 bg-slate-900/60
                  border-b border-slate-800 whitespace-nowrap select-none
                  ${col.sortKey ? 'cursor-pointer hover:text-emerald-400' : ''}
                  ${col.className ?? ''}
                `}
              >
                {col.label}
                {col.sortKey && sortKey === col.sortKey && (
                  <span className="ml-1 text-emerald-400">
                    {sortAsc ? '↑' : '↓'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {jobs.map((job, idx) => {
            const isNew = newIds.has(job.id)
            return (
              <tr
                key={job.id}
                className={`
                  border-b border-slate-800/60 transition-colors
                  ${isNew
                    ? 'bg-emerald-950/20 hover:bg-emerald-950/40'
                    : 'hover:bg-slate-800/40'
                  }
                `}
              >
                {/* Title + company */}
                <td className="px-3 py-2.5 max-w-[260px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-slate-200 hover:text-emerald-400 transition-colors line-clamp-2"
                    >
                      {job.title}
                    </a>
                    {isNew && (
                      <span className="
                        inline-block bg-emerald-400 text-black
                        font-mono text-[0.55rem] font-bold
                        px-1.5 py-0.5 rounded
                      ">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {job.company || '—'}
                  </p>
                </td>

                {/* Location */}
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-slate-500 line-clamp-2">
                    {job.location || '—'}
                  </span>
                </td>

                {/* Commute */}
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="font-mono text-xs text-slate-500">
                    {job.commuteNote || '—'}
                  </span>
                </td>

                {/* Board */}
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-slate-500">
                    {job.board || '—'}
                  </span>
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => onCycle(idx)}
                    title="Click to advance status"
                    className={`
                      inline-flex items-center gap-1 px-2.5 py-1
                      rounded-full font-mono text-xs font-medium border
                      hover:brightness-125 transition-all active:scale-95
                      ${STATUS_COLORS[job.status]}
                    `}
                  >
                    {STATUS_ICONS[job.status]} {job.status}
                  </button>
                </td>

                {/* Applied date */}
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
                    {job.appliedDate || '—'}
                  </span>
                </td>

                {/* Notes preview */}
                <td className="px-3 py-2.5 max-w-[180px]">
                  <p
                    className="text-xs text-slate-500 truncate cursor-pointer hover:text-slate-300 transition-colors"
                    onClick={() => onEdit(idx)}
                    title={job.notes}
                  >
                    {job.notes || '—'}
                  </p>
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => onEdit(idx)}
                      className="
                        w-7 h-7 flex items-center justify-center rounded-md
                        border border-slate-700 text-slate-500 text-xs
                        hover:border-emerald-500 hover:text-emerald-400
                        transition-colors
                      "
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDelete(idx)}
                      className="
                        w-7 h-7 flex items-center justify-center rounded-md
                        border border-slate-700 text-slate-500 text-xs
                        hover:border-red-500 hover:text-red-400
                        transition-colors
                      "
                      title="Remove"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
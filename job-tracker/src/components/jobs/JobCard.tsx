// src/components/jobs/JobCard.tsx
import type { Job } from '../../types'
import { STATUS_ICONS, STATUS_COLORS } from '../../constants'

interface Props {
  job:      Job
  isNew:    boolean
  onEdit:   () => void
  onDelete: () => void
  onCycle:  () => void
}

export function JobCard({ job, isNew, onEdit, onDelete, onCycle }: Props) {
  return (
    <article className={`
      rounded-xl border px-4 sm:px-6 py-4 flex flex-col gap-3
      ${isNew
        ? 'bg-emerald-950/30 border-emerald-900/50'
        : 'bg-slate-900 border-slate-800'
      }
    `}>

      {/* ── Title row ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-100 hover:text-emerald-400 transition-colors line-clamp-2"
            >
              {job.title}
            </a>

            {/* NewPill — inlined, too small to warrant its own module */}
            {isNew && (
              <span className="
                inline-block bg-emerald-400 text-black
                font-mono text-[0.55rem] font-bold
                px-1.5 py-0.5 rounded
                animate-[pop_0.3s_ease]
              ">
                NEW
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {job.company || '—'}
          </p>
        </div>

        {/* Status badge — tap to cycle */}
        <button
          onClick={onCycle}
          title="Click to advance status"
          className={`
            shrink-0 inline-flex items-center gap-1
            px-2.5 py-1 rounded-full text-xs font-mono font-medium border
            hover:brightness-125 transition-all active:scale-95
            ${STATUS_COLORS[job.status]}
          `}
        >
          {STATUS_ICONS[job.status]} {job.status}
        </button>
      </div>

      {/* ── Meta grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-slate-500">
        {job.location && (
          <span className="col-span-1 sm:col-span-2 truncate">📍 {job.location}</span>
        )}
        {job.commuteNote && (
          <span className="col-span-1 sm:col-span-2 truncate">{job.commuteNote}</span>
        )}
        {job.board && (
          <span className="truncate">🏢 {job.board}</span>
        )}
        {job.appliedDate && (
          <span className="truncate">📅 {job.appliedDate}</span>
        )}
      </div>

      {/* ── Notes preview ── */}
      {job.notes && (
        <p
          className="text-xs text-slate-500 line-clamp-2 cursor-pointer hover:text-slate-300 transition-colors"
          onClick={onEdit}
        >
          {job.notes}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={onEdit}
          className="
            flex-1 py-1.5 rounded-lg text-xs font-mono
            border border-slate-700 text-slate-400
            hover:border-emerald-500 hover:text-emerald-400
            transition-colors active:scale-95
          "
        >
          ✏️ Edit
        </button>
        <button
          onClick={onDelete}
          className="
            flex-1 py-1.5 rounded-lg text-xs font-mono
            border border-slate-700 text-slate-400
            hover:border-red-500 hover:text-red-400
            transition-colors active:scale-95
          "
        >
          🗑 Remove
        </button>
      </div>
    </article>
  )
}
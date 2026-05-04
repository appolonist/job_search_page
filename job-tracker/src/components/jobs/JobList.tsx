// src/components/jobs/JobList.tsx
import { useState, useEffect } from 'react'
import type { Job } from '../../types'
import { JobCard }  from './JobCard'
import { JobTable } from './JobTable'

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

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  )

  useEffect(() => {
    const mq      = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isMobile
}

export function JobList({
  jobs, newIds, onEdit, onDelete, onCycle, onSort, sortKey, sortAsc,
}: Props) {
  const isMobile = useIsMobile()

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-sm font-mono">No jobs match your current view or filters.</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="px-4 sm:px-6 py-4 flex flex-col gap-3">
        {jobs.map((job, i) => (
          <JobCard
            key={job.id}
            job={job}
            isNew={newIds.has(job.id)}
            onEdit={()   => onEdit(i)}
            onDelete={()  => onDelete(i)}
            onCycle={()  => onCycle(i)}
          />
        ))}
      </div>
    )
  }

  return (
    <JobTable
      jobs={jobs}
      newIds={newIds}
      onEdit={onEdit}
      onDelete={onDelete}
      onCycle={onCycle}
      onSort={onSort}
      sortKey={sortKey}
      sortAsc={sortAsc}
    />
  )
}
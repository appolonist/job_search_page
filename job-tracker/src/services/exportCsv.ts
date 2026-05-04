// src/services/exportCsv.ts
import type { Job } from '../types'

export function exportCSV(jobs: Job[]): void {
  const header = 'Title,Company,Location,Board,Status,Applied Date,Next Step,Commute,URL,Notes'

  const rows = jobs.map(j =>
    [
      j.title, j.company, j.location, j.board,
      j.status, j.appliedDate, j.nextStep,
      j.commuteNote, j.url, j.notes,
    ]
      .map(v => `"${(v ?? '').replace(/"/g, '""')}"`)
      .join(','),
  )

  const csv  = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)

  const a = Object.assign(document.createElement('a'), {
    href:     url,
    download: `qa-applications-${new Date().toISOString().split('T')[0]}.csv`,
  })

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
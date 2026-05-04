// src/components/modals/HistoryModal.tsx
import type { Job, ScrapeEntry } from '../../types'
import { Modal } from './Modal'

interface Props {
  scrapeIndex:   ScrapeEntry[]
  importedFiles: Record<string, boolean>
  jobs:          Job[]
  onClose:       () => void
}

export function HistoryModal({ scrapeIndex, importedFiles, jobs, onClose }: Props) {
  return (
    <Modal title="📋 Scrape History" onClose={onClose} wide>
      {scrapeIndex.length === 0 ? (
        <p className="text-sm text-slate-500 font-mono text-center py-4">
          No scrape history yet. Run the scraper and push to GitHub.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {scrapeIndex.map(entry => {
            const imported      = importedFiles[entry.filename] ?? false
            const importedCount = jobs.filter(j => j.sourceFile === entry.filename).length

            return (
              <li
                key={entry.filename}
                className="
                  flex items-center justify-between gap-4
                  bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3
                "
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-200">
                    {entry.date}
                  </p>
                  <p className="font-mono text-xs text-slate-500 mt-0.5">
                    {entry.jobCount} jobs found by scraper
                  </p>
                </div>

                <div className={`shrink-0 font-mono text-xs font-medium ${imported ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {imported
                    ? `✅ ${importedCount} imported`
                    : '⏳ Not yet imported'
                  }
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
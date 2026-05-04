// src/components/ui/NewBanner.tsx

interface Props {
  newCount:     number
  totalNew:     number
  onShowNew:    () => void
  onShowAction: () => void
  onDismiss:    () => void
}

export function NewBanner({ newCount, totalNew, onShowNew, onShowAction, onDismiss }: Props) {
  return (
    <div className="
      flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3
      bg-gradient-to-r from-emerald-950/60 to-blue-950/60
      border-b border-emerald-800/50
    ">
      <p className="text-sm flex-1 min-w-0">
        <strong className="text-emerald-400">
          {newCount} new job{newCount !== 1 ? 's' : ''} found
        </strong>
        <span className="text-slate-400 ml-1">
          · {totalNew} total needing action
        </span>
      </p>

      <div className="flex gap-2 shrink-0">
        <button onClick={onShowNew}    className="btn-primary text-xs">Show new</button>
        <button onClick={onShowAction} className="btn-ghost   text-xs">Needs action</button>
        <button onClick={onDismiss}    className="btn-ghost   text-xs">✕</button>
      </div>
    </div>
  )
}
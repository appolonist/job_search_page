// src/components/ui/LoadingOverlay.tsx

interface Props {
  show:    boolean
  message: string
}

export function LoadingOverlay({ show, message }: Props) {
  if (!show) return null

  return (
    <div className="
      fixed inset-0 z-50 flex flex-col items-center justify-center gap-4
      bg-[#0d0f12]
    ">
      {/* Spinner */}
      <div className="
        w-9 h-9 rounded-full
        border-[3px] border-slate-800 border-t-emerald-400
        animate-spin
      " />
      <p className="font-mono text-sm text-slate-500">{message}</p>
    </div>
  )
}
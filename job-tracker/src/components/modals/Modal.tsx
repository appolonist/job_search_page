// src/components/modals/Modal.tsx
import { useEffect, type ReactNode } from 'react'

interface Props {
  title:    string
  onClose:  () => void
  children: ReactNode
  wide?:    boolean
}

export function Modal({ title, onClose, children, wide = false }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className={`
        relative w-full bg-slate-900 border border-slate-700 rounded-2xl
        shadow-2xl max-h-[90dvh] flex flex-col
        animate-[slideUp_0.2s_ease]
        ${wide ? 'max-w-xl' : 'max-w-md'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <h2 className="font-bold text-base text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {children}
        </div>
      </div>
    </div>
  )
}
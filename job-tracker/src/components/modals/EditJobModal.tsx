// src/components/modals/EditJobModal.tsx
import { useState } from 'react'
import type { Job } from '../../types'
import { STATUS_CYCLE } from '../../constants'
import { Modal } from './Modal'

interface Props {
  job?:    Job          // undefined = adding new
  onSave:  (job: Job) => void
  onClose: () => void
}

type FormData = Pick<Job,
  'title' | 'company' | 'location' | 'url' | 'board' |
  'status' | 'appliedDate' | 'nextStep' | 'notes'
>

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function EditJobModal({ job, onSave, onClose }: Props) {
  const isNew = !job

  const [form, setForm] = useState<FormData>({
    title:       job?.title       ?? '',
    company:     job?.company     ?? '',
    location:    job?.location    ?? '',
    url:         job?.url         ?? '',
    board:       job?.board       ?? '',
    status:      job?.status      ?? 'new',
    appliedDate: job?.appliedDate ?? '',
    nextStep:    job?.nextStep    ?? '',
    notes:       job?.notes       ?? '',
  })

  const [error, setError] = useState('')

  const set = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  function handleSave() {
    if (!form.title.trim()) { setError('Job title is required'); return }
    setError('')

    const saved: Job = {
      ...(job ?? {
        id:          uid(),
        addedAt:     new Date().toISOString(),
        commuteNote: '',
        searchTerm:  '',
        posted:      '',
      }),
      ...form,
    }

    onSave(saved)
  }

  return (
    <Modal title={isNew ? 'Add Job' : 'Edit Application'} onClose={onClose}>
      <Field label="Job Title">
        <input className="form-input" value={form.title} onChange={set('title')} placeholder="e.g. Software QA Automation Engineer" />
      </Field>

      <Field label="Company">
        <input className="form-input" value={form.company} onChange={set('company')} placeholder="Company name" />
      </Field>

      <Field label="Location">
        <input className="form-input" value={form.location} onChange={set('location')} placeholder="e.g. Manchester, UK" />
      </Field>

      <Field label="Job URL">
        <input className="form-input" type="url" value={form.url} onChange={set('url')} placeholder="https://…" />
      </Field>

      <Field label="Board">
        <input className="form-input" value={form.board} onChange={set('board')} placeholder="Reed, Indeed, Glassdoor…" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className="form-input" value={form.status} onChange={set('status')}>
            {STATUS_CYCLE.map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </Field>

        <Field label="Date Applied">
          <input className="form-input" type="date" value={form.appliedDate} onChange={set('appliedDate')} />
        </Field>
      </div>

      <Field label="Next Step / Interview Date">
        <input className="form-input" type="date" value={form.nextStep} onChange={set('nextStep')} />
      </Field>

      <Field label="Notes">
        <textarea
          className="form-input min-h-[80px] resize-y"
          value={form.notes}
          onChange={set('notes')}
          placeholder="Recruiter name, salary discussed, interview format…"
        />
      </Field>

      {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-1 border-t border-slate-800">
        <button onClick={onClose}   className="btn-ghost">Cancel</button>
        <button onClick={handleSave} className="btn-primary">Save</button>
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.65rem] font-mono uppercase tracking-widest text-slate-500">
        {label}
      </label>
      {children}
    </div>
  )
}
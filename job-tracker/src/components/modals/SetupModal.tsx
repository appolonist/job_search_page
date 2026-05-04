// src/components/modals/SetupModal.tsx
import { useState } from 'react'
import type { GitHubConfig } from '../../types'
import { Modal } from './Modal'

interface Props {
  initial?:     GitHubConfig
  envDefaults?: Partial<GitHubConfig>
  onSave:       (cfg: GitHubConfig) => void
  onClose:      () => void
}

export function SetupModal({ initial, envDefaults = {}, onSave, onClose }: Props) {
  const [form, setForm] = useState<GitHubConfig>({
    user:   initial?.user   ?? envDefaults.user   ?? '',
    repo:   initial?.repo   ?? envDefaults.repo   ?? '',
    branch: initial?.branch ?? envDefaults.branch ?? 'main',
    token:  initial?.token  ?? '',
  })
  const [error, setError] = useState('')

  const set = (key: keyof GitHubConfig) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  function handleSave() {
    if (!form.user || !form.repo || !form.token) {
      setError('Username, repository name, and token are all required.')
      return
    }
    setError('')
    onSave(form)
  }

  // Fields pre-filled from env vars are locked — prevents accidental changes
  const userLocked   = !!envDefaults.user   && !initial?.user
  const repoLocked   = !!envDefaults.repo   && !initial?.repo
  const branchLocked = !!envDefaults.branch && !initial?.branch

  return (
    <Modal title="⚙ GitHub Sync Settings" onClose={onClose} wide>
      <div className="
        bg-slate-800/60 border border-slate-700 rounded-xl
        px-4 py-3 text-xs font-mono text-slate-400 leading-relaxed
      ">
        <p>
          Tracker state is saved as{' '}
          <code className="text-emerald-400 bg-slate-900 px-1 rounded">
            tracker-state.json
          </code>{' '}
          in your GitHub repo so every device stays in sync.
        </p>
        <ol className="mt-2 ml-4 list-decimal space-y-1 text-slate-500">
          <li>
            Go to{' '}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline"
            >
              github.com/settings/tokens
            </a>
          </li>
          <li>
            Generate new token (classic) → tick{' '}
            <code className="bg-slate-900 px-1 rounded">repo</code>{' '}
            scope → copy it
          </li>
          <li>Paste below — stored only in this browser's localStorage</li>
          <li>Repeat on every device you use</li>
        </ol>
      </div>

      <div className="flex flex-col gap-3">
        <Field label="GitHub Username" locked={userLocked}>
          <input
            className="form-input disabled:opacity-50 disabled:cursor-not-allowed"
            value={form.user}
            onChange={set('user')}
            placeholder="yourusername"
            disabled={userLocked}
            autoComplete="off"
          />
        </Field>

        <Field label="Repository Name" locked={repoLocked}>
          <input
            className="form-input disabled:opacity-50 disabled:cursor-not-allowed"
            value={form.repo}
            onChange={set('repo')}
            placeholder="job_search_page"
            disabled={repoLocked}
            autoComplete="off"
          />
        </Field>

        <Field label="Branch" locked={branchLocked}>
          <input
            className="form-input disabled:opacity-50 disabled:cursor-not-allowed"
            value={form.branch}
            onChange={set('branch')}
            placeholder="main"
            disabled={branchLocked}
          />
        </Field>

        <Field label="Personal Access Token">
          <input
            className="form-input"
            type="password"
            value={form.token}
            onChange={set('token')}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            autoComplete="new-password"
          />
        </Field>
      </div>

      {error && (
        <p className="text-red-400 text-xs font-mono">{error}</p>
      )}

      <div className="flex gap-3 justify-end pt-1 border-t border-slate-800">
        <button onClick={onClose}    className="btn-ghost">Cancel</button>
        <button onClick={handleSave} className="btn-primary">Save &amp; Connect</button>
      </div>
    </Modal>
  )
}

function Field({
  label,
  locked = false,
  children,
}: {
  label:    string
  locked?:  boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[0.65rem] font-mono uppercase tracking-widest text-slate-500">
        {label}
        {locked && (
          <span className="text-emerald-600 normal-case tracking-normal">
            (set by deployment)
          </span>
        )}
      </label>
      {children}
    </div>
  )
}
// src/hooks/useConfig.ts
import { useState, useCallback } from 'react'
import type { GitHubConfig } from '../types'

const CFG_KEY = 'qa_gh_config'

// Defaults baked in at build time from VITE_ environment variables.
// These pre-fill the Setup modal so users only need to enter their token.
const ENV_DEFAULTS: Partial<GitHubConfig> = {
  user:   import.meta.env.VITE_GH_USER   ?? '',
  repo:   import.meta.env.VITE_GH_REPO   ?? '',
  branch: import.meta.env.VITE_GH_BRANCH ?? 'master',
}

function loadConfig(): GitHubConfig | null {
  try {
    const stored = localStorage.getItem(CFG_KEY)
    if (!stored) return null
    // Merge stored config with env defaults — stored values take priority
    return { ...ENV_DEFAULTS, ...JSON.parse(stored) } as GitHubConfig
  } catch {
    return null
  }
}

export function useConfig() {
  const [config, setConfigState] = useState<GitHubConfig | null>(loadConfig)

  const saveConfig = useCallback((cfg: GitHubConfig) => {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg))
    setConfigState(cfg)
  }, [])

  const clearConfig = useCallback(() => {
    localStorage.removeItem(CFG_KEY)
    setConfigState(null)
  }, [])

  // Expose env defaults so SetupModal can pre-fill fields
  const envDefaults = ENV_DEFAULTS

  return { config, saveConfig, clearConfig, envDefaults }
}
export type JobStatus =
  | 'new' | 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'

export interface Job {
  id:           string
  title:        string
  company:      string
  location:     string
  board:        string
  searchTerm:   string
  commuteNote:  string
  url:          string
  posted:       string
  status:       JobStatus
  appliedDate:  string
  nextStep:     string
  notes:        string
  addedAt:      string
  sourceFile?:  string
}

export interface ScrapeEntry {
  filename:  string
  date:      string
  jobCount:  number
}

export interface TrackerMeta {
  importedFiles: Record<string, boolean>
  lastNewIds:    string[]
  scrapeIndex:   ScrapeEntry[]
}

export interface TrackerState {
  jobs: Job[]
  meta: TrackerMeta
}

export interface GitHubConfig {
  user:   string
  repo:   string
  branch: string
  token:  string
}

export type TabId = 'needs-action' | 'new' | 'all' | 'applied' | 'interview'

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'
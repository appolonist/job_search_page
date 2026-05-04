// src/services/csvParser.ts
// Parses a CSV string into job objects.
// Encoding is handled upstream in github.ts using arrayBuffer + TextDecoder
// to guarantee UTF-8 decoding regardless of missing Content-Type headers.

import type { Job } from '../types'

type RawJob = Omit<Job,
  'id' | 'status' | 'appliedDate' | 'nextStep' | 'notes' | 'addedAt' | 'sourceFile'
>

export function parseCSV(text: string): RawJob[] {
  const lines  = text.trim().split('\n')
  if (lines.length < 2) return []

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  const col    = (name: string): number => header.indexOf(name)

  return lines
    .slice(1)
    .filter(line => line.trim().length > 0)
    .map(line => {
      const cells = parseCSVLine(line)
      const get   = (name: string): string => (cells[col(name)] ?? '').trim()

      return {
        title:       get('title'),
        company:     get('company'),
        location:    get('location'),
        board:       get('board'),
        searchTerm:  get('search term'),
        commuteNote: get('commute'),
        url:         get('url'),
        posted:      get('posted'),
      }
    })
    .filter(j => j.title.length > 0 && j.url.length > 0)
}

// Handles quoted fields including escaped quotes ("") correctly
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur  = ''
  let inQ  = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]

    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        // Escaped quote inside quoted field
        cur += '"'
        i++
      } else {
        inQ = !inQ
      }
    } else if (c === ',' && !inQ) {
      result.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }

  result.push(cur)
  return result
}
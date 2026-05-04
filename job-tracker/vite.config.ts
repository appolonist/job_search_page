/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// job-tracker/vite.config.ts
import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import tailwindcss      from '@tailwindcss/vite'
import path             from 'path'
import fs               from 'fs'

// ---------------------------------------------------------------------------
// Custom plugin: serves /output/ and /cache/ from the REPO ROOT (one level
// above job-tracker/) during both `vite dev` and `vite preview`.
//
// On GitHub Pages these folders are served as static files from the repo root
// so no special handling is needed there — this plugin only affects local dev.
// ---------------------------------------------------------------------------
function serveRepoRootFolders() {
  // Resolve the repo root — one directory above job-tracker/
  const repoRoot = path.resolve(__dirname, '..')

  return {
    name: 'serve-repo-root-folders',

    // Dev server middleware
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: { url?: string }, res: {
        setHeader: Function
        end: Function
        writeHead: Function
      }, next: Function) => {
        handleRepoRootRequest(req.url ?? '', repoRoot, res, next)
      })
    },

    // Preview server middleware (vite preview)
    configurePreviewServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: { url?: string }, res: {
        setHeader: Function
        end: Function
        writeHead: Function
      }, next: Function) => {
        handleRepoRootRequest(req.url ?? '', repoRoot, res, next)
      })
    },
  }
}

function handleRepoRootRequest(
  url:      string,
  repoRoot: string,
  res:      { setHeader: Function; end: Function; writeHead: Function },
  next:     Function,
) {
  // Strip base path and query string
  const stripped = url
    .replace(/^\/job_search_page/, '')
    .split('?')[0]

  // Only handle /output/ and /cache/ paths
  if (!stripped.startsWith('/output/') && !stripped.startsWith('/cache/')) {
    return next()
  }

  const filePath = path.join(repoRoot, stripped)

  if (!fs.existsSync(filePath)) {
    return next()
  }

  const ext = path.extname(filePath)
  const contentTypes: Record<string, string> = {
    '.json': 'application/json; charset=utf-8',
    '.csv':  'text/csv; charset=utf-8',        // ← explicit charset=utf-8
    '.html': 'text/html; charset=utf-8',
  }

  const contentType = contentTypes[ext] ?? 'application/octet-stream'

  // Read as Buffer (binary) and send — browser receives raw bytes
  // which our TextDecoder('utf-8') will decode correctly
  const data = fs.readFileSync(filePath)
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', 'no-cache')
  res.end(data)
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    serveRepoRootFolders(),
  ],

  base: '/job_search_page/',
})
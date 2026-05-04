// debug-encoding.js — run with: node debug-encoding.js
const fs   = require('fs')
const path = require('path')

// Find the most recent CSV
const outDir = path.join(__dirname, './')
const files  = fs.readdirSync(outDir)
  .filter(f => f.endsWith('.csv'))
  .sort()
  .reverse()

if (!files.length) { console.log('No CSV files found'); process.exit(1) }

const file = path.join(outDir, files[0])
console.log('Reading:', files[0])

// Read as raw buffer — no encoding assumption
const buf   = fs.readFileSync(file)
const lines = buf.toString('utf8').split('\n')

// Find first line with a commuteNote
const header = lines[0].split(',').map(h => h.replace(/"/g,'').toLowerCase().trim())
const commuteCol = header.indexOf('commute')
console.log('Commute column index:', commuteCol)

for (let i = 1; i < Math.min(lines.length, 20); i++) {
  const cells = lines[i].split(',')
  const commute = cells[commuteCol] || ''
  if (commute && commute !== '""' && commute !== '"—"') {
    console.log('\nLine', i, 'commuteNote:', commute)
    // Print the raw bytes
    const bytes = Buffer.from(commute.replace(/"/g,''), 'utf8')
    console.log('Raw bytes:', bytes)
    console.log('Byte hex:', bytes.toString('hex'))
    // Expected: 🚗 = f09f9a97, 🔀 = f09f9480, 🌐 = f09f8c90
    break
  }
}
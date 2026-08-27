import { readFileSync } from 'fs'
import { parseNoteHtml } from '../src/lib/note-format/parse'
import { serializeNoteDocument } from '../src/lib/note-format/serialize'

const root = process.cwd()
function read(name: string) {
  return readFileSync(`${root}/fixtures/${name}`, 'utf8')
}

console.log('=== minimal ===')
const min = parseNoteHtml(read('minimal.note.html'))
console.log('warnings:', min.warnings.length, min.warnings.map(w => `${w.code}:${w.message}`))
console.log('pages:', min.model.pages.length, 'blocks p0:', min.model.pages[0]?.blocks.length)
console.log('css contains q-card:', min.model.css.includes('q-card'))

console.log('\n=== full ===')
const full = parseNoteHtml(read('full.note.html'))
console.log('warnings:', full.warnings.length, full.warnings.map(w => `${w.code}:${w.message}`))
console.log('pages:', full.model.pages.length)

console.log('\n=== malicious ===')
const mal = parseNoteHtml(read('malicious.note.html'))
console.log('warnings:', mal.warnings.length)
const s = JSON.stringify(mal.model)
const checks: [string, boolean][] = [
  ['no <script>', !/<script/i.test(s)],
  ['no on* handlers', !/\son[a-z]+\s*=/i.test(s)],
  ['no javascript:', !/javascript\s*:/i.test(s)],
  ['no data:text/html', !/data:text\/html/i.test(s)],
  ['no evil.com', !/evil\.com/i.test(s)],
  ['no @import', !/@import/i.test(s)],
  ['no position:fixed', !/position:\s*fixed/i.test(s)],
  ['no <!-- comments', !/<!--/.test(s)],
  ['css has #b91c1c (.mf-q survived)', mal.model.css.includes('#b91c1c')],
]
for (const [name, ok] of checks) console.log(ok ? '  PASS' : '  FAIL', name)

const q1 = mal.model.pages[0].blocks.find(b => b.type === 'question' && b.number === 1) as any
console.log('q1 exists:', !!q1)
if (q1) {
  const plain = plainText(q1)
  console.log('q1 plain text:', JSON.stringify(plain.slice(0, 120)))
  console.log('q1 plain contains "Output encoding":', plain.includes('Output encoding'))
  const diag = q1.children.find((c: any) => c.type === 'diagram')
  console.log('q1 mermaid source contains "Sanitize":', diag?.source?.includes('Sanitize'))
}
const svgDiag = mal.model.pages[0].blocks.find((b: any) => b.type === 'diagram') as any
console.log('svg source has <rect:', svgDiag?.source?.includes('<rect'))
console.log('svg source has linearGradient (full fixture):', parseNoteHtml(read('full.note.html')).model.pages[1].blocks.find((b:any)=>b.type==='diagram'&&b.diagramType==='svg')?.source?.includes('linearGradient'))
console.log('svg source has Safe text:', svgDiag?.source?.includes('Safe text'))
console.log('svg source has NO xlink:href:', !svgDiag?.source?.includes('xlink:href'))

function plainText(block: any): string {
  if (!block) return ''
  if (block.type === 'list') return block.items.map((i:any)=>i.html).join(' ')
  if (block.children) return block.children.map(plainText).join(' ')
  return block.html || block.text || ''
}

console.log('\n=== round-trip minimal ===')
const rt = parseNoteHtml(serializeNoteDocument(min.model))
console.log('re-parse warnings:', rt.warnings.length)
console.log('title match:', rt.model.title === min.model.title)
console.log('pages match:', rt.model.pages.length === min.model.pages.length)
console.log('css match:', rt.model.css === min.model.css)

console.log('\n=== round-trip full ===')
const rt2 = parseNoteHtml(serializeNoteDocument(full.model))
console.log('re-parse warnings:', rt2.warnings.length)
console.log('pages match:', rt2.model.pages.length === full.model.pages.length)

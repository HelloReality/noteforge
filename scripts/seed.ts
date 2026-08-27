// NoteForge — seed script
// Imports the three fixtures through the import pipeline so the app has
// demo documents on first run. Idempotent: skips fixtures whose title
// already exists in the documents table.
//
// Run: `bun run scripts/seed.ts`
//
// Reads fixtures from `fixtures/*.note.html` (byte-for-byte, never modified).

import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from '../src/lib/db'
import { importNoteHtml } from '../src/lib/server/import-pipeline'
import { listDocuments } from '../src/lib/server/storage'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const FIXTURES = [
  'fixtures/minimal.note.html',
  'fixtures/full.note.html',
  'fixtures/malicious.note.html',
] as const

async function main() {
  console.log('NoteForge — seed: starting.')
  const existing = await listDocuments()
  const existingTitles = new Set(existing.map((d) => d.title))
  console.log(`Existing documents: ${existing.length}`)

  const created: { filename: string; title: string; slug: string; documentId: string; warnings: number }[] = []
  const skipped: { filename: string; title: string }[] = []

  for (const rel of FIXTURES) {
    const abs = resolve(ROOT, rel)
    let text: string
    try {
      text = await readFile(abs, 'utf8')
    } catch (err) {
      console.error(`  ! could not read ${rel}:`, err instanceof Error ? err.message : err)
      continue
    }

    // Determine title ahead of time so we can short-circuit idempotently
    // without doing the full import. The parser's title rule:
    //   data-title attr > <title> tag > 'Untitled'.
    const titleMatch =
      text.match(/<note-document\b[^>]*\bdata-title="([^"]*)"[^>]*>/i) ||
      text.match(/<title>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : 'Untitled'

    if (existingTitles.has(title)) {
      console.log(`  • skip  (already present): ${rel}  →  "${title}"`)
      skipped.push({ filename: rel, title })
      continue
    }

    try {
      const res = await importNoteHtml(rel, text)
      // Re-fetch the slug so we can report it back.
      const doc = await db.document.findUnique({
        where: { id: res.documentId },
        select: { slug: true },
      })
      const slug = doc?.slug ?? ''
      console.log(
        `  ✓ seeded ${rel} → "${res.title}"  (id=${res.documentId}, slug="${slug}", warnings=${res.warnings.length})`,
      )
      created.push({
        filename: rel,
        title: res.title,
        slug,
        documentId: res.documentId,
        warnings: res.warnings.length,
      })
    } catch (err) {
      console.error(
        `  ! failed to import ${rel}:`,
        err instanceof Error ? `${err.name}: ${err.message}` : err,
      )
    }
  }

  console.log('')
  console.log(`Seed done. Created ${created.length}, skipped ${skipped.length}.`)
  for (const c of created) {
    console.log(`  - "${c.title}"  slug="${c.slug}"  id=${c.documentId}  warnings=${c.warnings}`)
  }

  await db.$disconnect()
}

main().catch(async (err) => {
  console.error('Seed failed:', err)
  await db.$disconnect()
  process.exit(1)
})

// NoteForge — GET /api/documents/:id/versions and POST /api/documents/:id/versions (§8)
// GET lists every version (number, note, warningCount, createdAt).
// POST appends a new version from body `{ model: NoteDocument, note?: string }`.
// `model` is the already-sanitized NoteDocument JSON from the editor — we
// store it as-is (the editor is responsible for not introducing unsanitized
// inline HTML; §10 says "sanitizer runs on import and on every save", which
// for the editor path means the editor applies sanitization before submit).

import { NextResponse } from 'next/server'
import { listVersions, saveVersion, DocumentNotFoundError } from '@/lib/server/storage'
import type { NoteDocument } from '@/lib/note-format/types'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const versions = await listVersions(id)
  return NextResponse.json(versions)
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const payload = body as { model?: unknown; note?: unknown }

  // Minimal shape validation for the NoteDocument model.
  const model = payload.model
  if (
    !model ||
    typeof model !== 'object' ||
    typeof (model as { title?: unknown }).title !== 'string' ||
    typeof (model as { version?: unknown }).version !== 'string' ||
    typeof (model as { css?: unknown }).css !== 'string' ||
    !Array.isArray((model as { pages?: unknown }).pages)
  ) {
    return NextResponse.json(
      { error: 'model must be a NoteDocument ({title, version, css, pages[]})' },
      { status: 400 },
    )
  }
  const note = typeof payload.note === 'string' ? payload.note : undefined

  try {
    const result = await saveVersion(id, model as NoteDocument, note)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof DocumentNotFoundError) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

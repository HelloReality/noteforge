// NoteForge — POST /api/import (§8, §9)
// Accepts a `.note.html` upload as either multipart/form-data (field `file`)
// or a JSON body `{ html: string }`. Runs the import pipeline and returns the
// new document + version IDs along with the parsed warnings and detected title.

import { NextResponse } from 'next/server'
import { importNoteHtml, ImportError } from '@/lib/server/import-pipeline'

export const runtime = 'nodejs'

/** Try to read text from a multipart `file` field, then fall back to JSON `{ html }`. */
async function readImportText(req: Request): Promise<{ text: string; filename: string } | null> {
  const ct = req.headers.get('content-type') || ''
  if (ct.toLowerCase().includes('multipart/form-data')) {
    try {
      const form = await req.formData()
      const file = form.get('file')
      if (file instanceof File) {
        return { text: await file.text(), filename: file.name || 'upload.note.html' }
      }
      // Some clients send the raw text under `file` as a string field.
      if (typeof file === 'string' && file.length > 0) {
        return { text: file, filename: 'upload.note.html' }
      }
    } catch {
      // fall through to JSON attempt
    }
  }
  // Try JSON `{ html }`.
  try {
    const body = (await req.json()) as { html?: unknown }
    if (typeof body.html === 'string' && body.html.length > 0) {
      return { text: body.html, filename: 'body.note.html' }
    }
  } catch {
    // not JSON
  }
  return null
}

export async function POST(req: Request) {
  const payload = await readImportText(req)
  if (!payload) {
    return NextResponse.json(
      { error: 'No file or html body provided. Send multipart/form-data with a `file` field, or JSON `{ html: string }`.' },
      { status: 400 },
    )
  }

  try {
    const result = await importNoteHtml(payload.filename, payload.text)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof ImportError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Unknown import error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

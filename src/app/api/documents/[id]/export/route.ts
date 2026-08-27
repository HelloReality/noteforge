// NoteForge — GET /api/documents/:id/export — download the latest version as a .note.html file.

import { NextResponse } from 'next/server'
import { getDocumentWithLatest } from '@/lib/server/storage'
import { serializeNoteDocument } from '@/lib/note-format/serialize'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const data = await getDocumentWithLatest(id)
  if (!data || !data.model) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  const html = serializeNoteDocument(data.model)
  const safeName = (data.title || 'note')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'note'
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.note.html"`,
      'Cache-Control': 'no-store',
    },
  })
}

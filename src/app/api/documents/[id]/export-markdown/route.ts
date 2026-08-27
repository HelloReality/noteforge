// NoteForge — GET /api/documents/:id/export-markdown — download as .md file.

import { NextResponse } from 'next/server'
import { getDocumentWithLatest } from '@/lib/server/storage'
import { serializeToMarkdown } from '@/lib/note-format/markdown'

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
  const md = serializeToMarkdown(data.model)
  const safeName = (data.title || 'note')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'note'
  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}.md"`,
      'Cache-Control': 'no-store',
    },
  })
}

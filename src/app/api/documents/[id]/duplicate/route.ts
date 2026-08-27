// NoteForge — POST /api/documents/:id/duplicate — clone a document (latest version).

import { NextResponse } from 'next/server'
import { duplicateDocument, DocumentNotFoundError } from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    const result = await duplicateDocument(id)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof DocumentNotFoundError) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

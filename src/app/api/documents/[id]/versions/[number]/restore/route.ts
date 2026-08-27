// NoteForge — POST /api/documents/:id/versions/:number/restore
// Creates a NEW version (append-only) from an old version's model + warnings.

import { NextResponse } from 'next/server'
import { restoreVersion, DocumentNotFoundError } from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; number: string }> },
) {
  const { id, number: numberStr } = await ctx.params
  const number = parseInt(numberStr, 10)
  if (!Number.isFinite(number) || number < 1) {
    return NextResponse.json({ error: 'Invalid version number' }, { status: 400 })
  }
  try {
    const result = await restoreVersion(id, number)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof DocumentNotFoundError) {
      return NextResponse.json({ error: 'Document or version not found' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

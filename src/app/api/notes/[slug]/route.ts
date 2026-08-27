// NoteForge — GET /api/notes/:slug (§8, §15)
// Public SSR-data fetch. Returns the latest version's model + warnings for a
// document whose status === 'published'. 404 otherwise.

import { NextResponse } from 'next/server'
import { getPublishedBySlug } from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const found = await getPublishedBySlug(slug)
  if (!found) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }
  return NextResponse.json({
    model: found.model,
    title: found.document.title,
    document: found.document,
  })
}

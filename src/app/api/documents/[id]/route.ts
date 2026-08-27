// NoteForge — GET /api/documents/:id and PATCH /api/documents/:id (§8)
// GET returns the full document + latest version (parsed model + warnings).
// PATCH updates title / slug / status (status validated ∈ draft|review|published).

import { NextResponse } from 'next/server'
import {
  getDocumentWithLatest,
  updateDocumentMeta,
  StatusValidationError,
} from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const doc = await getDocumentWithLatest(id)
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }
  return NextResponse.json(doc)
}

export async function PATCH(
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
  const patch = body as { title?: unknown; slug?: unknown; status?: unknown }
  const clean: { title?: string; slug?: string; status?: string } = {}
  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string' || patch.title.trim().length === 0) {
      return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 })
    }
    clean.title = patch.title.trim()
  }
  if (patch.slug !== undefined) {
    if (typeof patch.slug !== 'string' || patch.slug.trim().length === 0) {
      return NextResponse.json({ error: 'slug must be a non-empty string' }, { status: 400 })
    }
    clean.slug = patch.slug.trim()
  }
  if (patch.status !== undefined) {
    if (typeof patch.status !== 'string') {
      return NextResponse.json({ error: 'status must be a string' }, { status: 400 })
    }
    clean.status = patch.status
  }

  try {
    const updated = await updateDocumentMeta(id, clean)
    if (!updated) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof StatusValidationError) {
      return NextResponse.json(
        { error: `Invalid status: ${err.value}. Must be one of draft|review|published.` },
        { status: 400 },
      )
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// NoteForge — POST /api/documents/batch — bulk status update or bulk delete.

import { NextResponse } from 'next/server'
import { batchUpdateStatus, batchDeleteDocuments, StatusValidationError } from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { action, ids, status } = body as { action?: unknown; ids?: unknown; status?: unknown }

  if (action !== 'updateStatus' && action !== 'delete') {
    return NextResponse.json({ error: 'action must be "updateStatus" or "delete"' }, { status: 400 })
  }
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'ids must be an array of strings' }, { status: 400 })
  }
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids must not be empty' }, { status: 400 })
  }

  try {
    let result
    if (action === 'updateStatus') {
      if (typeof status !== 'string') {
        return NextResponse.json({ error: 'status is required for updateStatus action' }, { status: 400 })
      }
      result = await batchUpdateStatus(ids, status)
    } else {
      result = await batchDeleteDocuments(ids)
    }
    return NextResponse.json(result, { status: 200 })
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

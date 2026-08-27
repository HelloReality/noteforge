// NoteForge — GET /api/search?q=<query> — full-text search across document content.

import { NextResponse } from 'next/server'
import { searchDocumentContent } from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20))

  if (!q.trim()) {
    return NextResponse.json({ results: [], total: 0, query: '' })
  }

  const results = await searchDocumentContent(q, limit)
  return NextResponse.json({
    results,
    total: results.length,
    totalMatches: results.reduce((sum, r) => sum + r.totalMatches, 0),
    query: q,
  })
}

// NoteForge — GET /api/documents (§8)
// Returns the library list: id, title, slug, status, updatedAt, versionCount,
// latestVersionNumber.

import { NextResponse } from 'next/server'
import { listDocuments } from '@/lib/server/storage'

export const runtime = 'nodejs'

export async function GET() {
  const rows = await listDocuments()
  return NextResponse.json(rows)
}

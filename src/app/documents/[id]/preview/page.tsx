// NoteForge — fullscreen preview page: shows the note in public rendering mode
// without editor chrome. Includes reading progress, TOC, print, and share actions.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getDocumentWithLatest } from '@/lib/server/storage'
import { NoteRenderer } from '@/components/renderer'
import { ReadingProgress } from '@/components/app/ReadingProgress'
import { PublicViewerActions } from '@/components/app/PublicViewerActions'
import { TableOfContents } from '@/components/app/TableOfContents'
import { serializeToMarkdown } from '@/lib/note-format/markdown'
import { ArrowLeft, Pencil } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const data = await getDocumentWithLatest(id)
  if (!data) return { title: 'Preview — NoteForge' }
  return { title: `Preview: ${data.title} — NoteForge` }
}

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getDocumentWithLatest(id)
  if (!data || !data.model) notFound()

  return (
    <div className="min-h-screen flex flex-col">
      <ReadingProgress />
      <div className="no-print border-b border-stone-200 bg-stone-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/documents/${id}/edit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Editor</span>
            </Link>
            <span className="text-stone-300">/</span>
            <h1 className="truncate text-sm font-semibold text-stone-800">{data.title}</h1>
            <span className="hidden rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500 sm:inline">
              preview mode
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/documents/${id}/edit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-500 px-3 text-sm font-medium text-white transition hover:bg-amber-600"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </Link>
            <a
              href={`/api/documents/${id}/export-markdown`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-600 transition hover:bg-stone-50"
            >
              .md
            </a>
          </div>
        </div>
      </div>

      <div id="noteforge-note-content" className="flex-1 bg-stone-100">
        <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8">
          <div className="min-w-0 flex-1">
            <NoteRenderer doc={data.model} mode="public" />
          </div>
          <TableOfContents />
        </div>
      </div>

      <div className="no-print border-t border-stone-200 bg-stone-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-stone-400">
          <span>Public rendering preview — this is how the note looks when published.</span>
          <span>visual-notes/1 · Shared Renderer</span>
        </div>
      </div>
    </div>
  )
}

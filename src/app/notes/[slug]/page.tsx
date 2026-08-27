// NoteForge — public viewer (§15.2): SSR, semantic rendering, clean URLs.
// Includes reading-progress indicator, print/PDF export, copy-link action.
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublishedBySlug } from '@/lib/server/storage'
import { NoteRenderer } from '@/components/renderer'
import { ReadingProgress } from '@/components/app/ReadingProgress'
import { PublicViewerActions } from '@/components/app/PublicViewerActions'
import { TableOfContents } from '@/components/app/TableOfContents'
import { ShieldCheck, FileWarning, Globe } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getPublishedBySlug(slug)
  if (!data) return { title: 'Note not found — NoteForge' }
  return {
    title: `${data.document.title} — NoteForge`,
    description: `Visual notes published with NoteForge.`,
    openGraph: { title: data.document.title, type: 'article' },
  }
}

export default async function PublicNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getPublishedBySlug(slug)
  if (!data) notFound()

  const updated = new Date(data.document.updatedAt)

  return (
    <div className="min-h-screen flex flex-col">
      <ReadingProgress />
      <div className="no-print border-b border-stone-200 bg-stone-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">{data.document.title}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
              <Globe className="h-3.5 w-3.5" />
              Published · last updated {updated.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Sanitized &amp; safe
              </span>
              {data.warnings.length > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
                  <FileWarning className="h-3.5 w-3.5" /> {data.warnings.length} warnings on import
                </span>
              )}
            </div>
            <PublicViewerActions slug={slug} title={data.document.title} />
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
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-stone-500 sm:flex-row">
          <p>
            Powered by{' '}
            <Link href="/" className="font-semibold text-amber-700 hover:underline">NoteForge</Link>
            {' '}· visual-notes/1
          </p>
          <p className="text-stone-400">Rendered with the Shared Renderer · semantic public mode</p>
        </div>
      </div>
    </div>
  )
}

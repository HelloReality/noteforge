// NoteForge — Library / Dashboard (§8, §15)
// Server component. Lists all imported documents as cards with quick actions.

import Link from 'next/link'
import { listDocuments } from '@/lib/server/storage'
import { getPublishedSlugs } from '@/lib/server/storage'
import { AppEmptyState } from '@/components/app/AppEmptyState'
import { DocumentCard } from '@/components/app/DocumentCard'
import { FileText, Upload, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const docs = await listDocuments()
  const publishedSlugs = new Set(await getPublishedSlugs())

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Library</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">Your visual notes</h1>
        <p className="mt-2 max-w-2xl text-stone-600">
          Import <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm">.note.html</code> files, review the
          sanitized model &amp; warnings, edit block-by-block with undo/redo, version your work, and publish
          to a clean URL.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/import"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
          >
            <Upload className="h-4 w-4" /> Import a note
          </Link>
          {docs.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-600">
              <FileText className="h-4 w-4" /> {docs.length} document{docs.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </section>

      {docs.length === 0 ? (
        <AppEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <DocumentCard key={d.id} doc={d} published={publishedSlugs.has(d.slug)} />
          ))}
        </div>
      )}

      <section className="mt-12 rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 text-stone-800">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-sm font-semibold">Security-first import</h2>
        </div>
        <p className="mt-1.5 text-sm text-stone-600">
          Every upload runs through a strict sanitizer: scripts, iframes, forms, external resources,
          <code className="mx-1 rounded bg-stone-100 px-1 text-xs">javascript:</code> schemes and
          dangerous CSS are neutralized — while your legitimate content survives byte-for-byte.
        </p>
      </section>
    </div>
  )
}

// NoteForge — Library / Dashboard (§8, §15)
// Server component. Hero + stats + search/filter/sort + document grid.

import Link from 'next/link'
import { listDocuments, getPublishedSlugs, getDocumentStats, type DocumentListRow } from '@/lib/server/storage'
import { AppEmptyState } from '@/components/app/AppEmptyState'
import { LibraryClient, type LibraryDoc } from '@/components/app/LibraryClient'
import { Upload, ShieldCheck, FileText, Globe, Layers } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const docs = await listDocuments()
  const publishedSlugs = await getPublishedSlugs()

  // batch-fetch stats for every document (fine for small libraries)
  const statsPromises = docs.map((d) => getDocumentStats(d.id).catch(() => null))
  const statsResults = await Promise.all(statsPromises)
  const libraryDocs: LibraryDoc[] = docs.map((d, i) => ({ ...d, stats: statsResults[i] }))

  const publishedCount = docs.filter((d) => d.status === 'published').length
  const reviewCount = docs.filter((d) => d.status === 'review').length
  const draftCount = docs.filter((d) => d.status === 'draft').length
  const totalVersions = docs.reduce((sum, d) => sum + d.versionCount, 0)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Hero */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-amber-50 via-white to-stone-50 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              visual-notes/1
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Your visual notes
            </h1>
            <p className="mt-2 text-stone-600">
              Import <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm">.note.html</code> files,
              sanitize, edit block-by-block with undo/redo, and publish to clean URLs. One Shared Renderer
              for editor, preview &amp; public.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/import"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 hover:shadow"
              >
                <Upload className="h-4 w-4" /> Import a note
              </Link>
              {docs.length > 0 && (
                <div className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm text-stone-600">
                  <FileText className="h-4 w-4" /> {docs.length} document{docs.length === 1 ? '' : 's'} · {totalVersions} versions
                </div>
              )}
            </div>
          </div>

          {/* Stat tiles */}
          {docs.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:gap-3">
              <StatTile icon={<Globe className="h-4 w-4" />} value={publishedCount} label="published" tone="emerald" />
              <StatTile icon={<ShieldCheck className="h-4 w-4" />} value={reviewCount} label="in review" tone="amber" />
              <StatTile icon={<Layers className="h-4 w-4" />} value={draftCount} label="drafts" tone="stone" />
            </div>
          )}
        </div>
      </section>

      {docs.length === 0 ? (
        <AppEmptyState />
      ) : (
        <LibraryClient docs={libraryDocs} publishedSlugs={publishedSlugs} />
      )}

      {/* Security callout */}
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

function StatTile({ icon, value, label, tone }: {
  icon: React.ReactNode
  value: number
  label: string
  tone: 'emerald' | 'amber' | 'stone'
}) {
  const styles = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    stone: 'border-stone-200 bg-stone-50 text-stone-600',
  }[tone]
  return (
    <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${styles}`}>
      <span className="opacity-70">{icon}</span>
      <div className="flex flex-col">
        <span className="text-lg font-bold leading-none">{value}</span>
        <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      </div>
    </div>
  )
}

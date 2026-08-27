// NoteForge — Library / Dashboard (§8, §15)
// Server component. Hero + stats + search/filter/sort + document grid.

import Link from 'next/link'
import { listDocuments, getPublishedSlugs, getDocumentStats, listRecentDocuments, type DocumentListRow } from '@/lib/server/storage'
import { AppEmptyState } from '@/components/app/AppEmptyState'
import { LibraryClient, type LibraryDoc } from '@/components/app/LibraryClient'
import { RecentlyViewed } from '@/components/app/RecentlyViewed'
import { Upload, ShieldCheck, FileText, Globe, Layers, Search, Clock, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const docs = await listDocuments()
  const publishedSlugs = await getPublishedSlugs()
  const recentDocs = await listRecentDocuments(5)

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
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
                >
                  <Search className="h-4 w-4" /> Search content
                </Link>
              )}
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

      {/* Recently viewed (client-side, localStorage) */}
      {docs.length > 0 && <RecentlyViewed />}

      {docs.length === 0 ? (
        <AppEmptyState />
      ) : (
        <LibraryClient docs={libraryDocs} publishedSlugs={publishedSlugs} />
      )}

      {/* Recently edited */}
      {docs.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
              <Clock className="h-4 w-4" /> Recently edited
            </h2>
            <Link href="/search" className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline">
              Search all →
            </Link>
          </div>
          <RecentDocuments docs={recentDocs} publishedSlugs={publishedSlugs} />
        </section>
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

function RecentDocuments({ docs, publishedSlugs }: { docs: DocumentListRow[]; publishedSlugs: string[] }) {
  const publishedSet = new Set(publishedSlugs)
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((d) => {
        const published = publishedSet.has(d.slug)
        const updated = new Date(d.updatedAt)
        return (
          <Link
            key={d.id}
            href={`/documents/${d.id}/edit`}
            className="group flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 transition hover:border-amber-300 hover:bg-amber-50/40"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
              d.status === 'published' ? 'bg-emerald-100 text-emerald-700' :
              d.status === 'review' ? 'bg-amber-100 text-amber-700' :
              'bg-stone-100 text-stone-600'
            }`}>
              v{d.latestVersionNumber ?? 0}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-800 group-hover:text-amber-700">{d.title}</p>
              <p className="text-xs text-stone-400">{formatRelative(updated)}</p>
            </div>
            {published && (
              <Globe className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Published" />
            )}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-300 transition group-hover:text-amber-500" />
          </Link>
        )
      })}
    </div>
  )
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return date.toLocaleDateString()
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

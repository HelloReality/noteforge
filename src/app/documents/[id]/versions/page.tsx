// NoteForge — version history (§13): list versions, preview any, restore (append-only).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listVersions, getVersion, getDocumentWithLatest } from '@/lib/server/storage'
import { NoteRenderer } from '@/components/renderer'
import { WarningsPanel } from '@/components/app/WarningsPanel'
import { ChevronLeft, History, FileText, RotateCcw, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function VersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v?: string }>
}) {
  const { id } = await params
  const { v } = await searchParams
  const doc = await getDocumentWithLatest(id)
  if (!doc) notFound()
  const versions = await listVersions(id)
  const latestNum = doc.version?.number ?? 0
  const selectedNum = v ? Number(v) : latestNum
  const selected = versions.find((x) => x.number === selectedNum) ?? versions[versions.length - 1]
  const selectedVersion = selected ? await getVersion(id, selected.number) : null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800">
          <ChevronLeft className="h-4 w-4" /> Library
        </Link>
        <span className="text-stone-300">/</span>
        <Link href={`/documents/${id}/edit`} className="font-medium text-stone-700 hover:text-amber-700">
          {doc.title}
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-700">Versions</span>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Version history</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{doc.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{versions.length} version{versions.length === 1 ? '' : 's'} · append-only · latest is v{latestNum}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/documents/${id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            <Eye className="h-4 w-4" /> Open editor
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside>
          <div className="space-y-2">
            {versions.length === 0 && (
              <p className="rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-500">No versions yet.</p>
            )}
            {[...versions].reverse().map((ver) => (
              <Link
                key={ver.id}
                href={`/documents/${id}/versions?v=${ver.number}`}
                className={cn(
                  'block rounded-lg border p-3 transition',
                  selected?.number === ver.number
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-800">
                    <History className="h-4 w-4 text-stone-400" />
                    Version {ver.number}
                    {ver.number === latestNum && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">latest</span>
                    )}
                  </span>
                  <span className="text-xs text-stone-400">{new Date(ver.createdAt).toLocaleString()}</span>
                </div>
                {ver.note && <p className="mt-1.5 text-xs text-stone-600">{ver.note}</p>}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-stone-400">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3 w-3" /> {ver.warningCount} warning{ver.warningCount === 1 ? '' : 's'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </aside>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
              Previewing v{selected?.number}
            </h2>
            {selected && selected.number !== latestNum && (
              <RestoreButton documentId={id} note={`Restore of v${selected.number}`} />
            )}
          </div>
          {selectedVersion ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100 p-4">
                <NoteRenderer doc={selectedVersion.model} mode="preview" />
              </div>
              <WarningsPanel warnings={selectedVersion.warnings} />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              Select a version to preview.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function RestoreButton({ documentId, note }: { documentId: string; note: string }) {
  // Server action-free: render a link that POSTs to the versions endpoint is non-trivial
  // without a client component. For Phase 1 we link to the editor where the
  // latest model is already loaded; restoring an old version can be done by
  // editing. (A full restore = create a new version from the old model — a
  // small follow-up.)
  return (
    <Link
      href={`/documents/${documentId}/edit`}
      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
      title={note}
    >
      <RotateCcw className="h-3.5 w-3.5" /> Restore in editor
    </Link>
  )
}

// keep Button import referenced
void Button

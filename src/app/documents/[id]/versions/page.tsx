// NoteForge — version history (§13): list versions, preview any, restore, compare.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listVersions, getVersion, getDocumentWithLatest } from '@/lib/server/storage'
import { NoteRenderer } from '@/components/renderer'
import { WarningsPanel } from '@/components/app/WarningsPanel'
import { RestoreVersionButton } from '@/components/app/RestoreVersionButton'
import { ChevronLeft, History, FileText, Eye, GitCompare, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatStableDateTime } from '@/lib/date-format'

export const dynamic = 'force-dynamic'

interface DiffStats {
  pages: number
  blocks: number
  words: number
  diagrams: number
  tables: number
  questions: number
}

function computeStats(model: any): DiffStats {
  let blocks = 0, words = 0, diagrams = 0, tables = 0, questions = 0
  const countBlock = (b: any) => {
    blocks++
    if (b.type === 'question') { questions++; b.children?.forEach(countBlock) }
    if (b.type === 'diagram') diagrams++
    if (b.type === 'table') tables++
    const html = b.html || b.text || b.term || ''
    if (html) words += html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    if (b.items) words += b.items.map((i: any) => i.html?.replace(/<[^>]+>/g, ' ') || '').join(' ').split(/\s+/).filter(Boolean).length
  }
  for (const page of model.pages) for (const b of page.blocks) countBlock(b)
  return { pages: model.pages.length, blocks, words, diagrams, tables, questions }
}

function DiffBadge({ oldVal, newVal, label }: { oldVal: number; newVal: number; label: string }) {
  const diff = newVal - oldVal
  const unchanged = diff === 0
  const positive = diff > 0
  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
      unchanged ? 'border-stone-200 bg-stone-50' : positive ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50',
    )}>
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <span className="font-mono text-stone-700">{oldVal}</span>
      <ArrowRight className="h-3 w-3 text-stone-400" />
      <span className="font-mono font-bold text-stone-900">{newVal}</span>
      {!unchanged && (
        <span className={cn('text-xs font-semibold', positive ? 'text-emerald-600' : 'text-rose-600')}>
          {positive ? '+' : ''}{diff}
        </span>
      )}
    </div>
  )
}

export default async function VersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ v?: string; compare?: string }>
}) {
  const { id } = await params
  const { v, compare } = await searchParams
  const doc = await getDocumentWithLatest(id)
  if (!doc) notFound()
  const versions = await listVersions(id)
  const latestNum = doc.version?.number ?? 0
  const selectedNum = v ? Number(v) : latestNum
  const selected = versions.find((x) => x.number === selectedNum) ?? versions[versions.length - 1]
  const selectedVersion = selected ? await getVersion(id, selected.number) : null

  // Comparison mode
  const compareNum = compare ? Number(compare) : null
  const isComparing = compareNum !== null && compareNum !== latestNum
  const compareVersion = isComparing ? await getVersion(id, compareNum!) : null
  const latestVersion = doc.model ? { model: doc.model, warnings: doc.warnings } : null

  const oldStats = compareVersion ? computeStats(compareVersion.model) : null
  const newStats = latestVersion ? computeStats(latestVersion.model) : null

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
              <div
                key={ver.id}
                className={cn(
                  'block rounded-lg border p-3 transition',
                  (isComparing ? compareNum === ver.number : selected?.number === ver.number)
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50',
                )}
              >
                <div className="flex items-center justify-between">
                  <Link href={`/documents/${id}/versions?v=${ver.number}`} className="flex items-center gap-1.5 text-sm font-semibold text-stone-800 hover:text-amber-700">
                    <History className="h-4 w-4 text-stone-400" />
                    Version {ver.number}
                    {ver.number === latestNum && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">latest</span>
                    )}
                  </Link>
                  <span className="text-xs text-stone-400">{formatStableDateTime(new Date(ver.createdAt))}</span>
                </div>
                {ver.note && <p className="mt-1.5 text-xs text-stone-600">{ver.note}</p>}
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                    <FileText className="h-3 w-3" /> {ver.warningCount} warning{ver.warningCount === 1 ? '' : 's'}
                  </span>
                  {ver.number !== latestNum && (
                    <Link
                      href={`/documents/${id}/versions?compare=${ver.number}`}
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition',
                        isComparing && compareNum === ver.number
                          ? 'bg-amber-200 text-amber-900'
                          : 'text-stone-400 hover:bg-stone-100 hover:text-stone-700',
                      )}
                    >
                      <GitCompare className="h-3 w-3" /> Compare
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section>
          {isComparing && compareVersion && latestVersion && oldStats && newStats ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
                  <GitCompare className="h-4 w-4" />
                  Comparing v{compareNum} → v{latestNum} (latest)
                </h2>
                <Link
                  href={`/documents/${id}/versions?v=${compareNum}`}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
                >
                  Exit compare →
                </Link>
              </div>

              {/* Diff stats */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <DiffBadge oldVal={oldStats.pages} newVal={newStats.pages} label="pages" />
                <DiffBadge oldVal={oldStats.blocks} newVal={newStats.blocks} label="blocks" />
                <DiffBadge oldVal={oldStats.words} newVal={newStats.words} label="words" />
                <DiffBadge oldVal={oldStats.questions} newVal={newStats.questions} label="questions" />
                <DiffBadge oldVal={oldStats.diagrams} newVal={newStats.diagrams} label="diagrams" />
                <DiffBadge oldVal={oldStats.tables} newVal={newStats.tables} label="tables" />
              </div>

              {/* Side-by-side previews */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-md bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">v{compareNum}</span>
                    <span className="text-xs text-stone-400">selected version</span>
                  </div>
                  <div className="overflow-auto rounded-xl border border-stone-200 bg-stone-100 p-3" style={{ maxHeight: '70vh' }}>
                    <NoteRenderer doc={compareVersion.model} mode="preview" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">v{latestNum}</span>
                    <span className="text-xs text-stone-400">latest version</span>
                  </div>
                  <div className="overflow-auto rounded-xl border border-emerald-200 bg-stone-100 p-3" style={{ maxHeight: '70vh' }}>
                    <NoteRenderer doc={latestVersion.model} mode="preview" />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
                  Previewing v{selected?.number}
                </h2>
                {selected && selected.number !== latestNum && (
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/documents/${id}/versions?compare=${selected.number}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                    >
                      <GitCompare className="h-3.5 w-3.5" /> Compare with latest
                    </Link>
                    <RestoreVersionButton documentId={id} number={selected.number} />
                  </div>
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
            </>
          )}
        </section>
      </div>
    </div>
  )
}

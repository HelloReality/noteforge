// NoteForge — Import Review (§9.1): validation result, warnings, live preview.
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDocumentWithLatest } from '@/lib/server/storage'
import { NoteRenderer } from '@/components/renderer'
import { WarningsPanel } from '@/components/app/WarningsPanel'
import { Pencil, ChevronLeft, ShieldCheck, TriangleAlert, FileText, Cpu } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getDocumentWithLatest(id)
  if (!data) notFound()

  const warnings = data.warnings || []
  const hasErrors = warnings.some((w) => w.level === 'error')
  const hasWarns = warnings.some((w) => w.level === 'warn')
  const valid = !hasErrors && data.model && data.model.pages.length > 0
  const verdict = valid
    ? { tone: 'emerald', icon: <ShieldCheck className="h-5 w-5" />, label: 'Structural validation passed' }
    : { tone: 'rose', icon: <TriangleAlert className="h-5 w-5" />, label: 'Structural validation failed' }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800">
          <ChevronLeft className="h-4 w-4" /> Library
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-700">Import Review</span>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Document · {data.id.slice(0, 8)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">{data.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <Badge variant="outline" className="border-stone-300 bg-white text-stone-600">
              <FileText className="mr-1 h-3 w-3" /> visual-notes/1
            </Badge>
            {data.model?.generator && (
              <Badge variant="outline" className="border-stone-300 bg-white text-stone-600">
                <Cpu className="mr-1 h-3 w-3" /> generator: {data.model.generator}
              </Badge>
            )}
            <span>version {data.version?.number ?? '?'}</span>
            <span>·</span>
            <span>{data.model?.pages.length ?? 0} page{(data.model?.pages.length ?? 0) === 1 ? '' : 's'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <Link
            href={`/documents/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
          >
            <Pencil className="h-4 w-4" /> Approve &amp; open editor
          </Link>
        </div>
      </div>

      <div className={cn(
        'mb-6 flex items-center gap-3 rounded-xl border p-4',
        verdict.tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50',
      )}>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg',
          verdict.tone === 'emerald' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white')}>
          {verdict.icon}
        </span>
        <div className="flex-1">
          <p className={cn('text-sm font-semibold', verdict.tone === 'emerald' ? 'text-emerald-900' : 'text-rose-900')}>
            {verdict.label}
          </p>
          <p className={cn('text-xs', verdict.tone === 'emerald' ? 'text-emerald-700' : 'text-rose-700')}>
            {warnings.length === 0
              ? 'Imported cleanly — zero warnings.'
              : `${warnings.length} warning${warnings.length === 1 ? '' : 's'} (${warnings.filter(w => w.level === 'warn').length} warn, ${warnings.filter(w => w.level === 'error').length} error). All vectors neutralized.`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <WarningsPanel warnings={warnings} />
        </aside>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">Live preview</h2>
            <span className="text-xs text-stone-400">preview mode · Shared Renderer</span>
          </div>
          {data.model ? (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-100 p-4">
              <NoteRenderer doc={data.model} mode="preview" />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
              No model available.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

// NoteForge — document card for the library grid (with stats + actions).
'use client'

import Link from 'next/link'
import { DocumentActions } from './DocumentActions'
import { FavoriteStar } from './Favorites'
import { DocumentTags, TagAdder } from './Tags'
import type { DocumentListRow, DocumentStats } from '@/lib/server/storage'
import { cn } from '@/lib/utils'
import { formatStableDateTime, formatStableRelative } from '@/lib/date-format'
import { Badge } from '@/components/ui/badge'
import {
  Pencil, History, Eye, Globe, AlertTriangle, Clock, FileText,
  Layers, Hash, Spline, Table as TableIcon,
} from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600 border-stone-300',
  review: 'bg-amber-100 text-amber-800 border-amber-300',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

export function DocumentCard({ doc, stats, published, selected, onSelect }: {
  doc: DocumentListRow
  stats?: DocumentStats | null
  published: boolean
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
}) {
  const updated = new Date(doc.updatedAt)
  // Pre-compute stable UTC date strings so the server-rendered HTML matches
  // the client-hydrated HTML (no hydration mismatch from locale/timezone).
  const updatedTitle = formatStableDateTime(updated)
  const updatedRelative = formatStableRelative(updated)
  return (
    <div className={cn(
      'group relative flex h-full flex-col rounded-xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-stone-900',
      selected
        ? 'border-amber-400 ring-2 ring-amber-300'
        : 'border-stone-200 hover:border-amber-300 dark:border-stone-700 dark:hover:border-amber-700',
    )}>
      {/* selection checkbox */}
      {onSelect && (
        <button
          onClick={() => onSelect(doc.id, !selected)}
          className={cn(
            'absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border-2 transition',
            selected
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-stone-300 bg-white opacity-0 hover:border-amber-400 group-hover:opacity-100 dark:border-stone-600 dark:bg-stone-800',
          )}
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          {selected && <span className="text-xs font-bold">✓</span>}
        </button>
      )}
      {/* status strip */}
      <div className={cn('mb-3 flex items-start justify-between gap-2', onSelect && 'pl-7')}>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/documents/${doc.id}/edit`}
            className="line-clamp-2 text-base font-semibold leading-snug text-stone-900 transition hover:text-amber-700 dark:text-stone-100"
            title={doc.title}
          >
            {doc.title}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <FavoriteStar documentId={doc.id} />
          <Badge variant="outline" className={cn('border', STATUS_STYLE[doc.status] ?? STATUS_STYLE.draft)}>
            {doc.status}
          </Badge>
          <DocumentActions documentId={doc.id} title={doc.title} slug={doc.slug} published={published} />
        </div>
      </div>

      {/* meta row */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1" title="Version + save count">
          <FileText className="h-3.5 w-3.5 text-stone-400" />
          v{doc.latestVersionNumber ?? 0} · {doc.versionCount} save{doc.versionCount === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1" title={updatedTitle}>
          <Clock className="h-3.5 w-3.5 text-stone-400" />
          {updatedRelative}
        </span>
      </div>

      {/* tags row */}
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <DocumentTags documentId={doc.id} />
        <TagAdder documentId={doc.id} />
      </div>

      {/* stats row */}
      {stats && (
        <div className="mb-4 grid grid-cols-4 gap-2 rounded-lg bg-stone-50 p-2.5 text-center">
          <Stat icon={<Layers className="h-3.5 w-3.5" />} value={stats.pages} label="pages" />
          <Stat icon={<Hash className="h-3.5 w-3.5" />} value={stats.blocks} label="blocks" />
          <Stat icon={<Spline className="h-3.5 w-3.5" />} value={stats.diagrams} label="diag" />
          <Stat icon={<TableIcon className="h-3.5 w-3.5" />} value={stats.tables} label="tbl" />
        </div>
      )}

      {/* actions row — pushed to bottom via mt-auto for consistent card height */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 text-sm">
        <Link
          href={`/documents/${doc.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
        <Link
          href={`/documents/${doc.id}/review`}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <Eye className="h-3.5 w-3.5" /> Review
        </Link>
        <Link
          href={`/documents/${doc.id}/versions`}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
        >
          <History className="h-3.5 w-3.5" /> Versions
        </Link>
        {published ? (
          <Link
            href={`/notes/${doc.slug}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
          >
            <Globe className="h-3.5 w-3.5" /> Public
          </Link>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-dashed border-stone-300 px-2.5 py-1.5 text-xs font-medium text-stone-400">
            <AlertTriangle className="h-3.5 w-3.5" /> Unpublished
          </span>
        )}
      </div>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1 text-stone-400">{icon}</div>
      <div className="mt-0.5 text-sm font-semibold leading-none text-stone-700">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-stone-400">{label}</div>
    </div>
  )
}

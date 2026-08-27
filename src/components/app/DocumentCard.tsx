// NoteForge — document card for the library grid.
import Link from 'next/link'
import type { DocumentListRow } from '@/lib/server/storage'
import { cn } from '@/lib/utils'
import {
  Pencil, History, Eye, Globe, AlertTriangle, Clock, FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600 border-stone-300',
  review: 'bg-amber-100 text-amber-800 border-amber-300',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

export function DocumentCard({ doc, published }: { doc: DocumentListRow; published: boolean }) {
  const updated = new Date(doc.updatedAt)
  return (
    <div className="group flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/documents/${doc.id}/edit`}
          className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-stone-900 hover:text-amber-700"
          title={doc.title}
        >
          {doc.title}
        </Link>
        <Badge variant="outline" className={cn('shrink-0 border', STATUS_STYLE[doc.status] ?? STATUS_STYLE.draft)}>
          {doc.status}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" /> v{doc.latestVersionNumber ?? 0} · {doc.versionCount} save{doc.versionCount === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1" title={updated.toLocaleString()}>
          <Clock className="h-3.5 w-3.5" /> {formatRelative(updated)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
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

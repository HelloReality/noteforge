// NoteForge — library toolbar: search, status filter, sort.
'use client'

import { Search, ArrowUpDown, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type SortKey = 'updated' | 'title' | 'status'
export type StatusFilter = 'all' | 'draft' | 'review' | 'published'

export interface LibraryToolbarProps {
  query: string
  onQueryChange: (q: string) => void
  sort: SortKey
  onSortChange: (s: SortKey) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (f: StatusFilter) => void
  total: number
  filtered: number
}

export function LibraryToolbar({
  query, onQueryChange, sort, onSortChange, statusFilter, onStatusFilterChange, total, filtered,
}: LibraryToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by title or slug…"
          className="h-10 pl-9"
          aria-label="Search documents"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-stone-400" />
          <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
            <SelectTrigger className="h-10 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-4 w-4 text-stone-400" />
          <Select value={sort} onValueChange={(v) => onSortChange(v as SortKey)}>
            <SelectTrigger className="h-10 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last updated</SelectItem>
              <SelectItem value="title">Title A→Z</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className={cn(
          'hidden whitespace-nowrap text-xs text-stone-400 lg:inline',
        )}>
          {filtered === total ? `${total} docs` : `${filtered} of ${total}`}
        </span>
      </div>
    </div>
  )
}

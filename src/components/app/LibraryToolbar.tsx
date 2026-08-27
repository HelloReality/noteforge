// NoteForge — library toolbar: search, status filter, sort, favorites filter.
'use client'

import { Search, ArrowUpDown, Filter, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  favoritesOnly: boolean
  onFavoritesOnlyChange: (v: boolean) => void
  favoriteCount: number
  total: number
  filtered: number
}

export function LibraryToolbar({
  query, onQueryChange, sort, onSortChange, statusFilter, onStatusFilterChange,
  favoritesOnly, onFavoritesOnlyChange, favoriteCount, total, filtered,
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
        <Button
          variant={favoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          className={cn(
            'h-10 gap-1.5',
            favoritesOnly
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'text-stone-600 hover:text-amber-600 dark:text-stone-300',
          )}
          title={favoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        >
          <Star className={cn('h-4 w-4', favoritesOnly && 'fill-current')} />
          <span className="hidden sm:inline">Favorites</span>
          {favoriteCount > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              favoritesOnly ? 'bg-white/20' : 'bg-stone-100 dark:bg-stone-700',
            )}>
              {favoriteCount}
            </span>
          )}
        </Button>
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
          'hidden whitespace-nowrap text-xs text-stone-400 lg:inline dark:text-stone-500',
        )}>
          {filtered === total ? `${total} docs` : `${filtered} of ${total}`}
        </span>
      </div>
    </div>
  )
}

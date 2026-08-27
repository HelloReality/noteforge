// NoteForge — library client: search/filter/sort + grid + favorites filter.
'use client'

import { useState, useMemo } from 'react'
import { AppEmptyState } from './AppEmptyState'
import { LibraryToolbar, type SortKey, type StatusFilter } from './LibraryToolbar'
import { useFavorites } from './Favorites'
import type { DocumentListRow, DocumentStats } from '@/lib/server/storage'

export interface LibraryDoc extends DocumentListRow {
  stats?: DocumentStats | null
}

export function LibraryClient({ docs, publishedSlugs }: { docs: LibraryDoc[]; publishedSlugs: string[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const { ids: favoriteIds } = useFavorites()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = docs.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (favoritesOnly && !favoriteIds.has(d.id)) return false
      if (!q) return true
      return d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q)
    })
    out = [...out].sort((a, b) => {
      // Favorites always sort to top when not explicitly sorting by title
      if (sort === 'updated') {
        const aFav = favoriteIds.has(a.id) ? 1 : 0
        const bFav = favoriteIds.has(b.id) ? 1 : 0
        if (aFav !== bFav) return bFav - aFav
      }
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'status') return a.status.localeCompare(b.status) || a.title.localeCompare(b.title)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return out
  }, [docs, query, sort, statusFilter, favoritesOnly, favoriteIds])

  const publishedSet = useMemo(() => new Set(publishedSlugs), [publishedSlugs])

  return (
    <>
      <LibraryToolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        favoriteCount={favoriteIds.size}
        total={docs.length}
        filtered={filtered.length}
      />
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center dark:border-stone-700 dark:bg-stone-900">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
            {favoritesOnly ? 'No favorite documents yet' : 'No documents match your filters'}
          </p>
          <button
            onClick={() => { setQuery(''); setStatusFilter('all'); setFavoritesOnly(false) }}
            className="mt-3 text-sm font-medium text-amber-600 hover:text-amber-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : docs.length === 0 ? (
        <AppEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <DocumentCardClient
              key={d.id}
              doc={d}
              stats={d.stats}
              published={publishedSet.has(d.slug)}
            />
          ))}
        </div>
      )}
    </>
  )
}

// Re-export the card as a client component wrapper (avoids circular import issues).
import { DocumentCard } from './DocumentCard'
function DocumentCardClient(props: { doc: LibraryDoc; stats?: DocumentStats | null; published: boolean }) {
  return <DocumentCard {...props} />
}

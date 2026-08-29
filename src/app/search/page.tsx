// NoteForge — full-text search page (/search): searches across all document content.
//
// This is a SERVER component (no 'use client') so that `export const dynamic`
// is respected by Next.js. The actual search UI (which uses useSearchParams)
// lives in the SearchClient client component, wrapped in <Suspense> so the
// build doesn't bail on useSearchParams during static prerendering.

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { SearchClient } from './SearchClient'

// Force dynamic rendering — the search page reads URL params at runtime,
// so it should never be statically prerendered. This eliminates the
// "useSearchParams() should be wrapped in a suspense boundary" build error.
export const dynamic = 'force-dynamic'

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
          <div className="flex items-center justify-center py-12 text-stone-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm">Loading search…</span>
          </div>
        </div>
      }
    >
      <SearchClient />
    </Suspense>
  )
}

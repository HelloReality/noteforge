// NoteForge — SearchClient: the client-side search UI.
// Moved to a separate file so the page.tsx can be a server component with
// `export const dynamic = 'force-dynamic'` — this prevents static
// prerendering and avoids the useSearchParams() Suspense bailout issue.

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ArrowLeft, FileText, Loader2, Hash, HashIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SearchHit {
  page: number
  blockIndex: number
  blockType: string
  snippet: string
  highlighted: string
}
interface SearchResult {
  id: string
  title: string
  slug: string
  status: string
  updatedAt: string
  hits: SearchHit[]
  totalMatches: number
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-stone-100 text-stone-600 border-stone-300',
  review: 'bg-amber-100 text-amber-800 border-amber-300',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-300',
}

const BLOCK_TYPE_ICON: Record<string, string> = {
  title: 'T', heading: 'H', paragraph: '¶', question: '?', list: '≡',
  callout: '!', definition: 'def', quote: '"', divider: '—', spacer: '⎵',
  code: '</>', table: '⊞', image: 'img', diagram: '◊',
}

export function SearchClient() {
  const router = useRouter()
  const params = useSearchParams()
  const initialQuery = params.get('q') ?? ''
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [totalMatches, setTotalMatches] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setTotalMatches(0)
      setSearched(false)
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results || [])
      setTotalMatches(data.totalMatches || 0)
      // Update URL without full navigation
      const url = new URL(window.location.href)
      url.searchParams.set('q', q)
      window.history.replaceState({}, '', url.toString())
    } catch {
      setResults([])
      setTotalMatches(0)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

  // Run initial search if query in URL
  useEffect(() => {
    if (initialQuery) doSearch(initialQuery)
  }, [])

  // Reset focused index when results change
  useEffect(() => { setFocusedIndex(results.length > 0 ? 0 : -1) }, [results])

  // Keyboard navigation: ArrowDown/Up to move, Enter to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target === inputRef.current) return // only when not in input
      if (results.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((i) => Math.min(results.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault()
        const r = results[focusedIndex]
        if (r) router.push(`/documents/${r.id}/edit`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, focusedIndex, router])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-700">Search</span>
      </div>

      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Search notes</h1>
        <p className="mt-1 text-sm text-stone-500">
          Full-text search across all document content — titles, headings, paragraphs, lists, code, and more.
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for “CIA”, “encryption”, “XSS”…"
          className="h-12 pl-11 text-base"
          aria-label="Search query"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-amber-500" />
        )}
      </div>

      {searched && !loading && (
        <div className="mb-4 flex items-center justify-between text-sm text-stone-500">
          <div>
            {results.length === 0 ? (
              <span>No results for <strong className="text-stone-700">"{query}"</strong></span>
            ) : (
              <span>
                <strong className="text-stone-700">{results.length}</strong> document{results.length === 1 ? '' : 's'}
                {' · '}
                <strong className="text-stone-700">{totalMatches}</strong> match{totalMatches === 1 ? '' : 'es'}
              {' '}for <strong className="text-stone-700">"{query}"</strong>
            </span>
          )}
          </div>
          {results.length > 0 && (
            <span className="hidden items-center gap-1.5 text-xs text-stone-400 sm:flex">
              <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px]">↑</kbd>
              <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px]">↓</kbd>
              to navigate
              <kbd className="ml-1 rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
              to open
            </span>
          )}
        </div>
      )}

      <div className="space-y-4">
        {results.map((r, idx) => (
          <div
            key={r.id}
            ref={el => { if (idx === focusedIndex && el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }}
            className={cn(
              'rounded-xl border bg-white p-5 shadow-sm transition',
              idx === focusedIndex
                ? 'border-amber-400 ring-2 ring-amber-300 shadow-md'
                : 'border-stone-200 hover:border-amber-300 hover:shadow-md',
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <Link
                href={`/documents/${r.id}/edit`}
                className="text-base font-semibold text-stone-900 hover:text-amber-700"
              >
                {r.title}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline" className={cn('border', STATUS_STYLE[r.status] ?? STATUS_STYLE.draft)}>
                  {r.status}
                </Badge>
                <span className="text-xs text-stone-400">{r.totalMatches} match{r.totalMatches === 1 ? '' : 'es'}</span>
              </div>
            </div>
            <div className="space-y-2">
              {r.hits.map((hit, i) => (
                <Link
                  key={i}
                  href={`/documents/${r.id}/edit`}
                  className="block rounded-lg bg-stone-50 p-3 transition hover:bg-amber-50"
                >
                  <div className="mb-1 flex items-center gap-2 text-xs text-stone-400">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-stone-200 font-mono text-[10px] font-bold text-stone-600">
                      {BLOCK_TYPE_ICON[hit.blockType] ?? '•'}
                    </span>
                    <span>Page {hit.page} · block #{hit.blockIndex}</span>
                  </div>
                  <p
                    className="text-sm text-stone-700 [&_mark]:bg-amber-200 [&_mark]:px-0.5 [&_mark]:rounded [&_mark]:font-semibold [&_mark]:text-amber-900"
                    dangerouslySetInnerHTML={{ __html: hit.highlighted }}
                  />
                </Link>
              ))}
              {r.totalMatches > r.hits.length && (
                <p className="text-xs text-stone-400">
                  + {r.totalMatches - r.hits.length} more match{r.totalMatches - r.hits.length === 1 ? '' : 'es'} in this document
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {!searched && (
        <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 text-sm text-stone-500">
            Start typing to search across all your notes.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['CIA', 'encryption', 'XSS', 'SQL', 'AAA', 'VPN'].map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-3 py-1 text-xs text-stone-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
              >
                <Hash className="h-3 w-3" /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// keep HashIcon referenced for tree-shaking friendliness
void HashIcon

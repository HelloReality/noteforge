// NoteForge — recently viewed documents (localStorage-backed).
// Tracks document IDs the user opens in the editor and shows them as a
// compact horizontal card strip on the library dashboard. Purely client-side
// — no server state, persists in localStorage.

'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Eye, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'noteforge:recently-viewed'
const MAX_ITEMS = 8

export interface RecentEntry {
  id: string
  title: string
  slug: string
  status: string
  ts: number
}

/** Read the recently-viewed list from localStorage. */
export function readRecent(): RecentEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

/** Record a document as recently viewed (deduplicates + moves to front). */
export function recordRecent(entry: RecentEntry): void {
  if (typeof window === 'undefined') return
  try {
    const current = readRecent().filter((e) => e.id !== entry.id)
    current.unshift({ ...entry, ts: Date.now() })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current.slice(0, MAX_ITEMS)))
    // Notify same-tab listeners (the storage event only fires cross-tab).
    window.dispatchEvent(new CustomEvent('noteforge:recent-changed'))
  } catch {
    // localStorage might be full or blocked — no-op
  }
}

/** Remove a document from the recently-viewed list. */
export function removeRecent(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const current = readRecent().filter((e) => e.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    window.dispatchEvent(new CustomEvent('noteforge:recent-changed'))
  } catch {
    // no-op
  }
}

// Subscribe to localStorage changes (cross-tab) + same-tab custom event.
function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) callback() }
  const onCustom = () => callback()
  window.addEventListener('storage', onStorage)
  window.addEventListener('noteforge:recent-changed', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('noteforge:recent-changed', onCustom)
  }
}

// Cache the snapshot string so useSyncExternalStore gets a referentially
// stable value between renders when localStorage hasn't changed.
let cachedRaw: string | null | undefined = undefined
function getSnapshot(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Only update the cache when the value actually changes.
    if (raw !== cachedRaw) {
      cachedRaw = raw
    }
    return cachedRaw ?? ''
  } catch {
    return ''
  }
}
const getServerSnapshot = () => ''

// Initialize cache on first client read so the initial render matches.
if (typeof window !== 'undefined') {
  try { cachedRaw = localStorage.getItem(STORAGE_KEY) } catch { cachedRaw = null }
}

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-stone-400',
  review: 'bg-amber-400',
  published: 'bg-emerald-400',
}

export function RecentlyViewed() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Parse the snapshot (JSON string) into entries.
  let items: RecentEntry[] = []
  try {
    const arr = snapshot ? JSON.parse(snapshot) : []
    if (Array.isArray(arr)) items = arr.slice(0, MAX_ITEMS)
  } catch {
    items = []
  }

  if (items.length === 0) return null

  const handleRemove = (id: string) => removeRecent(id)
  const handleClear = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    cachedRaw = null
    window.dispatchEvent(new CustomEvent('noteforge:recent-changed'))
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          <Eye className="h-4 w-4" /> Recently viewed
        </h2>
        <button
          onClick={handleClear}
          className="text-xs font-medium text-stone-400 transition hover:text-rose-500"
        >
          Clear all
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 transition hover:border-amber-300 hover:bg-amber-50/40 dark:border-stone-700 dark:bg-stone-900 dark:hover:border-amber-700"
          >
            <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[item.status] ?? 'bg-stone-400')} />
            <Link
              href={`/documents/${item.id}/edit`}
              className="min-w-0 flex-1"
            >
              <p className="truncate text-sm font-medium text-stone-800 group-hover:text-amber-700 dark:text-stone-100 dark:group-hover:text-amber-400">
                {item.title}
              </p>
              <p className="text-xs text-stone-400">{formatRelative(item.ts)}</p>
            </Link>
            <button
              onClick={() => handleRemove(item.id)}
              className="shrink-0 text-stone-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
              aria-label="Remove from recently viewed"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-stone-300 transition group-hover:text-amber-500" />
          </div>
        ))}
      </div>
    </section>
  )
}

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString()
}

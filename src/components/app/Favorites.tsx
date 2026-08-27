// NoteForge — favorite/starred documents (localStorage-backed).
// Tracks starred document IDs in localStorage. Provides a toggle button
// and a filter option for the library toolbar.

'use client'

import { useSyncExternalStore } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'noteforge:favorites'

function readFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr.filter((x) => typeof x === 'string')
  } catch {
    return []
  }
}

function writeFavorites(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent('noteforge:favorites-changed'))
  } catch {
    // no-op
  }
}

let cachedRaw: string | null | undefined = undefined
function getSnapshot(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== cachedRaw) cachedRaw = raw
    return cachedRaw ?? ''
  } catch {
    return ''
  }
}
const getServerSnapshot = () => ''
if (typeof window !== 'undefined') {
  try { cachedRaw = localStorage.getItem(STORAGE_KEY) } catch { cachedRaw = null }
}

function subscribe(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) callback() }
  const onCustom = () => callback()
  window.addEventListener('storage', onStorage)
  window.addEventListener('noteforge:favorites-changed', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('noteforge:favorites-changed', onCustom)
  }
}

/** Hook returning the set of favorited document IDs + a toggle function. */
export function useFavorites(): { ids: Set<string>; toggle: (id: string) => void; isFavorite: (id: string) => boolean } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  let arr: string[] = []
  try {
    const parsed = snapshot ? JSON.parse(snapshot) : []
    if (Array.isArray(parsed)) arr = parsed.filter((x) => typeof x === 'string')
  } catch {
    arr = []
  }
  const ids = new Set(arr)
  return {
    ids,
    toggle: (id: string) => {
      const next = new Set(ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeFavorites(Array.from(next))
    },
    isFavorite: (id: string) => ids.has(id),
  }
}

/** Star toggle button — compact icon that fills when favorited. */
export function FavoriteStar({ documentId, size = 'sm' }: { documentId: string; size?: 'sm' | 'md' }) {
  const { isFavorite, toggle } = useFavorites()
  const fav = isFavorite(documentId)
  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(documentId)
      }}
      className={cn(
        'flex items-center justify-center rounded transition',
        size === 'md' ? 'h-8 w-8' : 'h-6 w-6',
        fav
          ? 'text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40'
          : 'text-stone-300 hover:bg-stone-200 hover:text-amber-400 dark:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-amber-400',
      )}
      aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
      title={fav ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Star className={cn(iconSize, fav && 'fill-current')} />
    </button>
  )
}

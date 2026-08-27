// NoteForge — tags/collections for documents (localStorage-backed).
// Each document can have multiple tags. Tags are managed client-side via
// localStorage and surfaced as filter chips on the library.

'use client'

import { useSyncExternalStore, useState } from 'react'
import { Tag, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const STORAGE_KEY = 'noteforge:tags'

/** Map of documentId -> string[] of tags. */
type TagMap = Record<string, string[]>

function readTagMap(): TagMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as TagMap
  } catch {
    return {}
  }
}

function writeTagMap(map: TagMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
    window.dispatchEvent(new CustomEvent('noteforge:tags-changed'))
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
  window.addEventListener('noteforge:tags-changed', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('noteforge:tags-changed', onCustom)
  }
}

function parseMap(snapshot: string): TagMap {
  try {
    const parsed = snapshot ? JSON.parse(snapshot) : {}
    if (typeof parsed === 'object' && parsed !== null) return parsed as TagMap
  } catch {
    // no-op
  }
  return {}
}

/** Hook returning the tag map + helpers. */
export function useTags() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const map = parseMap(snapshot)
  return {
    map,
    getTags: (id: string) => map[id] ?? [],
    addTag: (id: string, tag: string) => {
      const clean = tag.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
      if (!clean) return
      const next = { ...map }
      const current = next[id] ?? []
      if (!current.includes(clean)) next[id] = [...current, clean]
      writeTagMap(next)
    },
    removeTag: (id: string, tag: string) => {
      const next = { ...map }
      const current = next[id] ?? []
      next[id] = current.filter((t) => t !== tag)
      if (next[id].length === 0) delete next[id]
      writeTagMap(next)
    },
    /** All unique tags across all documents. */
    allTags: Array.from(new Set(Object.values(map).flat())).sort(),
  }
}

/** Tag badges displayed on a document card. */
export function DocumentTags({ documentId, max = 3 }: { documentId: string; max?: number }) {
  const { getTags, removeTag } = useTags()
  const tags = getTags(documentId)
  if (tags.length === 0) return null
  const shown = tags.slice(0, max)
  const extra = tags.length - max
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className="group/tag inline-flex items-center gap-0.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300"
        >
          <Tag className="h-2.5 w-2.5" />
          {t}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeTag(documentId, t) }}
            className="text-stone-400 opacity-0 transition hover:text-rose-500 group-hover/tag:opacity-100"
            aria-label={`Remove tag ${t}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-stone-400">+{extra}</span>
      )}
    </div>
  )
}

/** Inline tag adder (small + button that reveals an input). */
export function TagAdder({ documentId }: { documentId: string }) {
  const { addTag } = useTags()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const submit = () => {
    if (value.trim()) addTag(documentId, value)
    setValue('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-[10px] font-medium text-stone-400 transition hover:border-amber-400 hover:text-amber-600 dark:border-stone-600"
        title="Add tag"
      >
        <Plus className="h-2.5 w-2.5" /> tag
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit() }
        if (e.key === 'Escape') { setValue(''); setOpen(false) }
      }}
      placeholder="tag…"
      className="h-5 w-16 rounded-full border border-amber-300 bg-white px-2 text-[10px] text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-300 dark:bg-stone-800 dark:text-stone-200"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

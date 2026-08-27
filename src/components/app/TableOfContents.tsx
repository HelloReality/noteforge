// NoteForge — table-of-contents sidebar for the public viewer.
// Auto-generates a TOC from heading blocks (note-heading elements) in the
// rendered note. Highlights the currently-visible heading via scroll spy.
// Sticky on desktop, hidden on mobile (the reading progress bar covers mobile).

'use client'

import { useSyncExternalStore } from 'react'

interface TocItem {
  id: string
  text: string
  level: number
}

// Subscribe to scroll position so the active heading re-computes on scroll.
const emptySubscribe = () => () => {}
const getScrollY = () => (typeof window === 'undefined' ? 0 : window.scrollY)

export function TableOfContents() {
  // Re-render on scroll. The snapshot is the scroll position; when it changes,
  // React re-renders and recomputes the active heading from the DOM.
  useSyncExternalStore(emptySubscribe, getScrollY, () => 0)

  // Measure headings from the DOM on every render (cheap — <20 elements).
  const container = typeof document === 'undefined' ? null : document.getElementById('noteforge-note-content')
  const headings = container ? Array.from(container.querySelectorAll('.note-heading, .note-title')) : []

  if (headings.length < 2) return null

  const items: TocItem[] = headings.map((h, i) => {
    const level = h.classList.contains('note-title') ? 1 : (Number(h.getAttribute('data-level')) || 2)
    const text = h.textContent?.trim() || `Section ${i + 1}`
    const id = `toc-${i}`
    h.setAttribute('id', id)
    return { id, text, level }
  })

  // Determine the active heading (last one above the viewport top + 120px).
  let activeId: string | null = null
  for (const item of items) {
    const el = document.getElementById(item.id)
    if (!el) continue
    if (el.getBoundingClientRect().top < 120) activeId = item.id
  }

  return (
    <nav className="no-print sticky top-24 hidden max-h-[calc(100vh-8rem)] w-56 shrink-0 self-start overflow-y-auto xl:block">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-stone-200">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`block border-l-2 py-1 text-xs leading-snug transition ${
                item.level === 1 ? 'pl-3 font-medium' : 'pl-5'
              } ${
                activeId === item.id
                  ? 'border-amber-400 text-amber-700'
                  : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800'
              }`}
            >
              <span className={item.level === 1 ? '' : 'opacity-80'}>
                {item.text.slice(0, 50)}{item.text.length > 50 ? '…' : ''}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

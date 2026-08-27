// NoteForge — reading progress indicator for the public viewer.
// A thin progress bar fixed to the top of the viewport that fills as the
// user scrolls through the note. Uses scroll position relative to the
// note container (not the whole window, so the header/footer are excluded).

'use client'

import { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handler = () => {
      const el = document.getElementById('noteforge-note-content')
      if (!el) return
      const rect = el.getBoundingClientRect()
      // distance scrolled past the top of the note, relative to its scrollable height
      const scrolled = Math.max(0, -rect.top)
      const max = Math.max(0, rect.height - window.innerHeight)
      const ratio = max > 0 ? Math.min(1, scrolled / max) : 0
      setProgress(ratio * 100)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler)
      window.removeEventListener('resize', handler)
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-14 z-30 h-1 bg-stone-200/40 no-print" aria-hidden>
      <div
        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

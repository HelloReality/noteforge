// NoteForge — empty state for the library.
import Link from 'next/link'
import { Upload, NotebookPen } from 'lucide-react'

export function AppEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
        <NotebookPen className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-stone-800">No notes yet</h2>
      <p className="mt-1.5 max-w-md text-sm text-stone-500">
        Import a <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">.note.html</code> file to get
        started. NoteForge will sanitize it, build a normalized model, and let you edit &amp; publish it.
      </p>
      <Link
        href="/import"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
      >
        <Upload className="h-4 w-4" /> Import your first note
      </Link>
    </div>
  )
}

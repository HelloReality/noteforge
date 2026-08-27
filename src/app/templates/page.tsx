// NoteForge — templates gallery (/templates): pre-built .note.html starters.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TEMPLATES, TEMPLATE_CATEGORIES, type NoteTemplate } from '@/lib/note-format/templates'
import { ArrowLeft, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export default function TemplatesPage() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [importing, setImporting] = useState<string | null>(null)

  const filtered = TEMPLATES.filter((t) => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false
    if (!query) return true
    return t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase())
  })

  const handleImport = async (template: NoteTemplate) => {
    setImporting(template.id)
    try {
      const form = new FormData()
      form.append('file', new Blob([template.html], { type: 'text/html' }), template.filename)
      const res = await fetch('/api/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Import failed')
      toast.success(`Created "${data.title}" from template`, { description: 'Redirecting to review…' })
      router.push(`/documents/${data.documentId}/review`)
    } catch (e: any) {
      toast.error(e?.message || 'Import failed')
      setImporting(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/" className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>
        <span className="text-stone-300">/</span>
        <span className="font-medium text-stone-700 dark:text-stone-200">Templates</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">Document templates</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Start from a pre-built note. Click any template to import it as a new document — then edit freely.
        </p>
      </div>

      {/* Search + category filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="h-10 pl-9"
            aria-label="Search templates"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryChip active={activeCategory === 'all'} onClick={() => setActiveCategory('all')} icon="✨" label="All" />
          {TEMPLATE_CATEGORIES.map((c) => (
            <CategoryChip
              key={c.id}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
              icon={c.icon}
              label={c.label}
            />
          ))}
        </div>
      </div>

      {/* Template grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="group flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-amber-700"
          >
            <div className="mb-3 flex items-start justify-between">
              <span className="text-3xl">{t.icon}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                {t.category}
              </span>
            </div>
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">{t.name}</h3>
            <p className="mt-1 flex-1 text-xs text-stone-500 dark:text-stone-400">{t.description}</p>
            <div className="mt-4 flex items-center gap-2">
              <Button
                onClick={() => handleImport(t)}
                disabled={importing === t.id}
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                size="sm"
              >
                {importing === t.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {importing === t.id ? 'Importing…' : 'Use template'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center dark:border-stone-700 dark:bg-stone-900">
          <p className="text-sm text-stone-500 dark:text-stone-400">No templates match your search.</p>
          <button
            onClick={() => { setQuery(''); setActiveCategory('all') }}
            className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

function CategoryChip({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: string; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'bg-amber-500 text-white'
          : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700',
      )}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

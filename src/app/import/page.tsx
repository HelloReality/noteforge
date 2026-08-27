// NoteForge — Import page (§9): drag & drop upload → /api/import → review.
'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileUp, Sparkles, ShieldCheck, Loader2, FileCode2, ClipboardPaste } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function ImportPage() {
  const router = useRouter()
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [paste, setPaste] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const doImport = useCallback(async (fileText: string, filename: string) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', new Blob([fileText], { type: 'text/html' }), filename)
      const res = await fetch('/api/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Import failed')
        setBusy(false)
        return
      }
      const warnCount = data.warnings?.length || 0
      toast.success(`Imported "${data.title}"`, {
        description: warnCount === 0 ? 'No warnings — clean import.' : `${warnCount} warning${warnCount === 1 ? '' : 's'} to review.`,
      })
      router.push(`/documents/${data.documentId}/review`)
    } catch (e) {
      toast.error('Network error during import')
      setBusy(false)
    }
  }, [router])

  const onFile = useCallback(async (file: File) => {
    if (!file) return
    const text = await file.text()
    await doImport(text, file.name)
  }, [doImport])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  const onPasteSubmit = useCallback(async () => {
    if (!paste.trim()) {
      toast.error('Paste some note HTML first')
      return
    }
    await doImport(paste, 'pasted.note.html')
  }, [paste, doImport])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Import</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-stone-900">Import a visual note</h1>
        <p className="mt-2 text-stone-600">
          Drop a <code className="rounded bg-stone-200 px-1.5 py-0.5 text-sm">.note.html</code> file. It runs
          through the sanitizer (§10) and the import pipeline (§9) before landing in review.
        </p>
      </div>

      <Tabs defaultValue="file" className="w-full">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="file"><FileCode2 className="mr-1.5 h-4 w-4" />File</TabsTrigger>
          <TabsTrigger value="paste"><ClipboardPaste className="mr-1.5 h-4 w-4" />Paste HTML</TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition cursor-pointer',
              dragging ? 'border-amber-400 bg-amber-50' : 'border-stone-300 bg-white hover:border-amber-300 hover:bg-amber-50/40',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".html,.note.html,text/html"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            {busy ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-amber-500" />
                <p className="mt-4 text-sm font-medium text-stone-700">Importing &amp; sanitizing…</p>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
                  <Upload className="h-7 w-7" />
                </div>
                <p className="mt-5 text-base font-semibold text-stone-800">Drop your .note.html here</p>
                <p className="mt-1 text-sm text-stone-500">or click to browse</p>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="paste" className="mt-4">
          <div className="rounded-2xl border border-stone-300 bg-white p-4">
            <Textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="<!DOCTYPE html>…<note-document>…</note-document>…"
              className="min-h-[260px] font-mono text-xs"
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={onPasteSubmit} disabled={busy || !paste.trim()} className="bg-amber-500 hover:bg-amber-600">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                Import pasted HTML
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Sanitized">
          Scripts, iframes, forms, external resources &amp; dangerous CSS are stripped.
        </Feature>
        <Feature icon={<Sparkles className="h-4 w-4" />} title="Normalized model">
          Parsed into a typed <code className="text-xs">NoteDocument</code> with rich-text, tables &amp; diagrams.
        </Feature>
        <Feature icon={<FileUp className="h-4 w-4" />} title="Versioned">
          Each import creates version 1; later edits append new versions — never destructive.
        </Feature>
      </div>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex items-center gap-2 text-stone-800">
        <span className="text-amber-600">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">{children}</p>
    </div>
  )
}

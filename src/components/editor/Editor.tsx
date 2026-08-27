// NoteForge — Editor (§12): block-based editor with undo/redo, live preview, inspector.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEditorStore, emptyBlock, type BlockPath } from '@/lib/store/editor-store'
import type { Block, NoteDocument } from '@/lib/note-format/types'
import { NoteRenderer } from '@/components/renderer'
import { EditorToolbar } from './EditorToolbar'
import { Outline } from './Outline'
import { Inspector } from './Inspector'
import { Loader2, PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface EditorProps {
  documentId: string
  title: string
  slug: string
  status: string
  versionNumber: number
  model: NoteDocument
}

export function Editor({ documentId, title, slug, status, versionNumber, model }: EditorProps) {
  const router = useRouter()
  const load = useEditorStore((s) => s.load)
  const doc = useEditorStore((s) => s.doc)
  const currentPage = useEditorStore((s) => s.currentPage)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const dirty = useEditorStore((s) => s.dirty)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [savedNote, setSavedNote] = useState('')

  // initialise the store once on mount
  useEffect(() => { load(model) }, [])

  const selectedBlock: Block | null = useMemo(() => {
    if (!doc || !selectedPath) return null
    const [p, b, c] = selectedPath
    const blk = doc.pages[p]?.blocks?.[b]
    if (!blk) return null
    if (c === undefined) return blk
    if (blk.type === 'question') return blk.children[c] ?? null
    return null
  }, [doc, selectedPath])

  const handleSave = async () => {
    if (!doc) return
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: doc, note: savedNote || `Edit from v${versionNumber}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      const { toast } = await import('sonner')
      toast.success(`Saved version ${data.number}`)
      useEditorStore.getState().resetDirty()
      setSavedNote('')
      router.refresh()
    } catch (e: any) {
      const { toast } = await import('sonner')
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!doc) return
    // ensure a version is saved first
    setPublishing(true)
    try {
      const vres = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: doc, note: 'Publish snapshot' }),
      })
      const vdata = await vres.json()
      if (!vres.ok) throw new Error(vdata?.error || 'Save failed')
      const pres = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
      const pdata = await pres.json()
      if (!pres.ok) throw new Error(pdata?.error || 'Publish failed')
      const { toast } = await import('sonner')
      toast.success('Published', { description: `Live at /notes/${slug}` })
      useEditorStore.getState().resetDirty()
      router.refresh()
    } catch (e: any) {
      const { toast } = await import('sonner')
      toast.error(e?.message || 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'review' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Unpublish failed')
      const { toast } = await import('sonner')
      toast.success('Unpublished', { description: 'Back to review status' })
      router.refresh()
    } catch (e: any) {
      const { toast } = await import('sonner')
      toast.error(e?.message || 'Unpublish failed')
    } finally {
      setPublishing(false)
    }
  }

  if (!doc) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <EditorToolbar
        documentId={documentId}
        title={doc.title}
        slug={slug}
        status={status}
        versionNumber={versionNumber}
        dirty={dirty}
        saving={saving}
        publishing={publishing}
        onSave={handleSave}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr_320px]">
        {/* Outline */}
        <aside className={cn(
          'hidden flex-col border-r border-stone-200 bg-stone-50/60 lg:flex',
          !leftOpen && 'lg:hidden',
        )}>
          <Outline currentPage={currentPage} />
        </aside>

        {/* Preview canvas */}
        <section className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Eye className="h-3.5 w-3.5" />
              <span>Live preview · preview mode · Shared Renderer</span>
            </div>
            <div className="flex items-center gap-1 lg:hidden">
              <Button variant="ghost" size="sm" onClick={() => setLeftOpen((v) => !v)} className="h-7 px-2">
                {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRightOpen((v) => !v)} className="h-7 px-2">
                {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-stone-100 p-4">
            <NoteRenderer doc={doc} mode="preview" />
          </div>
        </section>

        {/* Inspector */}
        <aside className={cn(
          'hidden flex-col border-l border-stone-200 bg-white lg:flex',
          !rightOpen && 'lg:hidden',
        )}>
          <Inspector
            documentId={documentId}
            selectedBlock={selectedBlock}
            selectedPath={selectedPath}
            pageBlocks={doc.pages[currentPage]?.blocks ?? []}
          />
        </aside>
      </div>
    </div>
  )
}

// re-export for convenience
export type { BlockPath }

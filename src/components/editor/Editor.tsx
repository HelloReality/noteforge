// NoteForge — Editor (§12): block-based editor with undo/redo, live preview, inspector.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEditorStore, emptyBlock, type BlockPath } from '@/lib/store/editor-store'
import { useEditorKeyboardShortcuts } from '@/lib/store/use-keyboard-shortcuts'
import type { Block, NoteDocument } from '@/lib/note-format/types'
import { NoteRenderer } from '@/components/renderer'
import { EditorToolbar } from './EditorToolbar'
import { Outline } from './Outline'
import { Inspector } from './Inspector'
import { KeyboardShortcutsDialog } from '@/components/app/KeyboardShortcutsDialog'
import { DocumentSettingsDialog } from '@/components/app/DocumentSettingsDialog'
import { recordRecent } from '@/components/app/RecentlyViewed'
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
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [savedNote, setSavedNote] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [renderMode, setRenderMode] = useState<'preview' | 'public'>('preview')
  const titleRef = useRef<HTMLInputElement>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedDocRef = useRef<string>('')

  // initialise the store once on mount
  useEffect(() => { load(model) }, [])

  // record this document as recently viewed
  useEffect(() => {
    recordRecent({ id: documentId, title, slug, status, ts: Date.now() })
  }, [documentId, title, slug, status])

  // ── Autosave (debounced) ──────────────────────────────────────────────
  // Whenever the doc changes (dirty becomes true), schedule a save after 2.5s.
  // If the user keeps typing, the timer resets. On success, mark saved.
  // On error, show "Save failed" and let the user retry with the manual Save button.
  useEffect(() => {
    if (!doc || !dirty) return
    // Don't autosave the initial load — only after a real mutation.
    const docJson = JSON.stringify(doc)
    if (docJson === lastSavedDocRef.current) return
    // Clear any pending timer
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    setAutosaveState('saving')
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: doc, note: 'Autosave' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Autosave failed')
        lastSavedDocRef.current = docJson
        useEditorStore.getState().resetDirty()
        setAutosaveState('saved')
        // Do NOT call router.refresh() here — it would re-render server
        // components and flicker the editor on every keystroke. The version
        // badge updates on the next manual save / publish / navigation.
      } catch (e: any) {
        setAutosaveState('error')
        console.error('[autosave] failed:', e?.message)
      }
    }, 2500)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [doc, dirty, documentId])

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
    setAutosaveState('saving')
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: doc, note: savedNote || `Edit from v${versionNumber}` }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Save failed')
      lastSavedDocRef.current = JSON.stringify(doc)
      const { toast } = await import('sonner')
      toast.success(`Saved version ${data.number}`)
      useEditorStore.getState().resetDirty()
      setAutosaveState('saved')
      setSavedNote('')
      router.refresh()
    } catch (e: any) {
      setAutosaveState('error')
      const { toast } = await import('sonner')
      toast.error(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    window.location.href = `/api/documents/${documentId}/export`
    import('sonner').then(({ toast }) => toast.success('Downloading .note.html'))
  }

  // keyboard shortcuts
  useEditorKeyboardShortcuts({
    onSave: handleSave,
    onExport: handleExport,
    canSave: dirty && !saving,
    titleRef,
  })

  // "?" key opens shortcuts dialog (without modifier)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return
        e.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handlePublish = async () => {
    if (!doc) return
    // Save the current state as a new version, then promote THAT version to
    // "published" (sets publishedVersionId). The latestVersionId continues to
    // point at the same version — but editing + saving later creates a NEW
    // latestVersion that is NOT published, so the public page is unaffected.
    setPublishing(true)
    try {
      const vres = await fetch(`/api/documents/${documentId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: doc, note: 'Publish snapshot' }),
      })
      const vdata = await vres.json()
      if (!vres.ok) throw new Error(vdata?.error || 'Save failed')
      // Promote the just-saved version to published.
      const pres = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published', publishedVersionId: vdata.versionId }),
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
        autosaveState={autosaveState}
        onSave={handleSave}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onShowSettings={() => setSettingsOpen(true)}
        titleRef={titleRef}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <DocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        documentId={documentId}
        title={doc.title}
        slug={slug}
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
              <span>Live preview · {renderMode} mode · Shared Renderer</span>
            </div>
            <div className="flex items-center gap-1">
              {/* Preview mode toggle */}
              <div className="hidden items-center rounded-md border border-stone-200 bg-stone-50 p-0.5 sm:flex">
                <button
                  onClick={() => setRenderMode('preview')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition',
                    renderMode === 'preview' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700',
                  )}
                  title="Preview mode (div wrappers)"
                >Preview</button>
                <button
                  onClick={() => setRenderMode('public')}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition',
                    renderMode === 'public' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700',
                  )}
                  title="Public mode (semantic h1/h2/p tags)"
                >Public</button>
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
          </div>
          <div className="flex-1 overflow-auto bg-stone-100 p-4">
            <NoteRenderer doc={doc} mode={renderMode} />
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

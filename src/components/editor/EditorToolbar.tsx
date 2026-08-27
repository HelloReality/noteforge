// NoteForge — editor toolbar (§12): title, status, undo/redo, save, publish.
'use client'

import Link from 'next/link'
import { useEditorStore } from '@/lib/store/editor-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Undo2, Redo2, Save, Rocket, ChevronLeft, PanelLeft, PanelLeftClose, PanelRight, PanelRightClose, Circle,
  Download, MoreVertical, Globe, GlobeLock, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface EditorToolbarProps {
  documentId: string
  title: string
  slug: string
  status: string
  versionNumber: number
  dirty: boolean
  saving: boolean
  publishing: boolean
  onSave: () => void
  onPublish: () => void
  onUnpublish: () => void
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}

export function EditorToolbar(props: EditorToolbarProps) {
  const { documentId, slug, status, versionNumber, dirty, saving, publishing, onSave, onPublish, onUnpublish, title } = props
  const isPublished = status === 'published'
  const doc = useEditorStore((s) => s.doc)
  const currentPage = useEditorStore((s) => s.currentPage)
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage)
  const updateDocMeta = useEditorStore((s) => s.updateDocMeta)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)

  const pageCount = doc?.pages.length ?? 1
  const statusStyle = {
    draft: 'bg-stone-100 text-stone-700 border-stone-300',
    review: 'bg-amber-100 text-amber-800 border-amber-300',
    published: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  }[status] ?? 'bg-stone-100 text-stone-700 border-stone-300'

  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="flex h-14 items-center gap-3 px-3">
        <Link
          href="/"
          className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-800 sm:flex"
        >
          <ChevronLeft className="h-4 w-4" /> Library
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => props.onToggleLeft()} className="hidden h-8 w-8 p-0 lg:flex">
            {props.leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => props.onToggleRight()} className="hidden h-8 w-8 p-0 lg:flex">
            {props.rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
          </Button>
        </div>

        <Input
          value={doc?.title ?? title}
          onChange={(e) => updateDocMeta({ title: e.target.value })}
          className="h-9 max-w-xs flex-1 border-transparent bg-transparent font-semibold text-stone-900 hover:border-stone-200 focus-visible:border-stone-300 focus-visible:bg-white"
          aria-label="Document title"
        />

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className={cn('hidden border sm:inline-flex', statusStyle)}>{status}</Badge>
          <span className="hidden text-xs text-stone-400 md:inline">v{versionNumber}</span>
          <span className="hidden items-center gap-1 text-xs text-stone-400 lg:inline-flex">
            <Circle className={cn('h-2 w-2', dirty ? 'fill-amber-400 text-amber-400' : 'fill-emerald-400 text-emerald-400')} />
            {dirty ? 'unsaved' : 'saved'}
          </span>

          {pageCount > 1 && (
            <div className="hidden items-center gap-1 rounded-md border border-stone-200 px-1 lg:flex">
              <Button
                variant="ghost" size="sm" disabled={currentPage <= 0}
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                className="h-7 px-2"
              >‹</Button>
              <span className="text-xs text-stone-500">P{currentPage + 1}/{pageCount}</span>
              <Button
                variant="ghost" size="sm" disabled={currentPage >= pageCount - 1}
                onClick={() => setCurrentPage(Math.min(pageCount - 1, currentPage + 1))}
                className="h-7 px-2"
              >›</Button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-md border border-stone-200">
            <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undo} className="h-8 w-8 p-0" title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" disabled={!canRedo} onClick={redo} className="h-8 w-8 p-0" title="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={saving || !dirty}
            className="h-8"
          >
            {saving ? <Rocket className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
            <span className="ml-1.5">Save</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/documents/${documentId}/export`
              toast.success('Downloading .note.html')
            }}
            className="hidden h-8 sm:inline-flex"
            title="Export as .note.html"
          >
            <Download className="h-4 w-4" />
          </Button>
          {isPublished ? (
            <Button
              size="sm"
              onClick={onUnpublish}
              disabled={publishing}
              className="h-8 bg-stone-600 hover:bg-stone-700"
            >
              <GlobeLock className="h-4 w-4" />
              <span className="ml-1.5">Unpublish</span>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onPublish}
              disabled={publishing}
              className="h-8 bg-emerald-600 hover:bg-emerald-700"
            >
              <Rocket className="h-4 w-4" />
              <span className="ml-1.5">Publish</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                window.location.href = `/api/documents/${documentId}/export`
                toast.success('Downloading .note.html')
              }}>
                <Download className="mr-2 h-4 w-4" /> Export .note.html
              </DropdownMenuItem>
              {isPublished && (
                <DropdownMenuItem onClick={() => window.open(`/notes/${slug}`, '_blank')}>
                  <ExternalLink className="mr-2 h-4 w-4" /> View public page
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isPublished ? (
                <DropdownMenuItem onClick={onUnpublish} disabled={publishing} className="text-stone-600 focus:text-stone-700">
                  <GlobeLock className="mr-2 h-4 w-4" /> Unpublish
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onPublish} disabled={publishing} className="text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50">
                  <Globe className="mr-2 h-4 w-4" /> Publish
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* mobile panel toggles */}
      <div className="flex items-center gap-2 px-3 pb-2 lg:hidden">
        <Button variant="outline" size="sm" onClick={() => props.onToggleLeft()} className="h-7">
          <PanelLeft className="mr-1.5 h-3.5 w-3.5" /> Outline
        </Button>
        <Button variant="outline" size="sm" onClick={() => props.onToggleRight()} className="h-7">
          <PanelRight className="mr-1.5 h-3.5 w-3.5" /> Inspector
        </Button>
        <Link
          href={`/documents/${documentId}/review`}
          className="ml-auto text-xs text-stone-500 hover:text-stone-800"
        >Review</Link>
      </div>
    </div>
  )
}

// keep the unused toast import referenced for potential future use
void toast

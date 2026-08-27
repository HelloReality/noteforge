// NoteForge — document actions menu (duplicate / export / delete).
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Copy, Download, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export interface DocumentActionsProps {
  documentId: string
  title: string
  compact?: boolean
}

export function DocumentActions({ documentId, title, compact }: DocumentActionsProps) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/duplicate`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Duplicate failed')
      toast.success('Document duplicated', { description: `"${title} (copy)" created as draft` })
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Duplicate failed')
    } finally {
      setDuplicating(false)
    }
  }

  const handleExport = () => {
    window.location.href = `/api/documents/${documentId}/export`
    toast.success('Downloading .note.html')
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Delete failed')
      }
      toast.success('Document deleted')
      setConfirmDelete(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label="Document actions"
        >
          {duplicating || deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={handleDuplicate} disabled={duplicating}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Export .note.html
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong className="text-stone-900">{title}</strong> and all its versions.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

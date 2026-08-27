// NoteForge — batch operations toolbar for the library.
// Appears when one or more documents are selected. Provides bulk publish,
// unpublish (set to review), and delete actions.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckSquare, Trash2, Globe, GlobeLock, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export interface BatchToolbarProps {
  selectedIds: string[]
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClear: () => void
}

export function BatchToolbar({ selectedIds, selectedCount, totalCount, onSelectAll, onClear }: BatchToolbarProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const runBatch = async (action: 'updateStatus' | 'delete', status?: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/documents/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: selectedIds, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Batch operation failed')
      const ok = data.successful?.length ?? 0
      const fail = data.failed?.length ?? 0
      if (action === 'delete') {
        toast.success(`Deleted ${ok} document${ok === 1 ? '' : 's'}`, fail > 0 ? { description: `${fail} failed` } : undefined)
        setConfirmDelete(false)
      } else {
        toast.success(`Updated ${ok} document${ok === 1 ? '' : 's'} to ${status}`, fail > 0 ? { description: `${fail} failed` } : undefined)
      }
      onClear()
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Batch operation failed')
    } finally {
      setBusy(false)
    }
  }

  if (selectedCount === 0) return null

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
            {selectedCount} selected
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBatch('updateStatus', 'published')}
            disabled={busy}
            className="h-8 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Globe className="mr-1.5 h-3.5 w-3.5" />}
            Publish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => runBatch('updateStatus', 'review')}
            disabled={busy}
            className="h-8 border-stone-300 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300"
          >
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <GlobeLock className="mr-1.5 h-3.5 w-3.5" />}
            Unpublish
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="h-8 border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              Select all ({totalCount})
            </button>
          )}
          <button
            onClick={onClear}
            className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-700"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} document{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong className="text-stone-900">{selectedCount} document{selectedCount === 1 ? '' : 's'}</strong> and all their versions.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => runBatch('delete')}
              disabled={busy}
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete {selectedCount} permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

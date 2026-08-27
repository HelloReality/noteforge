// NoteForge — restore version button (client): creates a new version from an old one.
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export function RestoreVersionButton({ documentId, number, disabled }: {
  documentId: string
  number: number
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${number}/restore`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Restore failed')
      toast.success(`Restored v${number} → new v${data.number}`, {
        description: 'A new version was created from the selected version.',
      })
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
      >
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore v{number}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a <strong className="text-stone-900">new version</strong> (append-only — your
              history is never lost) whose model + warnings match v{number}. The new version becomes the
              latest.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoring}
              className="bg-amber-600 hover:bg-amber-700 focus:ring-amber-600"
            >
              {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Create new version from v{number}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

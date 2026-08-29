// NoteForge — publish-version button (client): promotes a specific version
// to "published" (sets status='published' AND publishedVersionId).
// The public viewer will then read that specific version, not the latest.
// This lets you publish an older version without restoring it first.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Rocket, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export function PublishVersionButton({
  documentId,
  number,
  versionId,
  disabled,
}: {
  documentId: string
  number: number
  versionId: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const handlePublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published', publishedVersionId: versionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Publish failed')
      toast.success(`Published v${number}`, {
        description: 'The public page now shows this version.',
      })
      setOpen(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900"
      >
        <Rocket className="mr-1.5 h-3.5 w-3.5" /> Publish v{number}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish version {number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets the document status to <strong className="text-stone-900">published</strong> and
              pins the public page to <strong className="text-stone-900">v{number}</strong>. The public
              viewer will show this specific version even if you continue editing the draft. You can
              re-publish any version at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={publishing}
              className="bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-600"
            >
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Publish v{number}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

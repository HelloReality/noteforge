// NoteForge — document settings dialog (edit slug from the editor).
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export interface DocumentSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  title: string
  slug: string
}

export function DocumentSettingsDialog({ open, onOpenChange, documentId, title, slug }: DocumentSettingsDialogProps) {
  const router = useRouter()
  const [slugValue, setSlugValue] = useState(slug)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) setSlugValue(slug) }, [slug, open])

  const handleSave = async () => {
    const clean = slugValue.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
    if (!clean) {
      toast.error('Slug cannot be empty')
      return
    }
    if (clean === slug) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: clean }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update slug')
      toast.success('Slug updated', { description: `Public URL is now /notes/${clean}` })
      onOpenChange(false)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update slug')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-amber-600" />
            Document settings
          </DialogTitle>
          <DialogDescription>
            Edit the public URL slug for <strong className="text-stone-900">{title}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-slug" className="text-xs font-medium text-stone-600">Public slug</Label>
            <div className="flex items-center gap-1 rounded-md border border-stone-300 bg-stone-50 px-2 focus-within:ring-2 focus-within:ring-amber-400">
              <span className="text-xs text-stone-400">/notes/</span>
              <Input
                id="doc-slug"
                value={slugValue}
                onChange={(e) => setSlugValue(e.target.value)}
                className="h-9 border-transparent bg-transparent font-mono text-sm focus-visible:bg-transparent"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              />
            </div>
            <p className="text-xs text-stone-400">
              Lowercase letters, numbers, and hyphens only. The slug must be unique.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
            Save slug
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

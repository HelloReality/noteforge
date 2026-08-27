// NoteForge — share dialog for the public viewer.
// Provides social share buttons + copy link + native Web Share API.
'use client'

import { useState } from 'react'
import { Share2, X, Copy, Check, Twitter, Facebook, Linkedin, Mail } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  title: string
}

export function ShareDialog({ open, onOpenChange, slug, title }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined' ? `${window.location.origin}/notes/${slug}` : `/notes/${slug}`
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)

  const shareTargets = [
    { name: 'Twitter', icon: <Twitter className="h-4 w-4" />, url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`, color: 'hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300' },
    { name: 'Facebook', icon: <Facebook className="h-4 w-4" />, url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, color: 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300' },
    { name: 'LinkedIn', icon: <Linkedin className="h-4 w-4" />, url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, color: 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300' },
    { name: 'Email', icon: <Mail className="h-4 w-4" />, url: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A%0A${encodedUrl}`, color: 'hover:bg-stone-100 hover:text-stone-700 hover:border-stone-400' },
  ]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this URL:', url)
    }
  }

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, url })
      } catch {
        // user cancelled — no-op
      }
    } else {
      handleCopy()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-amber-600" />
            Share this note
          </DialogTitle>
          <DialogDescription>
            Share <strong className="text-stone-900">{title}</strong> via your favorite channel.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 space-y-3">
          {/* Native share button (mobile) */}
          <Button onClick={handleNativeShare} className="w-full bg-amber-500 hover:bg-amber-600">
            <Share2 className="mr-2 h-4 w-4" /> Share…
          </Button>

          {/* Social share buttons */}
          <div className="grid grid-cols-4 gap-2">
            {shareTargets.map((target) => (
              <a
                key={target.name}
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex flex-col items-center gap-1.5 rounded-lg border border-stone-200 bg-white p-3 text-xs font-medium text-stone-600 transition ${target.color}`}
              >
                {target.icon}
                {target.name}
              </a>
            ))}
          </div>

          {/* Copy link */}
          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
            <input
              readOnly
              value={url}
              className="flex-1 bg-transparent px-2 py-1 font-mono text-xs text-stone-600 focus:outline-none"
              onFocus={(e) => e.target.select()}
            />
            <Button
              size="sm"
              onClick={handleCopy}
              className="shrink-0"
              variant={copied ? 'outline' : 'default'}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

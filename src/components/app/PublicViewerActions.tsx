// NoteForge — public viewer actions (share, print, copy link, back to library).
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Printer, Link2, ArrowLeft, Loader2, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ShareDialog } from './ShareDialog'
import { toast } from 'sonner'

export function PublicViewerActions({ slug, title }: { slug: string; title: string }) {
  const [copying, setCopying] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleCopyLink = async () => {
    setCopying(true)
    const url = `${window.location.origin}/notes/${slug}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied', { description: url })
    } catch {
      window.prompt('Copy this URL:', url)
    } finally {
      setCopying(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 no-print">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShareOpen(true)}
          className="h-8 text-stone-600 hover:bg-amber-50 hover:text-amber-700"
        >
          <Share2 className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Share</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
          disabled={copying}
          className="h-8 text-stone-600 hover:bg-stone-200 hover:text-stone-900"
        >
          {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">Copy link</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrint}
          className="h-8 text-stone-600 hover:bg-stone-200 hover:text-stone-900"
        >
          <Printer className="h-4 w-4" />
          <span className="ml-1.5 hidden sm:inline">Print / PDF</span>
        </Button>
        <Link
          href="/"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-stone-500 transition hover:bg-stone-200 hover:text-stone-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Library</span>
        </Link>
      </div>
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} slug={slug} title={title} />
    </>
  )
}

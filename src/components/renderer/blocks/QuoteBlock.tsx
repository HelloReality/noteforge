// NoteForge — Shared Renderer / Quote block
//
// DOM contract (Appendix A.2):
//   `<blockquote class="note-quote [imported]">{html}<cite class="note-quote-cite">{cite}</cite></blockquote>`
// `cite` is optional and rendered as `<cite class="note-quote-cite">` after the html.
//
// Block-level rich text (html) + the optional cite are siblings inside the
// blockquote. We assemble the inner HTML string and render via
// dangerouslySetInnerHTML on the .note-quote element so the spec's exact DOM
// is produced (no inner wrapper span).

import type { ReactElement } from 'react'
import type { QuoteBlock as QuoteBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface QuoteBlockProps {
  block: QuoteBlockModel
  mode: RenderMode
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function QuoteBlock({ block, mode: _mode }: QuoteBlockProps): ReactElement {
  const className = classes('note-quote', block.classes)
  const inner = block.html + (block.cite ? `<cite class="note-quote-cite">${escapeHtmlText(block.cite)}</cite>` : '')
  return (
    <blockquote
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

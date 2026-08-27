// NoteForge — Shared Renderer / Heading block
//
// DOM contract (Appendix A.2):
//   edit/preview: `<div class="note-heading [imported]" data-level="2|3|4">…</div>`
//   public:      `<h2|h3|h4 class="note-heading [imported]">…</h2|h3|h4>`
// `align` (data-align on the source) is applied as inline `text-align`.

import type { ReactElement } from 'react'

import type { HeadingBlock as HeadingBlockModel } from '@/lib/note-format/types'
import { alignStyle, classes, type RenderMode } from '../types'

export interface HeadingBlockProps {
  block: HeadingBlockModel
  mode: RenderMode
}

export function HeadingBlock({ block, mode }: HeadingBlockProps): ReactElement {
  const className = classes('note-heading', block.classes)
  const style = alignStyle(block.align)
  const html = { __html: block.html }
  if (mode === 'public') {
    // Public mode emits the semantic heading tag matching the level.
    if (block.level === 3) return <h3 className={className} style={style} dangerouslySetInnerHTML={html} />
    if (block.level === 4) return <h4 className={className} style={style} dangerouslySetInnerHTML={html} />
    return <h2 className={className} style={style} dangerouslySetInnerHTML={html} />
  }
  // Edit / preview: a stable <div> wrapper (with data-level for fixture CSS
  // that wants to discriminate by level).
  return (
    <div
      className={className}
      data-level={String(block.level)}
      style={style}
      dangerouslySetInnerHTML={html}
    />
  )
}

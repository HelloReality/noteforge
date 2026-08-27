// NoteForge — Shared Renderer / Definition block
//
// DOM contract (Appendix A.2):
//   `<div class="note-definition [imported]">
//      <span class="note-definition-term">{term}</span> {html}
//    </div>`
//
// The `term` is plain text from the source attribute (HTML-escaped here);
// `html` is the pre-sanitized rich-text string. We assemble the full inner
// HTML string (`<span class="note-definition-term">…</span> {html}`) and
// render via dangerouslySetInnerHTML on the outer `.note-definition` div so
// the spec's exact DOM (term span + sibling rich text, no extra wrapper) is
// produced.

import type { ReactElement } from 'react'
import type { DefinitionBlock as DefinitionBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface DefinitionBlockProps {
  block: DefinitionBlockModel
  mode: RenderMode
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function DefinitionBlock({ block, mode: _mode }: DefinitionBlockProps): ReactElement {
  const className = classes('note-definition', block.classes)
  const inner = `<span class="note-definition-term">${escapeHtmlText(block.term)}</span> ${block.html}`
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  )
}

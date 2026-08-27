// NoteForge — Shared Renderer / Paragraph block
//
// DOM contract (Appendix A.2):
//   edit/preview: `<div class="note-paragraph [imported]">…</div>`
//   public:      `<p    class="note-paragraph [imported]">…</p>`
// `align` is applied as inline `text-align`; the (sanitized) `style` field is
// applied as an inline style attribute on the element.

import type { CSSProperties, ReactElement } from 'react'
import type { ParagraphBlock as ParagraphBlockModel } from '@/lib/note-format/types'
import { alignStyle, classes, type RenderMode } from '../types'

export interface ParagraphBlockProps {
  block: ParagraphBlockModel
  mode: RenderMode
}

export function ParagraphBlock({ block, mode }: ParagraphBlockProps): ReactElement {
  const className = classes('note-paragraph', block.classes)
  // Merge the align-derived text-align with any sanitized inline `style`
  // from the model. Inline `style` wins when both set the same property
  // (later keys override earlier ones in a style object literal).
  const style: CSSProperties = {
    ...alignStyle(block.align),
    ...(block.style ? parseInlineStyle(block.style) : undefined),
  }
  const html = { __html: block.html }
  if (mode === 'public') {
    return <p className={className} style={style} dangerouslySetInnerHTML={html} />
  }
  return <div className={className} style={style} dangerouslySetInnerHTML={html} />
}

/** Parse a sanitized `prop:value; prop:value` style string into a CSSProperties object.
 *  The model's `style` field is already sanitized (sanitizeInlineStyle), so the
 *  only thing left is to split on `;` and `:`. */
function parseInlineStyle(s: string): CSSProperties | undefined {
  if (!s) return undefined
  const out: Record<string, string> = {}
  for (const decl of s.split(';')) {
    const idx = decl.indexOf(':')
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim()
    const value = decl.slice(idx + 1).trim()
    if (!prop || !value) continue
    // Convert CSS kebab-case to camelCase for React's CSSProperties.
    const reactProp = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    out[reactProp] = value
  }
  return out as CSSProperties
}

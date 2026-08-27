// NoteForge — Shared Renderer
// src/components/renderer/RichText.tsx
//
// Tiny helper that renders a pre-sanitized HTML string via
// dangerouslySetInnerHTML. The model's `html` fields are sanitized at parse
// time (see src/lib/note-format/sanitize.ts) so this is safe by contract.
//
// We deliberately *do not* add any Tailwind prose/typography classes here —
// the visual styling of note content comes from the document's injected
// (scoped) `model.css`. This component only emits the requested className
// and (optionally) an inline `style` object.

import type { CSSProperties, ReactElement } from 'react'

export interface RichTextProps {
  /** Pre-sanitized HTML string. */
  html: string
  /** Class name to apply to the wrapper element. */
  className?: string
  /** Optional inline style (e.g. text-align from `data-align`). */
  style?: CSSProperties
}

/**
 * Render pre-sanitized rich-text HTML inside a span-shaped element via
 * dangerouslySetInnerHTML. The wrapper element itself is a `<span>` so it can
 * be dropped inline inside an existing block (e.g. list items) without
 * disturbing the surrounding DOM.
 *
 * Block-level rich text (title/paragraph/heading/quote) does NOT use this
 * component — those blocks render their own outer element with the base
 * class (`.note-title`, `.note-paragraph`, …) and set the inner HTML directly
 * on that element. This helper is used for the *inner* pieces where we need
 * an inline wrapper.
 */
export function RichText({ html, className, style }: RichTextProps): ReactElement {
  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

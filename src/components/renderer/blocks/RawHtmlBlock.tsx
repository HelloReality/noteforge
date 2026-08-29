// NoteForge — Shared Renderer / Raw HTML block
//
// Renders a raw-html block (from <note-raw>) by injecting the sanitized HTML
// directly. The HTML was sanitized on import (scripts, iframes, dangerous
// CSS removed) but the visual structure (divs, grids, SVGs, inline styles,
// classes) is preserved 1:1.
//
// This is the "escape hatch" for rich layouts that don't fit the semantic
// note-* blocks — e.g. two-column grids, hand-drawn boxes with SVG borders,
// custom flow diagrams with nodes and arrows.

import type { ReactElement } from 'react'
import type { RawHtmlBlock as RawHtmlBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface RawHtmlBlockProps {
  block: RawHtmlBlockModel
  mode: RenderMode
}

export function RawHtmlBlock({ block, mode: _mode }: RawHtmlBlockProps): ReactElement {
  const className = classes('note-raw', block.classes)
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: block.html }}
    />
  )
}

// NoteForge — Shared Renderer / Divider block
//
// DOM contract (Appendix A.2):
//   `<hr class="note-divider" data-style="{style}">`
// `style` is one of solid | dashed | dotted; the visual border style is applied
// via an inline `border-top-style` so it survives the .noteforge-doc scope
// (the fixture CSS sets the rest of the divider visuals).

import type { CSSProperties, ReactElement } from 'react'
import type { DividerBlock as DividerBlockModel } from '@/lib/note-format/types'
import type { RenderMode } from '../types'

export interface DividerBlockProps {
  block: DividerBlockModel
  mode: RenderMode
}

export function DividerBlock({ block, mode: _mode }: DividerBlockProps): ReactElement {
  const style: CSSProperties | undefined = block.style && block.style !== 'solid'
    ? { borderTopStyle: block.style }
    : undefined
  return <hr className="note-divider" data-style={block.style ?? 'solid'} style={style} />
}

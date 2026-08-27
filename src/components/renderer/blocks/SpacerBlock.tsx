// NoteForge — Shared Renderer / Spacer block
//
// DOM contract (Appendix A.2):
//   `<div class="note-spacer" style="height:{height}px"></div>`

import type { CSSProperties, ReactElement } from 'react'
import type { SpacerBlock as SpacerBlockModel } from '@/lib/note-format/types'
import type { RenderMode } from '../types'

export interface SpacerBlockProps {
  block: SpacerBlockModel
  mode: RenderMode
}

export function SpacerBlock({ block, mode: _mode }: SpacerBlockProps): ReactElement {
  const style: CSSProperties = { height: `${block.height}px` }
  return <div className="note-spacer" style={style} aria-hidden="true" />
}

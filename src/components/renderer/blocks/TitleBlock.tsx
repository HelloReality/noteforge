// NoteForge — Shared Renderer / Title block
//
// DOM contract (Appendix A.2):
//   edit/preview: `<div class="note-title [imported classes]">…</div>`
//   public:      `<h1   class="note-title [imported classes]">…</h1>`
// `align` (data-align on the source) is applied as an inline `text-align`
// style so it survives the `.noteforge-doc` CSS scope.

import type { ReactElement } from 'react'

import type { TitleBlock as TitleBlockModel } from '@/lib/note-format/types'
import { alignStyle, classes, type RenderMode } from '../types'

export interface TitleBlockProps {
  block: TitleBlockModel
  mode: RenderMode
}

export function TitleBlock({ block, mode }: TitleBlockProps): ReactElement {
  const className = classes('note-title', block.classes)
  const style = alignStyle(block.align)
  const html = { __html: block.html }
  if (mode === 'public') {
    return <h1 className={className} style={style} dangerouslySetInnerHTML={html} />
  }
  return <div className={className} style={style} dangerouslySetInnerHTML={html} />
}

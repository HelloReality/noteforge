// NoteForge — Shared Renderer / Question block
//
// DOM contract (Appendix A.2):
//   `<div class="note-question [imported classes]">`
//     — if `number` is present: a `<div class="note-question-number">Q{number}</div>`
//       badge rendered BEFORE the children.
//     — then the question's child blocks rendered via BlockRenderer.
//
// Question blocks always use a <div> wrapper in all three modes (no semantic
// tag mapping per §11.4 — only title/heading/paragraph/quote get the public
// semantic mapping).

import type { ReactElement } from 'react'

import type { QuestionBlock as QuestionBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'
import { BlockRenderer } from './BlockRenderer'

export interface QuestionBlockProps {
  block: QuestionBlockModel
  mode: RenderMode
}

export function QuestionBlock({ block, mode }: QuestionBlockProps): ReactElement {
  const className = classes('note-question', block.classes)
  return (
    <div className={className}>
      {block.number !== undefined && (
        <div className="note-question-number">Q{block.number}</div>
      )}
      {block.children.map((child, i) => (
        <BlockRenderer key={i} block={child} mode={mode} />
      ))}
    </div>
  )
}

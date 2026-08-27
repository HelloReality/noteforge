// NoteForge — Shared Renderer / List block
//
// DOM contract (Appendix A.2):
//   `<ul class="note-list note-list--{listType} [imported]">`
//   — for `numbered`: also a `start` attribute (defaulting to 1)
//   — for `check`:    each <li> is prefixed with `<span class="note-check">{☑|☐}</span>`
//   — item content is rendered via dangerouslySetInnerHTML (the `html` field is
//     pre-sanitized at parse time).
//
// For check-lists we inline the check `<span>` markup directly into the
// `<li>`'s innerHTML (concatenated before the sanitized item html). This is
// the exact DOM the spec calls for:
//     `<li><span class="note-check">☑|☐</span>{html}</li>`
// and it avoids the React anti-pattern of mixing JSX children with
// dangerouslySetInnerHTML on the same element.

import type { ReactElement } from 'react'

import type { ListBlock as ListBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface ListBlockProps {
  block: ListBlockModel
  mode: RenderMode
}

export function ListBlock({ block, mode: _mode }: ListBlockProps): ReactElement {
  const className = classes('note-list', `note-list--${block.listType}`, block.classes)
  // `start` is a valid attribute on `<ol>` but not on `<ul>` in React's
  // HTMLAttributes union. We extend the type so the spec's "for `numbered`,
  // add a `start` attribute" requirement can be honored (the spec mandates a
  // `<ul>` for every list type — the injected fixture CSS switches markers
  // based on `.note-list--{type}`).
  const ulProps: React.HTMLAttributes<HTMLUListElement> & { start?: number } = { className }
  if (block.listType === 'numbered' && block.start !== undefined) {
    ulProps.start = block.start
  }
  return (
    <ul {...ulProps}>
      {block.items.map((item, i) => {
        const checkHTML = block.listType === 'check'
          ? `<span class="note-check">${item.checked ? '☑' : '☐'}</span>`
          : ''
        return (
          <li key={i} dangerouslySetInnerHTML={{ __html: checkHTML + item.html }} />
        )
      })}
    </ul>
  )
}

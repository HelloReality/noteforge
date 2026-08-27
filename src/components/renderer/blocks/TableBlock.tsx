// NoteForge — Shared Renderer / Table block
//
// DOM contract (Appendix A.2):
//   `<figure class="note-table [imported]">`
//     `<table dangerouslySetInnerHTML={{ __html: block.html }}>…</table>`
//     `block.html` is the sanitized inner `<table>` HTML (the `<table>` tag's
//     children — `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`, etc.) produced by
//     sanitizeTable at parse time.
//     optional `<figcaption>{caption}</figcaption>` if `caption` is set.

import type { ReactElement } from 'react'

import type { TableBlock as TableBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface TableBlockProps {
  block: TableBlockModel
  mode: RenderMode
}

export function TableBlock({ block, mode: _mode }: TableBlockProps): ReactElement {
  const className = classes('note-table', block.classes)
  return (
    <figure className={className}>
      <table dangerouslySetInnerHTML={{ __html: block.html }} />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

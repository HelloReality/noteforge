// NoteForge — Shared Renderer / Image block
//
// DOM contract (Appendix A.2):
//   `<figure class="note-image [imported]">`
//     if `src`: `<img src alt width height>`
//     else:     `<div class="note-image-broken">broken image</div>`
//     optional `<figcaption>{caption}</figcaption>`
//
// `src` may be undefined when the parser stripped a remote/unsafe src — the
// renderer shows a broken-image placeholder per §10.6 / A.3.5.

import type { ReactElement } from 'react'

import type { ImageBlock as ImageBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface ImageBlockProps {
  block: ImageBlockModel
  mode: RenderMode
}

export function ImageBlock({ block, mode: _mode }: ImageBlockProps): ReactElement {
  const className = classes('note-image', block.classes)
  return (
    <figure className={className}>
      {block.src ? (
        <img
          src={block.src}
          alt={block.alt ?? ''}
          width={block.width}
          height={block.height}
          loading="lazy"
        />
      ) : (
        <div className="note-image-broken">broken image</div>
      )}
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  )
}

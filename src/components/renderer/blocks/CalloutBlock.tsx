// NoteForge — Shared Renderer / Callout block
//
// DOM contract (Appendix A.2):
//   `<div class="note-callout note-callout--{calloutType} [imported]">`
//     — optional `<div class="note-callout-title">{title}</div>`
//     — `<div class="note-callout-body">{html OR children}</div>`
//
// If `x`/`y`/`w`/`z` are set on the block, the outer element is also positioned
// absolutely (style: position:absolute; left/top/width/z-index). The .note-page
// container is `position: relative` so the callout overlays correctly. NotePage
// moves absolutely-positioned callouts to the end of the page DOM so flow
// blocks come first — but Callout itself handles emitting the inline style.
//
// Either `html` or `children` is set on the model (see parse.ts) — never both.
// We render the `html` case via dangerouslySetInnerHTML directly on
// .note-callout-body (no inner wrapper) so the fixture CSS rules that target
// `.note-callout-body …` match exactly.

import type { CSSProperties, ReactElement } from 'react'
import type { CalloutBlock as CalloutBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'
import { BlockRenderer } from './BlockRenderer'

export interface CalloutBlockProps {
  block: CalloutBlockModel
  mode: RenderMode
}

export function CalloutBlock({ block, mode }: CalloutBlockProps): ReactElement {
  const className = classes(
    'note-callout',
    `note-callout--${block.calloutType}`,
    block.classes,
  )
  const style = absoluteStyle(block)
  return (
    <div className={className} style={style}>
      {block.title && <div className="note-callout-title">{block.title}</div>}
      {block.children && block.children.length > 0 ? (
        <div className="note-callout-body">
          {block.children.map((child, i) => (
            <BlockRenderer key={i} block={child} mode={mode} />
          ))}
        </div>
      ) : block.html ? (
        <div
          className="note-callout-body"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      ) : null}
    </div>
  )
}

/** Inline style for absolutely-positioned callouts (x/y/w/z). */
function absoluteStyle(block: CalloutBlockModel): CSSProperties | undefined {
  const has =
    block.x !== undefined ||
    block.y !== undefined ||
    block.w !== undefined ||
    block.z !== undefined
  if (!has) return undefined
  const s: CSSProperties = { position: 'absolute' }
  if (block.x !== undefined) s.left = `${block.x}px`
  if (block.y !== undefined) s.top = `${block.y}px`
  if (block.w !== undefined) s.width = `${block.w}px`
  if (block.z !== undefined) s.zIndex = block.z
  return s
}

/** Used by NotePage to decide whether this callout is positioned (and so
 *  should be rendered after the flow blocks as an overlay). */
export function isPositionedCallout(block: CalloutBlockModel): boolean {
  return (
    block.x !== undefined ||
    block.y !== undefined ||
    block.w !== undefined ||
    block.z !== undefined
  )
}

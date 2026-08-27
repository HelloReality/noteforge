// NoteForge — Shared Renderer / NotePage
//
// DOM contract (Appendix A.2):
//   `<div class="note-page" style="width:..px;height:..px;background:..">…</div>`
//
// Absolutely-positioned blocks (callouts with x/y/w/z) are rendered as the
// LAST children of `.note-page` (after all flow blocks), so the flow blocks
// establish the page's natural layout and the absolutely-positioned callouts
// overlay on top of them. `.note-page` is `position: relative` (set in the
// global rule added to globals.css) so the `position: absolute` style on
// positioned callouts resolves against the page.
//
// This component can be a server component (no `'use client'`).

import type { CSSProperties, ReactElement } from 'react'
import type { Block, CalloutBlock as CalloutBlockModel, NotePage as NotePageModel } from '@/lib/note-format/types'
import type { RenderMode } from './types'
import { BlockRenderer } from './blocks/BlockRenderer'

export interface NotePageProps {
  page: NotePageModel
  mode: RenderMode
}

/** A flow-positioned block OR an absolutely-positioned callout. */
function isPositionedCallout(block: Block): block is CalloutBlockModel {
  if (block.type !== 'callout') return false
  return (
    block.x !== undefined ||
    block.y !== undefined ||
    block.w !== undefined ||
    block.z !== undefined
  )
}

export function NotePage({ page, mode }: NotePageProps): ReactElement {
  const flow: Block[] = []
  const positioned: Block[] = []
  for (const b of page.blocks) {
    if (isPositionedCallout(b)) positioned.push(b)
    else flow.push(b)
  }

  const style: CSSProperties = {
    width: `${page.width}px`,
    height: `${page.height}px`,
    background: page.background,
  }

  return (
    <div className="note-page" style={style}>
      {flow.map((block, i) => (
        <BlockRenderer key={i} block={block} mode={mode} />
      ))}
      {positioned.map((block, i) => (
        <BlockRenderer key={`abs-${i}`} block={block} mode={mode} />
      ))}
    </div>
  )
}

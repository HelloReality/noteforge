// NoteForge — Shared Renderer / Code block
//
// DOM contract (Appendix A.2):
//   `<pre class="note-code [imported]"><code>{text}</code></pre>`
// `white-space: pre` is applied so leading/trailing whitespace and runs of
// spaces survive; if `language` is present, also emit `data-language` so the
// injected fixture CSS can target it. We deliberately do NOT use a syntax
// highlighter library — the fixture CSS styles `<pre>` directly.

import type { ReactElement } from 'react'

import type { CodeBlock as CodeBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface CodeBlockProps {
  block: CodeBlockModel
  mode: RenderMode
}

export function CodeBlock({ block, mode: _mode }: CodeBlockProps): ReactElement {
  const className = classes('note-code')
  // text is plain text (from el.textContent in parse.ts); safe to render
  // as a React text child (no HTML interpretation).
  return (
    <pre className={className} data-language={block.language ?? undefined}>
      <code>{block.text}</code>
    </pre>
  )
}

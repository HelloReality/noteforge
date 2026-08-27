// NoteForge — Shared Renderer / Code block
//
// DOM contract (Appendix A.2):
//   `<pre class="note-code [imported]"><code>{text}</code></pre>`
// `white-space: pre` is applied so leading/trailing whitespace and runs of
// spaces survive; if `language` is present, also emit `data-language`.
// When a language is recognized, the inner <code> uses syntax highlighting
// (Prism via react-syntax-highlighter, lazy-loaded client-side). The outer
// <pre> keeps the `.note-code` class so fixture CSS still applies to the frame.

import type { ReactElement } from 'react'

import type { CodeBlock as CodeBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'
import { CodeHighlight } from '@/components/diagrams/CodeHighlight'

export interface CodeBlockProps {
  block: CodeBlockModel
  mode: RenderMode
}

export function CodeBlock({ block, mode: _mode }: CodeBlockProps): ReactElement {
  const className = classes('note-code', block.classes)
  return (
    <pre className={className} data-language={block.language ?? undefined}>
      {block.language ? (
        <CodeHighlight code={block.text} language={block.language} />
      ) : (
        <code>{block.text}</code>
      )}
    </pre>
  )
}

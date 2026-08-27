// NoteForge — Shared Renderer / Diagram block
//
// DOM contract (Appendix A.2):
//   `<div class="note-diagram note-diagram--{diagramType} [imported]"
//        data-width data-height data-title>`
// containing:
//   - `mermaid`:     a client component `<MermaidDiagram source={block.source} />`
//                    (dynamically imported with ssr:false). On render error,
//                    the client component itself falls back to
//                    `<pre class="note-diagram-fallback">{source}</pre>`.
//   - `svg`:         `<div dangerouslySetInnerHTML={{__html: block.source}} />`
//                    (the source is pre-sanitized case-preserved SVG).
//   - `excalidraw`:  a client component `<ExcalidrawDiagram source={block.source} />`
//                    (dynamically imported with ssr:false).
//
// This component is a CLIENT component because `next/dynamic` with `ssr:false`
// cannot be used from a server component in Next.js 16. The mermaid / excalidraw
// heavy runtimes are still only fetched client-side when actually needed
// (each diagramType has its own dynamic chunk).

'use client'

import type { ReactElement } from 'react'
import dynamic from 'next/dynamic'
import type { DiagramBlock as DiagramBlockModel } from '@/lib/note-format/types'
import { classes, type RenderMode } from '../types'

export interface DiagramBlockProps {
  block: DiagramBlockModel
  mode: RenderMode
}

// Stable module-level dynamic components. Defined OUTSIDE render so React
// doesn't see "components created during render" (which would reset state on
// every render). The `loading` placeholder renders an empty `<pre>` so the
// SSR HTML for a mermaid/excalidraw block isn't completely blank — the actual
// source fallback is rendered by the client component itself before the
// heavy runtime finishes rendering.
const MermaidClient = dynamic(
  () =>
    import('@/components/diagrams/MermaidDiagram').then((m) => ({ default: m.MermaidDiagram })),
  {
    ssr: false,
    loading: () => <pre className="note-diagram-fallback note-diagram-fallback--loading" aria-label="Loading diagram…" />,
  },
)
const ExcalidrawClient = dynamic(
  () =>
    import('@/components/diagrams/ExcalidrawDiagram').then((m) => ({ default: m.ExcalidrawDiagram })),
  {
    ssr: false,
    loading: () => <pre className="note-diagram-fallback note-diagram-fallback--loading" aria-label="Loading diagram…" />,
  },
)

export function DiagramBlock({ block, mode: _mode }: DiagramBlockProps): ReactElement {
  const className = classes(
    'note-diagram',
    `note-diagram--${block.diagramType}`,
    block.classes,
  )
  const wrapperProps = {
    className,
    'data-width': block.width ?? undefined,
    'data-height': block.height ?? undefined,
    'data-title': block.title ?? undefined,
  }

  // SVG: server-rendered sanitized source, no client hydration needed.
  if (block.diagramType === 'svg') {
    return (
      <div {...wrapperProps}>
        <div dangerouslySetInnerHTML={{ __html: block.source }} />
      </div>
    )
  }

  if (block.diagramType === 'excalidraw') {
    return (
      <div {...wrapperProps}>
        <ExcalidrawClient source={block.source} />
      </div>
    )
  }

  // mermaid (default / fallback for any unknown diagramType)
  return (
    <div {...wrapperProps}>
      <MermaidClient source={block.source} />
    </div>
  )
}

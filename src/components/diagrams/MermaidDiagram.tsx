// NoteForge — Shared Renderer / Mermaid diagram (CLIENT COMPONENT)
//
// Loaded via `next/dynamic` with `ssr: false` from DiagramBlock so the heavy
// mermaid runtime is only fetched on the client. We render the source as a
// `<pre class="note-diagram-fallback">` placeholder while mermaid is loading
// / on render error, and replace it with the rendered SVG (via React state +
// dangerouslySetInnerHTML) once mermaid finishes.

'use client'

import { useEffect, useState, type ReactElement } from 'react'

export interface MermaidDiagramProps {
  source: string
}

let renderCounter = 0

export function MermaidDiagram({ source }: MermaidDiagramProps): ReactElement {
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvgHtml(null)
    setError(false)

    void import('mermaid')
      .then(({ default: mermaid }) => {
        if (cancelled) return
        try {
          mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' })
          const id = `mf-mermaid-${++renderCounter}`
          void mermaid
            .render(id, source)
            .then(({ svg }) => {
              if (cancelled) return
              setSvgHtml(svg)
            })
            .catch(() => {
              if (!cancelled) setError(true)
            })
        } catch {
          if (!cancelled) setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [source])

  // Render the source as the fallback placeholder until mermaid produces
  // an SVG (or on error).
  if (error || !svgHtml) {
    return <pre className="note-diagram-fallback">{source}</pre>
  }
  return (
    <div
      className="note-diagram-mermaid"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  )
}

export default MermaidDiagram

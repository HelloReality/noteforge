// NoteForge — Shared Renderer / Excalidraw diagram (CLIENT COMPONENT)
//
// Loaded via `next/dynamic` with `ssr: false` from DiagramBlock so the heavy
// `@excalidraw/excalidraw` runtime is only fetched on the client. We parse
// the JSON source and use `exportToSvg` to render a static SVG snapshot (no
// UI chrome, no interactivity). On JSON parse error or export error, fall
// back to `<pre class="note-diagram-fallback">{source}</pre>`.

'use client'

import { useEffect, useState, type ReactElement } from 'react'

export interface ExcalidrawDiagramProps {
  source: string
}

interface ExcalidrawScene {
  elements?: unknown[]
  appState?: Record<string, unknown>
  files?: Record<string, unknown>
}

export function ExcalidrawDiagram({ source }: ExcalidrawDiagramProps): ReactElement {
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSvgHtml(null)
    setError(false)

    let parsed: ExcalidrawScene
    try {
      parsed = JSON.parse(source) as ExcalidrawScene
      if (!Array.isArray(parsed.elements)) throw new Error('not an excalidraw scene')
    } catch {
      if (!cancelled) setError(true)
      return
    }

    void import('@excalidraw/excalidraw')
      .then(({ exportToSvg }) => {
        if (cancelled) return
        const appState = {
          exportBackground: true,
          viewBackgroundColor:
            (parsed.appState && (parsed.appState.viewBackgroundColor as string)) || '#ffffff',
          exportWithDarkMode: false,
          ...parsed.appState,
        }
        void exportToSvg(
          parsed.elements as never,
          appState as never,
          (parsed.files ?? {}) as never,
        )
          .then((svg) => {
            if (cancelled) return
            // Serialize the live SVGSVGElement into a string so we can render
            // it via dangerouslySetInnerHTML (React state, no ref juggling).
            setSvgHtml(svg.outerHTML)
          })
          .catch(() => {
            if (!cancelled) setError(true)
          })
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [source])

  if (error || !svgHtml) {
    return <pre className="note-diagram-fallback">{source}</pre>
  }
  return (
    <div
      className="note-diagram-excalidraw"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  )
}

export default ExcalidrawDiagram

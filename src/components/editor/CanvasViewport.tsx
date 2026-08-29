// NoteForge — CanvasViewport: the editor's center area that renders the
// current page as a fixed-size artboard, scaled to fit the available space.
//
// Architecture:
//   CanvasViewport (overflow: auto, measures available space)
//     └── CanvasStage (sized to pageWidth*scale × pageHeight*scale, centers the page)
//          └── PageWrapper (transform: scale(scale), transform-origin: top left)
//               └── NotePage (fixed pageWidth × pageHeight — the document coordinate system)
//
// The page ALWAYS uses its real document dimensions (e.g. 1024×1400). Only the
// visual scale changes — the document coordinate system is never modified.
//
// Zoom modes:
//   'fit'  — auto-calculate scale to fit the viewport (with padding)
//   number — explicit scale (0.5, 0.75, 1, 1.25, 1.5, 2, …)
//
// The page is centered both horizontally and vertically in the viewport.
// When zoomed in beyond 'fit', the viewport scrolls naturally.

'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

export type ZoomMode = 'fit' | number

export interface CanvasViewportProps {
  /** The fixed-width of the page (document coordinate, in px). */
  pageWidth: number
  /** The fixed-height of the page (document coordinate, in px). */
  pageHeight: number
  /** The page content (usually <NoteRenderer mode="preview" /> for a single page). */
  children: ReactNode
  /** Padding around the page inside the viewport (in screen px). */
  padding?: number
  /** Controlled zoom mode, or undefined to use internal state. */
  zoom?: ZoomMode
  /** Called when the effective scale changes (for the toolbar display). */
  onScaleChange?: (scale: number) => void
}

export function CanvasViewport({
  pageWidth,
  pageHeight,
  children,
  padding = 48,
  zoom: controlledZoom,
  onScaleChange,
}: CanvasViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [internalZoom, setInternalZoom] = useState<ZoomMode>('fit')
  const zoom = controlledZoom ?? internalZoom

  // Measure the viewport size whenever the element resizes.
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = () => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Calculate the effective scale.
  const scale = (() => {
    if (zoom === 'fit') {
      const availW = viewportSize.width - padding * 2
      const availH = viewportSize.height - padding * 2
      if (availW <= 0 || availH <= 0) return 1 // not measured yet
      const sx = availW / pageWidth
      const sy = availH / pageHeight
      return Math.min(sx, sy, 2) // cap at 2x so tiny pages don't overscale
    }
    return zoom
  })()

  // Report scale changes to the parent (for the toolbar % display).
  useEffect(() => {
    onScaleChange?.(scale)
  }, [scale, onScaleChange])

  // The stage is sized to the SCALED page dimensions so the flex centering
  // works correctly and the scroll area matches the visual size.
  const stageStyle: CSSProperties = {
    width: `${pageWidth * scale}px`,
    height: `${pageHeight * scale}px`,
    flexShrink: 0,
  }

  // The page wrapper applies the scale transform. transform-origin is top-left
  // so the page scales from its natural origin (0,0 = top-left of the page).
  const pageWrapperStyle: CSSProperties = {
    width: `${pageWidth}px`,
    height: `${pageHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    position: 'absolute',
    top: 0,
    left: 0,
  }

  return (
    <div
      ref={viewportRef}
      className="canvas-viewport relative h-full w-full overflow-auto bg-stone-100"
      style={{ minHeight: 0 }}
    >
      {/* The centering flex container. It's at least as big as the viewport
          so the page is centered when smaller than the viewport, and grows
          to contain the scaled page when zoomed in. */}
      <div
        className="flex min-h-full min-w-full items-center justify-center"
        style={{ padding: `${padding}px` }}
      >
        {/* The stage — sized to the scaled page dimensions. This is the
            scrollable footprint. position: relative so the page wrapper
            can be absolutely positioned inside it. */}
        <div className="relative" style={stageStyle}>
          <div style={pageWrapperStyle}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Zoom presets for the toolbar dropdown. */
export const ZOOM_PRESETS: { label: string; value: ZoomMode }[] = [
  { label: 'Fit', value: 'fit' },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
]

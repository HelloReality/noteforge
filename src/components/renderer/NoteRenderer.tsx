// NoteForge — Shared Renderer / NoteRenderer
//
// THE only renderer. Takes a `NoteDocument` model + a `mode` and renders
// identical structure across all three modes (`'edit' | 'preview' | 'public'`).
// Differences between modes are limited to interactivity affordances (the
// public mode additionally emits semantic tags for accessibility/SEO per
// §11.4; edit/preview use stable `<div>` wrappers). The emitted base class
// names are identical in every mode (this is what the fixture stylesheets
// depend on — see Appendix A.2).
//
// Public API:
//   <NoteRenderer doc={model} mode="preview" />
//
// This is a SERVER component (no `'use client'`): it just composes the block
// components and injects the scoped CSS string. Block components that need
// client hydration (DiagramBlock, via next/dynamic with ssr:false) mark
// themselves `'use client'` locally — server components can import client
// components.
//
// CSS scoping (SPEC §11 + this task):
//   `model.css` is the sanitized stylesheet from the parsed document. We
//   prefix every top-level selector with `.noteforge-doc ` so the rules only
//   apply inside the renderer root and never leak into the app chrome. The
//   helper lives in `src/lib/note-format/css.ts` (added there, alongside the
//   existing sanitizers).

import type { ReactElement } from 'react'

import type { NoteDocument } from '@/lib/note-format/types'
import { scopeCss } from '@/lib/note-format/css'
import { NotePage } from './NotePage'
import type { RenderMode } from './types'

export interface NoteRendererProps {
  doc: NoteDocument
  mode?: RenderMode
}

/** CSS scope used for the injected stylesheet — must match the root class. */
export const NOTEFORGE_SCOPE = '.noteforge-doc'

export function NoteRenderer({ doc, mode = 'public' }: NoteRendererProps): ReactElement {
  const scopedCss = scopeCss(doc.css ?? '', NOTEFORGE_SCOPE)
  return (
    <div className="noteforge-doc" data-mode={mode}>
      {scopedCss ? (
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
      ) : null}
      <div className="noteforge-pages mx-auto my-8 flex max-w-[1100px] flex-col items-center gap-8">
        {doc.pages.map((page, i) => (
          <NotePage key={i} page={page} mode={mode} />
        ))}
      </div>
    </div>
  )
}

export default NoteRenderer

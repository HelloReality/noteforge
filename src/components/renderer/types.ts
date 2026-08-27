// NoteForge — Shared Renderer
// src/components/renderer/types.ts
//
// Internal renderer type for the three rendering modes. Differences between
// modes are limited to interactivity affordances (selection outlines, drag
// handles in `edit`); the emitted DOM structure and class names are identical
// across all three modes (see SPEC §11 + Appendix A.2).
//
// The one structural difference is the `public` semantic-tag mapping
// (title → <h1>, heading → <h2|h3|h4>, paragraph → <p>, quote → <blockquote>).

import type { ComponentType, CSSProperties, ReactNode } from 'react'

export type RenderMode = 'edit' | 'preview' | 'public'

/** Shared props for every block component. */
export interface BlockProps<TBlock> {
  block: TBlock
  mode: RenderMode
}

/** A class-name joiner that drops falsy values. Kept tiny so we don't pull clsx
 *  into the server bundle just for class joining (the project has it anyway,
 *  but inlining keeps the renderer dependency-free). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/**
 * Build the className string for a rendered element. Always includes the base
 * class (e.g. `note-paragraph`), then any imported classes from the parsed
 * model, plus an optional list of extra renderer classes (used by edit mode
 * for selection outlines etc.).
 *
 * Accepts a variadic mix of strings and string arrays — both flattened and
 * joined (falsy values are dropped). This lets block components call e.g.
 * `classes('note-callout', `note-callout--${type}`, block.classes)` without
 * having to remember which arg is the imported-classes array.
 */
export function classes(...parts: Array<string | string[] | false | null | undefined>): string {
  const flat: string[] = []
  for (const p of parts) {
    if (Array.isArray(p)) {
      for (const c of p) if (c) flat.push(c)
    } else if (p) {
      flat.push(p)
    }
  }
  return flat.join(' ')
}

/**
 * Convert an `align` field into an inline `text-align` style. We use inline
 * style (rather than Tailwind/`data-align` classes) so the injected fixture
 * stylesheets can still override per-element when needed, and so the value
 * survives the `.note-page` scoping wrapper.
 */
export function alignStyle(align?: 'left' | 'center' | 'right'): CSSProperties | undefined {
  if (!align) return undefined
  return { textAlign: align }
}

/** Convenience type alias for components that compose children. */
export type Component<P = unknown> = ComponentType<P>
export type Children = ReactNode

# Task 2-b — Shared Renderer (work record)

**Task ID:** 2-b
**Agent:** shared-renderer (renderer)
**Task:** Build the Shared Renderer (`src/components/renderer/`) + diagram client components for the NoteForge visual-notes platform. Takes a `NoteDocument` model + a `mode` and renders identical structure across `'edit' | 'preview' | 'public'`. Differences are limited to public-mode semantic tag mapping (§11.4) and (future) edit-mode affordances — DOM structure & class names are identical in all modes (Appendix A.2 binding contract).

## Work Log

- Read `worklog.md`, `SPEC.md` §11 + Appendix A.2, `types.ts`, `css.ts`, `parse.ts`, all three fixtures.
- `bun add mermaid @excalidraw/excalidraw` — installed `mermaid@11.17.2` + `@excalidraw/excalidraw@0.18.1` (191 packages installed, lockfile updated). No pre-existing packages broken.
- Added `scopeCss(css, scope)` to `src/lib/note-format/css.ts` (appended; existing exports untouched). Brace-matching tokenizer (reuses `parseBlock`'s pattern from the sanitizers), strips comments, walks top-level rules, prefixes each style-rule's comma-separated selector list with the scope (idempotent + replaces `html`/`body`/`:root` with the scope), recurses into `@media` / `@supports` / `@container` / `@layer`, passes through `@keyframes` / `@font-face` / `@import` / `@charset` unchanged (no scoping).
- Built the renderer in `src/components/renderer/`:
  - `NoteRenderer.tsx` — server component; props `{ doc: NoteDocument; mode?: 'edit'|'preview'|'public' }` (default `'public'`); wraps everything in `<div class="noteforge-doc" data-mode={mode}>`; injects `<style>` with the scoped `model.css`; maps pages into a centered Tailwind stack (`.noteforge-pages mx-auto my-8 flex max-w-[1100px] flex-col items-center gap-8`).
  - `NotePage.tsx` — renders one `NotePage` as `<div class="note-page" style="width/height/background">`; splits blocks into flow vs absolutely-positioned (callouts with any of x/y/w/z), renders flow blocks first then the absolute callouts (so flow establishes the page layout and positioned callouts overlay on top).
  - `blocks/BlockRenderer.tsx` — block dispatcher (switch on `block.type`); used by `NotePage`, `QuestionBlock`, `CalloutBlock` for nested children.
  - 14 block components (per Appendix A.2 contract, all named `<Type>Block`):
    - `TitleBlock` — `<div class="note-title">` in edit/preview, `<h1 class="note-title">` in public; `align` → inline `text-align`.
    - `HeadingBlock` — `<div class="note-heading" data-level>` in edit/preview, `<h2|h3|h4 class="note-heading">` in public.
    - `ParagraphBlock` — `<div|p class="note-paragraph">`; merges `align` + sanitized `style` field as inline style.
    - `QuestionBlock` — `<div class="note-question [imported]">` with `<div class="note-question-number">Q{n}</div>` badge before children (when `number` set).
    - `ListBlock` — `<ul class="note-list note-list--{type} [imported]">`; `start` attribute for numbered; check-list items have `<span class="note-check">☑|☐</span>` prepended into the `<li>`'s dangerouslySetInnerHTML (concatenated with the sanitized item html — exact DOM contract, avoids the React anti-pattern of mixing JSX children with dangerouslySetInnerHTML on the same element).
    - `CalloutBlock` — `<div class="note-callout note-callout--{type} [imported]">` with optional `<div class="note-callout-title">` and `<div class="note-callout-body">` (body uses dangerouslySetInnerHTML directly on the body div for the `html` case, or BlockRenderer children — no extra wrapper span); if `x/y/w/z` set, inline `position:absolute; left/top/width/z-index` on the outer div.
    - `DefinitionBlock` — `<div class="note-definition">` with inner HTML assembled as `<span class="note-definition-term">{escaped term}</span> {html}` (rendered via dangerouslySetInnerHTML on the outer div — exact contract, no inner span).
    - `QuoteBlock` — `<blockquote class="note-quote">` with inner HTML assembled as `{html}` + (optional) `<cite class="note-quote-cite">{escaped cite}</cite>` (rendered via dangerouslySetInnerHTML on the blockquote — exact contract).
    - `DividerBlock` — `<hr class="note-divider" data-style>` with inline `border-top-style` (when not solid) so the dashed/dotted visual survives the scope.
    - `SpacerBlock` — `<div class="note-spacer" style="height:{h}px" aria-hidden>`.
    - `CodeBlock` — `<pre class="note-code"><code>{text}</code></pre>` with `data-language` when `language` set; no syntax highlighter (per spec — fixture CSS styles `<pre>`).
    - `TableBlock` — `<figure class="note-table [imported]"><table dangerouslySetInnerHTML={{__html: block.html}} />{optional <figcaption>}</figure>`.
    - `ImageBlock` — `<figure class="note-image [imported]">` with `<img src alt width height loading="lazy">` OR `<div class="note-image-broken">broken image</div>` (when `src` was stripped by the parser) + optional `<figcaption>`.
    - `DiagramBlock` — CLIENT component (`'use client'`, needed because `next/dynamic` with `ssr:false` cannot run in a server component in Next.js 16). Emits `<div class="note-diagram note-diagram--{type} [imported]" data-width data-height data-title>` containing: SVG case = `<div dangerouslySetInnerHTML={{__html: block.source}} />` (server-rendered); mermaid & excalidraw cases = a module-level dynamic import of the matching client component with `ssr: false` and a `loading: () => <pre class="note-diagram-fallback note-diagram-fallback--loading" />` placeholder so SSR HTML isn't blank. The dynamic components are defined at MODULE scope (no `dynamic()` call during render — passes the react-hooks/static-components lint rule).
  - `RichText.tsx` — small inline `<span>` helper for the (rare) case where a sanitized html string needs an inline wrapper (kept for API completeness; not currently used by any block since each block emits its own element with the right base class).
  - `types.ts` — internal helpers: `RenderMode`, `classes(base, imported[], extra[])` (variadic, flattens arrays + drops falsy), `alignStyle()`, `cx()`.
  - `index.ts` — re-exports `NoteRenderer` + `NoteRendererProps` + `RenderMode` (the public API).
- Built diagram client components in `src/components/diagrams/`:
  - `MermaidDiagram.tsx` (`'use client'`) — lazy `import('mermaid')` inside `useEffect`, calls `mermaid.render(id, source)` and stores the resulting SVG via React state + `dangerouslySetInnerHTML`. Renders `<pre class="note-diagram-fallback">{source}</pre>` while loading and on render error (matches the spec's fallback contract). Unique id per render to keep generated SVGs distinct.
  - `ExcalidrawDiagram.tsx` (`'use client'`) — parses the JSON source, lazy `import('@excalidraw/excalidraw')` inside `useEffect`, calls `exportToSvg(elements, appState, files)` and serializes the resulting `SVGSVGElement` via `outerHTML` into React state + `dangerouslySetInnerHTML`. Renders `<pre class="note-diagram-fallback">{source}</pre>` while loading and on JSON parse / export error.
- Appended minimal structural rules to `src/app/globals.css` (NOT inside `@layer base` — placed after it so injected fixture stylesheets can override per-element): `.noteforge-doc *` box-sizing border-box; `.noteforge-doc .note-page` position:relative + box-shadow + border-radius + overflow:hidden (so absolutely-positioned callouts resolve against the page frame); `.noteforge-doc .noteforge-pages` horizontal scroll for wide pages on small screens.
- Smoke-tested:
  - `scopeCss` correctly prefixes `.note-page`, `.q-card`, `.note-page table`, etc. with `.noteforge-doc ` and recurses into `@media`; passes through `@keyframes`/`@font-face`; replaces `html`/`body`/`:root` with the scope.
  - `renderToStaticMarkup(<NoteRenderer doc={parseNoteHtml(minimal).model} mode="public" />)` produces the exact Appendix A.2 DOM: `<div class="noteforge-doc" data-mode="public"><style>…scoped…</style><div class="note-pages"><div class="note-page" style="…"><h1 class="note-title" style="text-align:center">…</h1><div class="note-question q-card"><div class="note-question-number">Q37</div><h2 class="note-heading">…</h2>…<div class="note-callout note-callout--tip"><div class="note-callout-title">Exam tip</div><div class="note-callout-body">…</div></div>…</div></div></div></div>`.
  - All three modes render correctly. Edit/preview emit `<div>` wrappers + `data-level` on headings; public emits `<h1>`/`<h2>`/`<h3>`/`<p>` (per §11.4) with identical class names.
  - Full fixture: page 2 renders the SVG diagram (case-preserved: `linearGradient`, `markerWidth`, `marker-end` all intact), numbered list with `start="1"`, the absolutely-positioned callout (`note-callout--warning` with `style="position:absolute;left:620px;top:36px;width:230px;z-index:10"`) at the end of the page DOM (after the spacer + paragraph + last flow block), Excalidraw diagram shows the loading fallback during SSR (the client component replaces it on hydration), data-URI image renders with `<img src width height>` + `<figcaption>`, divider/spacer/code blocks all emit the right contract DOM.
  - Malicious fixture renders safely: all A.4 negative assertions pass (no `<script>`, no `on*=` handlers, no `javascript:`, no `data:text/html`, no `evil.com`, no `@import`, no `position:fixed`, no `<!--`); positive assertion passes (`.mf-q` rule with `#b91c1c` survives in the scoped CSS). The renderer root `.noteforge-doc` is present.
- `bun run lint` — passes cleanly (zero errors, zero warnings). `bunx tsc --noEmit` — zero errors from any file I created or modified (the only remaining tsc errors are all pre-existing: `examples/websocket/*` missing socket.io modules, `scripts/verify-parse.ts` line 49, `skills/*` untyped z-ai-web-dev-sdk internals, and `src/lib/note-format/parse.ts` line 201 — none touched by me, all out of task scope).
- Did NOT touch `src/lib/note-format/types.ts`, `parse.ts`, `sanitize.ts`, `serialize.ts` (only appended the new `scopeCss` export to `css.ts`, leaving all existing exports untouched). Did NOT touch any API route, `prisma/`, `src/lib/server/`, `src/lib/db.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/ui/*`. Did NOT create any page under `src/app`.

## Stage Summary

**Public API:** `<NoteRenderer doc={model} mode="..." />` (named export from `src/components/renderer/index.ts`), accepting `{ doc: NoteDocument; mode?: 'edit'|'preview'|'public' }` (default `'public'`).

**Files created:**
- `src/components/renderer/NoteRenderer.tsx` — server component, root + scoped `<style>` + page mapping.
- `src/components/renderer/NotePage.tsx` — one `.note-page` + flow / absolute block split.
- `src/components/renderer/blocks/BlockRenderer.tsx` — block dispatcher.
- `src/components/renderer/blocks/{Title,Heading,Paragraph,Question,List,Callout,Definition,Quote,Divider,Spacer,Code,Table,Image,Diagram}Block.tsx` — 14 block components, one per Appendix A.2 type.
- `src/components/renderer/RichText.tsx` — inline rich-text helper.
- `src/components/renderer/types.ts` — internal `RenderMode` + `classes` + `alignStyle` helpers.
- `src/components/renderer/index.ts` — public re-exports.
- `src/components/diagrams/MermaidDiagram.tsx` — `'use client'`, lazy-loads mermaid, falls back to `<pre>{source}</pre>` on error.
- `src/components/diagrams/ExcalidrawDiagram.tsx` — `'use client'`, lazy-loads `@excalidraw/excalidraw`, uses `exportToSvg` for static render, falls back to `<pre>{source}</pre>` on JSON parse / export error.

**Files modified (additive only):**
- `src/lib/note-format/css.ts` — appended `scopeCss(css, scope)` export (existing exports untouched).
- `src/app/globals.css` — appended small `.noteforge-doc *` / `.note-page` / `.noteforge-pages` structural rules after the existing `@layer base` (existing content untouched).
- `package.json` + `bun.lock` — added `mermaid` + `@excalidraw/excalidraw` (via `bun add`).

**Verification:**
- `bun add mermaid @excalidraw/excalidraw` — succeeded (mermaid@11.17.2, @excalidraw/excalidraw@0.18.1).
- `scopeCss` exported from `src/lib/note-format/css.ts` (line 204).
- 22 component files created (14 block + 2 diagram client + NoteRenderer + NotePage + RichText + types + BlockRenderer + index).
- `bun run lint` — passes cleanly (0 errors, 0 warnings).
- `bunx tsc --noEmit` — 0 errors in any file I created/modified (only pre-existing out-of-scope errors remain).
- Smoke tests against all 3 fixtures pass: correct DOM contract (Appendix A.2), correct public-mode semantic mapping (§11.4), absolutely-positioned callouts overlay correctly, SVG diagrams preserve case (`linearGradient` / `markerWidth` / `marker-end`), and the malicious fixture's A.4 security assertions all pass on the rendered HTML.

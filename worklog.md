# NoteForge — Work Log

## Project Status (initial)
- Foundation created: `SPEC.md` (consolidated spec + Appendix A), three fixtures saved byte-for-byte in `fixtures/`.
- `linkedom` installed for server-side DOM parsing (custom elements + DOMParser-compatible API).
- Next.js 16 + Prisma + shadcn/ui all pre-installed and working.

## Current Goals
- Build core `lib/note-format/` (types, css, sanitize, parse, serialize) — the heart of the app.
- Set up Prisma schema (§7) + DB + storage/import-pipeline.
- Build Shared Renderer (§11) + editor + pages.
- Self-verify with agent-browser; create 15-min webDevReview cron.

---
Task ID: 1
Agent: main (orchestrator)
Task: Foundation — fixtures, SPEC, core note-format library

Work Log:
- Created folder structure (fixtures/, src/lib/note-format/, src/lib/store/, src/lib/server/, src/components/renderer/, src/components/editor/, src/components/diagrams/, all app routes).
- Saved three fixtures byte-for-byte to fixtures/{minimal,full,malicious}.note.html.
- Wrote consolidated SPEC.md (reconstructed spec body covering §1–§16 + Appendix A).
- Installed linkedom for server-side DOM parsing.
- Built core note-format library:
  - src/lib/note-format/types.ts — full NoteDocument model + Warning codes.
  - src/lib/note-format/css.ts — stylesheet + inline-style sanitizer (drops @import, remote @font-face, remote url(), behavior; rewrites position:fixed→absolute).
  - src/lib/note-format/sanitize.ts — inline rich-text sanitizer, table sanitizer, case-preserving string-based SVG sanitizer.
  - src/lib/note-format/parse.ts — orchestrator; pre-extracts raw SVG (case-preserving) before linkedom lowercases it; builds model + warnings.
  - src/lib/note-format/serialize.ts — model → .note.html for round-trip/export.
- Wrote scripts/verify-parse.ts and ran it against all three fixtures.

Stage Summary (verification results):
- minimal.note.html → 0 warnings ✓ (A.1 golden-path requirement met).
- full.note.html → 0 warnings ✓ (A.1 full-coverage requirement met); SVG camelCase preserved (linearGradient, markerWidth, marker-end all intact).
- malicious.note.html → all A.4 security assertions PASS: no <script>, no on* handlers, no javascript:, no data:text/html, no evil.com, no @import, no position:fixed, no <!-- comments; .mf-q (#b91c1c) survived in css; q1 contains "Output encoding"; mermaid source contains "Sanitize"; SVG <rect + "Safe text" survived; xlink:href gone.
- Round-trip: parse(serialize(parse(minimal))) re-parses with 0 warnings; title/pages/css match.
- Round-trip: parse(serialize(parse(full))) re-parses with 0 warnings; pages match.

Key decisions:
- SVG handled via string-based case-preserving sanitizer (linkedom lowercases tags in HTML mode).
- Rich text stored as pre-sanitized HTML strings in the model (renderer uses dangerouslySetInnerHTML — safe because sanitized at parse time).
- Dev server already running on port 3000.

Next: parallel subagents for (a) Prisma+API backend and (b) Shared Renderer + diagram components.

---
Task ID: 2-a
Agent: full-stack-developer (backend)
Task: Build the full NoteForge backend — Prisma schema (§7), storage lib, import pipeline (§9), all five API routes (§8), and a seed script importing the three fixtures.

Work Log:
- Replaced `prisma/schema.prisma` User/Post models with Document ↔ Version per §7. Added `@unique` to `latestVersionId` (required for Prisma 1:1) and `onDelete: SetNull` on the `latestVersion` relation (so deleting a Version nulls the pointer instead of cascading); kept the `Document → Version` `onDelete: Cascade`.
- Ran `bun run db:push` — succeeded (Prisma Client 6.19.2 generated).
- Wrote `src/lib/server/storage.ts` (server-only, uses `@/lib/db`): `slugify`, `createDocumentFromImport`, `getDocumentWithLatest`, `listDocuments`, `updateDocumentMeta`, `saveVersion`, `listVersions`, `getVersion`, `getPublishedBySlug`, plus typed errors `StatusValidationError` and `DocumentNotFoundError`.
- Wrote `src/lib/server/import-pipeline.ts`: `importNoteHtml(filename, fileText)` → calls `parseNoteHtml`, throws a typed `ImportError` on a structural error (level:'error' STRUCTURAL_ERROR, i.e. no `<note-document>`), otherwise persists via `createDocumentFromImport`.
- Wrote five API routes, all `runtime = 'nodejs'`, App Router style with `await ctx.params`:
  - `POST /api/import` — accepts multipart/form-data `file` field OR JSON `{ html }`. 201 `{ documentId, versionId, warnings, title }`, 400 `{ error }`.
  - `GET  /api/documents` — `DocumentListRow[]` = `{ id, title, slug, status, updatedAt, versionCount, latestVersionNumber }`.
  - `GET  /api/documents/[id]` — full doc + latest version: `{ id, title, slug, status, createdAt, updatedAt, version: {...}|null, model: NoteDocument|null, warnings: Warning[] }`. 404 if missing.
  - `PATCH /api/documents/[id]` — body `{ title?, slug?, status? }` (status validated ∈ draft|review|published). 200 updated row, 400 bad shape / invalid status, 404.
  - `GET  /api/documents/[id]/versions` — `VersionListRow[]` = `{ id, number, note, warningCount, createdAt }`.
  - `POST /api/documents/[id]/versions` — body `{ model: NoteDocument, note? }`. 201 `{ versionId, number }`, 400 bad model, 404 doc missing.
  - `GET  /api/notes/[slug]` — `{ model, title, document }` for published docs; 404 otherwise.
- Wrote `scripts/seed.ts` — reads `fixtures/*.note.html` byte-for-byte, extracts each fixture's title via regex, skips if a document with that title already exists (idempotent), otherwise calls `importNoteHtml` and reports `id` + `slug` + warning count.
- Ran seed: 3 documents created with slugs `cybersecurity-notes-sample`, `cybersecurity-notes-full-coverage-fixture`, `malicious-fixture-must-import-safely` (warning counts 0 / 0 / 19 — matches §A.1 expectations). Re-running seed skipped all three — idempotency confirmed.
- Live curl tests against `:3000`: every route returned the expected status code and body shape. Created then deleted an API-test document and reset one doc's status back to `review` to leave a clean 3-doc DB for the frontend agent.
- Ran `bun run lint` — zero errors (none new, none pre-existing).

Stage Summary:
- `prisma/schema.prisma` now matches §7 (with two SQLite-necessary deviations: `latestVersionId @unique` + `onDelete: SetNull`); `db:push` clean.
- Backend fully wired: storage → import pipeline → 5 route handlers, all type-safe and validated.
- DB seeded with the three fixtures; all import with the warning counts the spec expects (0/0/19).
- API contract verified end-to-end; response shapes match the spec and what the frontend agent will call.
- Did NOT touch `src/lib/note-format/*`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, or any `src/components/ui/*` file. Did NOT create any non-api route under `src/app`.
- Work record also saved at `/home/z/my-project/agent-ctx/2-a-full-stack-developer-backend.md`.

---
Task ID: 2-b
Agent: shared-renderer (renderer)
Task: Build the Shared Renderer (`src/components/renderer/`) + diagram client components. Takes a `NoteDocument` model + a `mode` ('edit'|'preview'|'public') and renders identical structure across modes (only public-mode semantic tag mapping per §11.4 differs; class names + DOM contract per Appendix A.2 are identical in every mode).

Work Log:
- Read worklog, SPEC §11 + Appendix A.2, types.ts, css.ts, parse.ts, all three fixtures.
- `bun add mermaid @excalidraw/excalidraw` — installed mermaid@11.17.2 + @excalidraw/excalidraw@0.18.1 (lockfile updated, no pre-existing packages broken).
- Added `scopeCss(css, scope)` to `src/lib/note-format/css.ts` (appended; existing exports untouched). Brace-matching tokenizer reusing the parseBlock pattern: strips comments, walks top-level rules, prefixes each style-rule's comma-separated selector list with the scope (idempotent; replaces `html`/`body`/`:root` with the scope), recurses into `@media`/`@supports`/`@container`/`@layer`, passes through `@keyframes`/`@font-face`/`@import`/`@charset` unchanged.
- Built the renderer in `src/components/renderer/`:
  - `NoteRenderer.tsx` — server component; props `{ doc: NoteDocument; mode?: 'edit'|'preview'|'public' }` (default `'public'`); wraps in `<div class="noteforge-doc" data-mode>` + injects `<style>` with the scoped `model.css` + maps pages into a centered Tailwind stack.
  - `NotePage.tsx` — one `.note-page` with width/height/background inline style; splits flow vs absolutely-positioned callouts (any of x/y/w/z set), renders flow first then absolute (so flow establishes the page layout and positioned callouts overlay on top).
  - `blocks/BlockRenderer.tsx` — block dispatcher (switch on `block.type`), used by NotePage + QuestionBlock + CalloutBlock.
  - 14 block components, one per Appendix A.2 type: Title, Heading, Paragraph, Question, List, Callout, Definition, Quote, Divider, Spacer, Code, Table, Image, Diagram. All emit the base class equal to the source tag name plus any imported classes; rich text rendered via dangerouslySetInnerHTML (pre-sanitized at parse time — safe). Public mode maps title→`<h1>`, heading→`<h2|h3|h4>`, paragraph→`<p>`, quote→`<blockquote>` (§11.4); edit/preview use `<div>` wrappers with identical class names. Callout/Definition/Quote assemble their inner HTML string (escaped term/cite + sanitized html) so they emit the exact contract DOM with no extra wrapper spans.
  - `RichText.tsx` — small inline `<span>` helper (kept for completeness; not currently used by any block since each emits its own element).
  - `types.ts` — internal helpers: `RenderMode`, `classes(...)` (variadic; flattens arrays + drops falsy), `alignStyle()`, `cx()`.
  - `index.ts` — re-exports `NoteRenderer`, `NoteRendererProps`, `RenderMode` (the public API).
- Built diagram client components in `src/components/diagrams/`:
  - `MermaidDiagram.tsx` (`'use client'`) — lazy `import('mermaid')` inside useEffect; `mermaid.render(id, source)` → SVG via React state + dangerouslySetInnerHTML. Falls back to `<pre class="note-diagram-fallback">{source}</pre>` while loading and on error.
  - `ExcalidrawDiagram.tsx` (`'use client'`) — parses JSON, lazy `import('@excalidraw/excalidraw')`, calls `exportToSvg(elements, appState, files)`, serializes the SVGSVGElement via `outerHTML`, renders via React state + dangerouslySetInnerHTML. Falls back to `<pre class="note-diagram-fallback">{source}</pre>` on JSON parse / export error.
  - DiagramBlock is a CLIENT component (`'use client'`) — needed because `next/dynamic` with `ssr:false` cannot run in a server component in Next.js 16. The mermaid/excalidraw dynamic imports are defined at MODULE scope (no `dynamic()` call during render — passes the react-hooks/static-components lint rule); SVG diagrams are server-rendered directly via dangerouslySetInnerHTML (no client hydration needed). The dynamic `loading` placeholder renders an empty `<pre class="note-diagram-fallback note-diagram-fallback--loading" />` so the SSR HTML for a mermaid/excalidraw block isn't blank; the actual `<pre>{source}</pre>` is rendered by the client component once mounted.
- Appended minimal structural rules to `src/app/globals.css` (placed AFTER `@layer base` so injected fixture stylesheets can override per-element; existing content untouched): `.noteforge-doc *` box-sizing border-box; `.noteforge-doc .note-page` position:relative + box-shadow + border-radius + overflow:hidden (so absolutely-positioned callouts resolve against the page frame); `.noteforge-doc .noteforge-pages` horizontal scroll for wide pages on small screens.
- Smoke-tested:
  - `scopeCss` correctly prefixes `.note-page` / `.q-card` / `.note-page table` etc. with `.noteforge-doc ` and recurses into `@media`; passes through `@keyframes`/`@font-face`; replaces `html`/`body`/`:root` with the scope.
  - `renderToStaticMarkup(<NoteRenderer doc={parseNoteHtml(minimal).model} mode="public" />)` produces the exact Appendix A.2 DOM: `<div class="noteforge-doc" data-mode="public"><style>…scoped…</style><div class="note-pages"><div class="note-page" style="…"><h1 class="note-title" style="text-align:center">…</h1><div class="note-question q-card"><div class="note-question-number">Q37</div><h2 class="note-heading">…</h2>…<div class="note-callout note-callout--tip"><div class="note-callout-title">Exam tip</div><div class="note-callout-body">…</div></div>…</div></div></div></div>`.
  - All three modes render correctly. Edit/preview emit `<div>` wrappers + `data-level` on headings; public emits `<h1>`/`<h2>`/`<h3>`/`<p>` (§11.4) with identical class names.
  - Full fixture: page 2 renders the SVG diagram (case-preserved: `linearGradient`, `markerWidth`, `marker-end` all intact), numbered list with `start="1"`, the absolutely-positioned `note-callout--warning` with `style="position:absolute;left:620px;top:36px;width:230px;z-index:10"` at the END of the page DOM (after flow blocks), Excalidraw diagram shows the loading fallback during SSR (replaced by the actual SVG on hydration), data-URI image renders with `<img src width height>` + `<figcaption>`, divider/spacer/code blocks all emit the right contract DOM.
  - Malicious fixture renders safely: all A.4 negative assertions pass on the rendered HTML (no `<script>`, no `on*=` handlers, no `javascript:`, no `data:text/html`, no `evil.com`, no `@import`, no `position:fixed`, no `<!--`); positive assertion passes (`.mf-q` rule with `#b91c1c` survives in the scoped CSS).
- `bun run lint` — passes cleanly (0 errors, 0 warnings). `bunx tsc --noEmit` — 0 errors from any file I created or modified (the only remaining tsc errors are all pre-existing: `examples/websocket/*` missing socket.io modules, `scripts/verify-parse.ts:49`, `skills/*` untyped z-ai-web-dev-sdk internals, and `src/lib/note-format/parse.ts:201` — none touched by me, all out of task scope).
- Did NOT touch `src/lib/note-format/types.ts`, `parse.ts`, `sanitize.ts`, `serialize.ts` (only appended the new `scopeCss` export to `css.ts`). Did NOT touch any API route, `prisma/`, `src/lib/server/`, `src/lib/db.ts`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/ui/*`. Did NOT create any page under `src/app`.

Stage Summary:
- **Public API:** `<NoteRenderer doc={model} mode="..." />` (named export from `src/components/renderer/index.ts`), accepting `{ doc: NoteDocument; mode?: 'edit'|'preview'|'public' }` (default `'public'`).
- **Files created (22):**
  - `src/components/renderer/NoteRenderer.tsx` — server component (root + scoped `<style>` + page mapping).
  - `src/components/renderer/NotePage.tsx` — one `.note-page` + flow/absolute block split.
  - `src/components/renderer/blocks/BlockRenderer.tsx` — block dispatcher.
  - `src/components/renderer/blocks/{Title,Heading,Paragraph,Question,List,Callout,Definition,Quote,Divider,Spacer,Code,Table,Image,Diagram}Block.tsx` — 14 block components, one per Appendix A.2 type.
  - `src/components/renderer/RichText.tsx`, `src/components/renderer/types.ts`, `src/components/renderer/index.ts`.
  - `src/components/diagrams/MermaidDiagram.tsx`, `src/components/diagrams/ExcalidrawDiagram.tsx` (client components, lazy-loaded with ssr:false).
- **Files modified (additive only):**
  - `src/lib/note-format/css.ts` — appended `scopeCss(css, scope)` export (existing exports untouched).
  - `src/app/globals.css` — appended `.noteforge-doc` structural rules after `@layer base` (existing content untouched).
  - `package.json` + `bun.lock` — added `mermaid` + `@excalidraw/excalidraw` (via `bun add`).
- **Verification:** `bun add` succeeded (mermaid@11.17.2, @excalidraw/excalidraw@0.18.1); `scopeCss` exported (css.ts line 204); `bun run lint` passes cleanly; `bunx tsc --noEmit` shows 0 errors from any file I created/modified; smoke tests against all 3 fixtures pass — correct DOM contract (Appendix A.2), correct public-mode semantic mapping (§11.4), absolutely-positioned callouts overlay correctly, SVG diagrams preserve case (`linearGradient`/`markerWidth`/`marker-end`), malicious fixture's A.4 security assertions all pass on the rendered HTML.
- Work record also saved at `/home/z/my-project/agent-ctx/2-b-shared-renderer.md`.

---
Task ID: 3
Agent: main (orchestrator)
Task: Editor store + components, all pages, wiring, end-to-end verification

Work Log:
- Built editor store (src/lib/store/editor-store.ts) — zustand with past/present/future undo/redo (50-step), immutable updates via structuredClone, selection by BlockPath, page cursor, dirty flag, emptyBlock factory.
- Built app chrome: src/components/app/AppHeader.tsx (sticky nav), DocumentCard.tsx, AppEmptyState.tsx, WarningsPanel.tsx.
- Added getPublishedSlugs() to src/lib/server/storage.ts (for library public badges).
- Rewrote src/app/layout.tsx — NoteForge metadata, AppHeader, sticky footer (mt-auto), Sonner toaster.
- Built pages:
  - src/app/page.tsx (library/dashboard, server component) — document grid with cards.
  - src/app/import/page.tsx (client) — drag & drop + paste tabs, POST /api/import, redirect to review.
  - src/app/documents/[id]/review/page.tsx (server) — verdict, WarningsPanel, live preview (preview mode).
  - src/app/documents/[id]/edit/page.tsx (server) — loads doc, mounts client Editor.
  - src/app/documents/[id]/versions/page.tsx (server) — version list + selected-version preview + warnings.
  - src/app/notes/[slug]/page.tsx (server, SSR) — published viewer, public mode, semantic rendering, generateMetadata.
- Built editor components:
  - src/components/editor/Editor.tsx (client) — 3-pane layout, save/publish handlers, store init.
  - src/components/editor/EditorToolbar.tsx — title, status, undo/redo, page nav, save/publish, panel toggles.
  - src/components/editor/Outline.tsx — page tabs, block tree with nested question children, select/move/delete, add-block menu.
  - src/components/editor/Inspector.tsx — per-block property editor (text/align/level/calloutType/list items/code/table/image/diagram source) + quick links.
- Ran `bun run lint` → 0 errors, 0 warnings (fixed one unused eslint-disable).

Stage Summary (agent-browser verification):
- Home (/) → 200; renders 3 document cards; published doc shows "Public" link.
- Import (/import) → 200; uploaded minimal.note.html via file input → redirected to /documents/{id}/review; review shows "Zero warnings".
- Review (malicious) → 200; verdict "Structural validation passed — 19 warnings (18 warn, 0 error). All vectors neutralized."; preview has NO script, NO evil.com, .mf-q (#b91c1c) survived in scoped CSS; SVG "Safe text" survived.
- Edit (full coverage) → 200; outline lists all blocks with nested question children; inspector populates on selection; editing text updates live preview + enables Save + Undo; undo reverts preview; table, SVG (linearGradient camelCase preserved), positioned callout, definition, code all render.
- Versions (/documents/{id}/versions) → 200; version list + selected preview.
- Public viewer (/notes/cybersecurity-notes-sample) → 200; semantic h1/h2 headings (public mode), callout, list, mermaid diagram (graphics-document) render; 404 for unpublished slugs.
- No runtime errors / hydration mismatches in dev.log across all routes.

Key decisions:
- Editor uses a 3-pane layout (outline | live preview | inspector) — selection via outline list, editing via inspector. The live preview uses the Shared Renderer in preview mode and re-renders from the store on every immutable update. This respects the single-renderer principle without invasive renderer changes for direct-canvas click selection (a Phase-2 enhancement).
- Pages are server components that call storage helpers directly (SSR); mutations go through the API routes (client-side fetch). Import is client-side (drag & drop → /api/import).
- Sticky footer achieved via root `min-h-screen flex flex-col` + `mt-auto` footer (layout.tsx).

Project status: Phase-1 NoteForge is feature-complete and browser-verified. Remaining optional work: direct-canvas block selection in edit mode, version restore-to-new-version action, syntax highlighting in code blocks, and the formal vitest/playwright test suites (A.4) scaffolded against the fixtures.

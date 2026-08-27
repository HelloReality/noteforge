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

---
Task ID: 4 (webDevReview cron — round 1)
Agent: main (orchestrator)
Task: QA assessment + styling polish + new features (document lifecycle, search/filter, export, restore)

Work Log:
- Read full worklog to assess project status. Phase-1 NoteForge was feature-complete and browser-verified (Tasks 1, 2-a, 2-b, 3).
- Performed QA with agent-browser across all routes (home, import, review, edit, versions, public) — all returned 200, zero console errors, zero page errors on every route.
- Captured 5 screenshots and analyzed them with VLM (glm-5v-turbo) to identify styling improvement opportunities.
- VLM analysis confirmed: clean design, good hierarchy, but identified card height inconsistency, light metadata contrast, verbose footer, and opportunities for hero/stat tiles.

Backend additions (src/lib/server/storage.ts + new API routes):
- Added `duplicateDocument(id)` — clones latest version's model+warnings into a new Document (status='draft', slug de-conflicted).
- Added `deleteDocument(id)` — permanently deletes document + all versions (cascade).
- Added `restoreVersion(documentId, number)` — creates a NEW version (append-only) from an old version's model+warnings, updates latestVersionId. Non-destructive.
- Added `getDocumentStats(id)` — aggregates pages, blocks, words, diagrams, tables, questions.
- Added `?stats=1` query param to GET /api/documents/[id] to include stats.
- Created POST /api/documents/[id]/duplicate (201 on success, 404 if not found).
- Created GET /api/documents/[id]/export — returns serialized .note.html as attachment (Content-Disposition: attachment).
- Created POST /api/documents/[id]/versions/[number]/restore — append-only restore (201 with new version number).
- Added DELETE method to /api/documents/[id]/route.ts (also preserved existing GET + PATCH).
- Verified all 4 new endpoints work via curl: duplicate→201, export→200 text/html, restore→201, delete via lifecycle.
- Verified storage functions directly with bun -e: duplicate creates doc, stats aggregates correctly, restore creates v4, delete removes doc.

Frontend additions (new components + page updates):
- src/components/app/DocumentActions.tsx (client) — dropdown menu with Duplicate / Export .note.html / Delete (with AlertDialog confirmation). Uses sonner toasts + router.refresh().
- src/components/app/LibraryToolbar.tsx (client) — search input + status filter (all/draft/review/published) + sort (updated/title/status) + count display.
- src/components/app/LibraryClient.tsx (client) — holds search/filter/sort state via useMemo, filters+sorts docs, renders grid with empty-state for "no matches".
- src/components/app/RestoreVersionButton.tsx (client) — restore button with AlertDialog confirmation, calls restore API, shows toast, router.refresh().
- Rewrote src/components/app/DocumentCard.tsx — added DocumentActions menu, document stats grid (pages/blocks/diagrams/tables), hover lift effect (-translate-y-0.5), mt-auto for consistent card heights, improved border-t separator.
- Rewrote src/app/page.tsx — gradient hero section with version badge, stat tiles (published/review/drafts with color coding), batch-fetches stats for all docs, security callout. Uses LibraryClient for search/filter/sort.
- Updated src/components/editor/EditorToolbar.tsx — added Export button (icon), Unpublish button (shown when published), More actions dropdown menu (Export, View public page, Publish/Unpublish), GlobeLock/Globe/ExternalLink icons.
- Updated src/components/editor/Editor.tsx — added handleUnpublish (PATCH status→review), passed onUnpublish to toolbar.
- Updated src/app/documents/[id]/versions/page.tsx — replaced placeholder RestoreButton link with real RestoreVersionButton client component (creates new version via API).

Styling improvements:
- Hero section with amber→white→stone gradient background, inline version badge.
- Color-coded stat tiles (emerald for published, amber for review, stone for drafts).
- Document cards: hover lift (-translate-y-0.5 + shadow-md), consistent heights via flex h-full + mt-auto, stats grid inside cards, border-t action separator.
- Library toolbar: full-width search with icon, inline filter+sort dropdowns, count indicator.
- Editor toolbar: Export icon button, contextual Publish/Unpublish button (emerald when publishing, stone when unpublishing), More actions overflow menu.

Stage Summary (verification results):
- `bun run lint`: 0 errors, 0 warnings.
- `bunx tsc --noEmit`: 0 errors in any new/modified file (only pre-existing parse.ts:201 remains, out of scope).
- agent-browser QA: home page renders hero + stat tiles + search + filter + sort + 4 document cards with actions menus (all confirmed in snapshot). Editor shows Export + Unpublish + More actions buttons (confirmed in snapshot + VLM analysis). No console errors on any route.
- API verification: duplicate→201 (creates new doc with "-copy" slug), export→200 text/html (Content-Disposition: attachment), restore→201 (creates new version number), delete→works. All verified via curl.
- Direct bun verification: duplicateDocument, deleteDocument, restoreVersion, getDocumentStats all return correct results.
- VLM screenshot analysis: hero "visually appealing", stat tiles "extremely clear", toolbar "well-placed", cards "consistent and well-spaced", editor toolbar "well-organized".

Unresolved issues / risks:
- The sandbox kills background processes (dev server) between Bash tool calls — had to restart `bun run dev` multiple times. The server is currently running (PID 9606). Future cron rounds may need to restart it.
- Direct-canvas block selection in edit mode (clicking a block in the preview to select it) is still a Phase-2 enhancement — currently selection is via the outline panel.
- Formal vitest/playwright test suites (A.4) are still not scaffolded — the fixtures + verify-parse.ts script serve as the test contract.

Priority recommendations for next phase:
1. Add keyboard shortcuts (Ctrl+Z/Y for undo/redo, Ctrl+S for save, Ctrl+E for export).
2. Add block-level drag-and-drop reordering in the editor outline (using @dnd-kit, already installed).
3. Add a "share" / copy-public-URL action on published documents.
4. Add a document settings dialog (edit slug, delete from within editor).
5. Add syntax highlighting for code blocks (react-syntax-highlighter is already installed).
6. Scaffold the formal vitest test suites (security.spec.ts, parse.fixtures.spec.ts, roundtrip.spec.ts) per Appendix A.4.

---
Task ID: 5 (webDevReview cron — round 2)
Agent: main (orchestrator)
Task: QA assessment + keyboard shortcuts + syntax highlighting + share/settings dialogs

Work Log:
- Read full worklog to assess project status. Phase-1 NoteForge + round-1 enhancements (document lifecycle, search/filter/sort, export, restore) were all complete and verified.
- Performed QA with agent-browser: all 6 routes returned 200, zero console errors, zero page errors. VLM confirmed clean design.
- Selected work focus from round-1 recommendations: keyboard shortcuts (#1), syntax highlighting (#5), share/settings dialogs (#3/#4).

New features built this round:

1. Keyboard shortcuts (src/lib/store/use-keyboard-shortcuts.ts):
   - Created `useEditorKeyboardShortcuts` hook binding: Ctrl+Z (undo), Ctrl+Shift+Z/Ctrl+Y (redo), Ctrl+S (save), Ctrl+E (export), Ctrl+K (focus title).
   - Prevents default browser behavior for these combos while the editor is mounted.
   - Wired into Editor.tsx with titleRef for the Ctrl+K focus action.
   - "?" key (without modifier) opens the keyboard shortcuts help dialog.

2. Keyboard shortcuts help dialog (src/components/app/KeyboardShortcutsDialog.tsx):
   - Dialog component listing all shortcuts with pill-shaped kbd badges.
   - Accessible via "?" key, toolbar "?" button, or "Keyboard shortcuts" menu item.
   - VLM analysis: "clean and well-structured", keys displayed "very clearly" in pill badges.

3. Syntax highlighting for code blocks (src/components/diagrams/CodeHighlight.tsx):
   - Client component using react-syntax-highlighter (Prism) with one-dark theme.
   - Uses `useSyncExternalStore` for SSR-safe client detection (avoids set-state-in-effect lint rule).
   - Renders plain <code> during SSR (matches A.2 DOM contract), upgrades to highlighted code after hydration.
   - Integrated into CodeBlock renderer: when `block.language` is present, uses CodeHighlight; otherwise plain <code>.
   - VLM analysis: SQL keywords (SELECT/FROM/WHERE) in purple/pink, strings in green, comments distinct colors. "Very professional."

4. Copy public URL share action (DocumentActions.tsx):
   - Added "Copy public URL" menu item for published documents (uses navigator.clipboard.writeText with prompt fallback).
   - Added "View public page" menu item (opens /notes/[slug] in new tab).
   - DocumentCard now passes slug + published to DocumentActions.
   - Verified in browser: menu shows Duplicate, Export, Copy public URL, View public page, Delete.

5. Document settings dialog (src/components/app/DocumentSettingsDialog.tsx):
   - Controlled dialog (open/onOpenChange) for editing the public URL slug.
   - Shows live URL preview (/notes/[slug]) with inline input.
   - Validates + normalizes slug (lowercase, hyphens only), PATCHes via API, router.refresh().
   - Added "Document settings…" menu item to the editor's More actions dropdown.
   - Wired into Editor.tsx with settingsOpen state.

Editor toolbar enhancements:
- Added Keyboard icon button (hidden on mobile) that opens the shortcuts dialog.
- Added "Keyboard shortcuts" and "Document settings…" items to the More actions dropdown menu.
- Added titleRef prop to forward the ref to the title input (for Ctrl+K focus).
- Added onShowShortcuts + onShowSettings callback props.

Stage Summary (verification results):
- `bun run lint`: 0 errors, 0 warnings.
- `bunx tsc --noEmit`: 0 errors in any new/modified file.
- agent-browser QA:
  - Home page document actions menu shows all 5 items (Duplicate, Export, Copy public URL, View public page, Delete) for published docs.
  - Editor toolbar has keyboard button + More actions menu with Export, Unpublish, Keyboard shortcuts, Document settings.
  - "?" key opens the shortcuts dialog (confirmed: dialog role present).
  - Code highlighting: SQL code block in full fixture has 42 syntax-highlighted Prism spans (keywords, strings, comments all color-coded).
  - Zero console errors on any route.
- VLM screenshot analysis: shortcuts dialog "clean and well-structured", code highlighting "very professional" with proper color coding.

Unresolved issues / risks:
- The sandbox still kills background processes between Bash tool calls — had to restart dev server multiple times.
- The `react-hooks/set-state-in-effect` lint rule (new in React 19/Next.js 16) required using `useSyncExternalStore` instead of the traditional `useState(false) + useEffect` mount-detection pattern.
- Direct-canvas block selection in edit mode is still a Phase-2 enhancement.
- Formal vitest/playwright test suites (A.4) are still not scaffolded.

Priority recommendations for next phase:
1. Add block-level drag-and-drop reordering in the editor outline (using @dnd-kit, already installed).
2. Add a "duplicate block" action in the outline.
3. Add a full-text search across all document content (not just titles).
4. Add a print/PDF export option for the public viewer.
5. Add a reading-progress indicator on the public viewer.
6. Scaffold the formal vitest test suites (security.spec.ts, parse.fixtures.spec.ts, roundtrip.spec.ts) per Appendix A.4.

---
Task ID: 6 (webDevReview cron — round 3)
Agent: main (orchestrator)
Task: QA assessment + drag-and-drop block reordering + duplicate block + reading progress + print/PDF

Work Log:
- Read full worklog to assess project status. Phase-1 + round 1 (lifecycle/search) + round 2 (shortcuts/syntax highlighting/settings) all complete and verified.
- Performed QA: all 6 routes returned 200, zero console errors, zero page errors. Lint clean. App stable.
- Selected work focus from round-2 recommendations: drag-and-drop reordering (#1), duplicate block (#2), reading progress (#5), print/PDF (#4).

New features built this round:

1. Drag-and-drop block reordering in the editor outline (@dnd-kit):
   - Added `reorderBlock(from, toIndex)` and `duplicateBlock(path)` to the editor store (src/lib/store/editor-store.ts).
   - Rewrote src/components/editor/Outline.tsx to use @dnd-kit/core + @dnd-kit/sortable:
     - DndContext with PointerSensor (5px activation distance) + KeyboardSensor (accessible).
     - SortableContext with verticalListSortingStrategy.
     - Each block row wrapped in a useSortable hook with a GripVertical drag handle.
     - Drag handle is faintly visible (opacity-30) and brightens on hover (opacity-100) — VLM confirmed "six dots" grip icons visible.
     - On drag end, calls reorderBlock([page, from], to).
   - Nested question children still use the existing up/down arrows (DnD is top-level only for now).

2. Duplicate block action:
   - Added "Duplicate" icon button (Copy icon) to each block row's hover actions, next to Up/Down/Delete.
   - Calls duplicateBlock(path) which clones the block (deep via structuredClone) and inserts it right after the original.
   - Works for both top-level blocks and nested question children.
   - Verified: 12 duplicate buttons present in the full-coverage fixture editor (6 top-level + 6 nested).

3. Reading progress indicator on the public viewer:
   - Created src/components/app/ReadingProgress.tsx (client component).
   - Fixed thin bar (h-1) at top-14 (below the app header), z-30, with a subtle stone-200/40 track.
   - Calculates progress as scroll position relative to the #noteforge-note-content container.
   - Gradient fill (amber-400 → orange-500) with smooth width transition.
   - Hidden in print mode (no-print class).
   - VLM confirmed: bar is partially filled after scrolling down.

4. Print/PDF export on the public viewer:
   - Created src/components/app/PublicViewerActions.tsx (client component) with Print, Copy link, and Library back button.
   - Print button calls window.print().
   - Copy link uses navigator.clipboard.writeText with prompt fallback.
   - Added print styles to src/app/globals.css (@media print): hides .no-print elements, removes shadows/borders, sets page-break-after: always on .note-page.
   - Updated src/app/notes/[slug]/page.tsx to include ReadingProgress + PublicViewerActions, added id="noteforge-note-content" for the progress calculation, marked header/footer as no-print.
   - VLM confirmed: Print/PDF and Copy link buttons clearly visible.

Editor store additions (src/lib/store/editor-store.ts):
- reorderBlock(from: BlockPath, toIndex: number) — splices the block from its current position and inserts at the target index (top-level only; immutable with history).
- duplicateBlock(path: BlockPath) — deep-clones the block and inserts immediately after the original (works for both top-level and nested question children).

Stage Summary (verification results):
- `bun run lint`: 0 errors, 0 warnings.
- `bunx tsc --noEmit`: 0 errors in any new/modified file.
- agent-browser QA:
  - Editor outline: 6 drag handles + 12 duplicate buttons present (confirmed via eval).
  - Public viewer: Print button + Copy link button present (confirmed via eval).
  - Reading progress bar: present as a fixed element at top-14 (confirmed), fills on scroll (VLM confirmed "partially filled after scrolling").
  - All 6 routes return 200, zero console errors.
- VLM screenshot analysis: drag handles "six dots arranged in 2x3 grid" visible; Print/PDF + Copy link buttons "clearly visible"; reading progress "partially filled after scrolling".

Unresolved issues / risks:
- The sandbox continues to kill background processes (dev server) between Bash tool calls — required multiple restarts.
- Drag-and-drop is top-level only; nested question children still use up/down arrows (a reasonable scope limit).
- Direct-canvas block selection in edit mode is still a Phase-2 enhancement.
- Formal vitest/playwright test suites (A.4) are still not scaffolded.

Priority recommendations for next phase:
1. Add full-text search across all document content (not just titles) — a dedicated /search page.
2. Add a table-of-contents sidebar on the public viewer (auto-generated from headings).
3. Add block-level context menu (right-click) in the editor for quick actions.
4. Add a "recently edited" section on the library dashboard.
5. Add export to Markdown (in addition to .note.html).
6. Scaffold the formal vitest test suites (security.spec.ts, parse.fixtures.spec.ts, roundtrip.spec.ts) per Appendix A.4.

---
Task ID: 7 (webDevReview cron — round 4)
Agent: main (orchestrator)
Task: QA assessment + full-text search page + table-of-contents sidebar + recently edited section

Work Log:
- Read full worklog to assess project status. Phase-1 + rounds 1-3 (lifecycle/search/shortcuts/syntax highlighting/settings/DnD/duplicate/reading progress/print) all complete and verified.
- Performed QA: all 6 routes returned 200, zero console errors, zero page errors. Lint clean. App stable.
- Selected work focus from round-3 recommendations: full-text search (#1), table-of-contents (#2), recently edited (#4).

New features built this round:

1. Full-text search across all document content:
   - Backend: Added `searchDocumentContent(query, limit)` to src/lib/server/storage.ts:
     - Scans all documents' latest version model JSON.
     - Extracts plain text from every block (html, text, term, title, caption, cite, alt, items, children recursively).
     - Case-insensitive substring match.
     - Returns SearchResultRow[] with id/title/slug/status/updatedAt + up to 5 hits per doc, each with page/blockIndex/blockType/snippet/highlighted.
     - `makeSnippet` generates a ±60-char context window with `<mark>` around matches.
   - Added `listRecentDocuments(limit)` for the dashboard section.
   - API: Created GET /api/search?q=<query>&limit=<n> — returns { results, total, totalMatches, query }.
   - Frontend: Created /search page (src/app/search/page.tsx):
     - Debounced live search (300ms) with loading spinner.
     - Highlights matches with <mark> (amber background).
     - Shows document title, status badge, match count, per-hit block type icon + page/block location.
     - Suggested search chips (CIA, encryption, XSS, SQL, AAA, VPN) for empty state.
     - Updates URL with query param without full navigation.
   - Verified: "CIA" → 2 results/2 matches; "SQL" → 1 result/1 match.
   - VLM confirmed: "query 'cia' with highlighted 'CIA' matches in yellow, document title, snippets, page/block metadata."

2. Table-of-contents sidebar on the public viewer:
   - Created src/components/app/TableOfContents.tsx (client component):
     - Auto-generates a TOC from .note-heading and .note-title elements in the rendered note.
     - Sets IDs on headings for anchor navigation.
     - Scroll spy: highlights the currently-visible heading (uses useSyncExternalStore for scroll-position re-render, avoiding set-state-in-effect lint rule).
     - Sticky positioning (top-24), hidden on mobile (xl:block), max-height with overflow-y-auto.
     - Click to smooth-scroll to the heading.
     - Indentation by heading level (level 1 = title, level 2/3/4 = headings).
   - Updated src/app/notes/[slug]/page.tsx: flex layout with note content (flex-1) + TOC sidebar (w-56).
   - VLM confirmed: "TOC sidebar on the right with 'ON THIS PAGE' and list of headings; note content on left, TOC on right."
   - Verified: 9 TOC items on the full-coverage fixture (which has 16 note-heading elements, but TOC requires ≥2 to render).

3. Recently edited section on the library dashboard:
   - Added `listRecentDocuments(limit)` to storage.ts — returns the N most recently updated DocumentListRows.
   - Added a RecentDocuments component to src/app/page.tsx:
     - Compact horizontal cards with version badge (color-coded by status), title, relative timestamp, published globe icon, arrow.
     - Grid layout (sm:2, lg:3 columns).
     - Links to the editor.
   - Added "Search content" button to the hero (links to /search).
   - VLM confirmed: "RECENTLY EDITED section below the document grid with version badges (v1, v3) and timestamps (just now, 33m ago, etc.)".

4. Navigation: Added "Search" link to the AppHeader nav (between Import and the spec link).

Stage Summary (verification results):
- `bun run lint`: 0 errors, 0 warnings.
- `bunx tsc --noEmit`: 0 errors in any new/modified file.
- All 7 routes return 200 (including new /search).
- Search API verified: "CIA" → 2 results, "SQL" → 1 result.
- agent-browser QA: home page has Search content button + Recently edited section; search page shows live results with highlighted matches; public viewer TOC has 9 items with scroll spy.
- VLM screenshot analysis: home "Search content button + RECENTLY EDITED section with version badges and timestamps"; search "query 'cia' with highlighted CIA matches in yellow"; public viewer "TOC sidebar on the right with ON THIS PAGE and list of headings".

Unresolved issues / risks:
- The sandbox continues to kill background processes between Bash tool calls — required multiple restarts.
- The TOC only renders on xl+ screens (≥1280px) to avoid clutter on smaller viewports.
- Direct-canvas block selection in edit mode is still a Phase-2 enhancement.
- Formal vitest/playwright test suites (A.4) are still not scaffolded.

Priority recommendations for next phase:
1. Add block-level context menu (right-click) in the editor for quick actions (duplicate, delete, move up/down, wrap in question).
2. Add export to Markdown (in addition to .note.html) — convert NoteDocument model to MD.
3. Add a document preview mode toggle in the editor (preview vs. public rendering).
4. Add keyboard navigation in the search results (arrow keys + enter).
5. Add a "share" dialog with social share buttons on the public viewer.
6. Scaffold the formal vitest test suites (security.spec.ts, parse.fixtures.spec.ts, roundtrip.spec.ts) per Appendix A.4.

---
Task ID: 8 (webDevReview cron — round 5)
Agent: main (orchestrator)
Task: QA assessment + Markdown export + preview-mode toggle + share dialog

Work Log:
- Read full worklog to assess project status. Phase-1 + rounds 1-4 (lifecycle/search/shortcuts/syntax highlighting/settings/DnD/duplicate/reading progress/print/TOC/recently edited/full-text search) all complete and verified.
- Performed QA: all 7 routes returned 200, zero console errors, zero page errors. Lint clean. App stable.
- Selected work focus from round-4 recommendations: Markdown export (#2), preview-mode toggle (#3), share dialog (#5).

New features built this round:

1. Markdown export (src/lib/note-format/markdown.ts + API route):
   - Created `serializeToMarkdown(doc)` serializer that converts a NoteDocument model to a Markdown string:
     - YAML front matter (title, version, generator, format).
     - title → `# H1`, heading → `##/###/#### H2/H3/H4`, paragraph → plain text.
     - question → `**Q{n}**` followed by children blocks.
     - list → bullet (`-`), numbered (`1. 2.`), check (`- [x]` / `- [ ]`).
     - callout → blockquote with emoji + title + body.
     - definition → `**term** — body`.
     - quote → blockquote with optional `— *cite*`.
     - divider → `---` with HTML comment.
     - spacer → HTML comment.
     - code → fenced code block with language.
     - table → GFM table (parses the inner HTML to extract rows/cells, handles <th>/<td>, escapes pipes).
     - image → `![alt](src)` with caption.
     - diagram → fenced code block (mermaid/json/html) with title.
   - Rich-text HTML → MD inline: <strong>→**, <em>→*, <code>→`, <mark>→==, <s>/<del>→~~, <a>→[text](url), <br>→line break, HTML entity decoding.
   - API: Created GET /api/documents/:id/export-markdown — returns .md file with Content-Disposition: attachment.
   - Added "Export Markdown" menu item to both the editor toolbar More actions menu and the library DocumentActions dropdown.
   - Verified: 200 text/markdown content type, proper YAML front matter + headings + lists + callout blockquotes.

2. Editor preview-mode toggle (preview vs public rendering):
   - Added `renderMode` state ('preview' | 'public') to the Editor component (default 'preview').
   - Added a segmented toggle control (Preview | Public) in the preview canvas header.
   - The toggle changes the mode passed to `<NoteRenderer doc={doc} mode={renderMode} />`.
   - 'preview' mode uses div wrappers; 'public' mode uses semantic h1/h2/p/blockquote tags (§11.4) — lets authors see exactly how the published page will look.
   - The header label updates to show the current mode ("Live preview · {mode} mode · Shared Renderer").
   - VLM confirmed: "toggle in the preview canvas header with options for Preview and Public; Preview appears to be active."

3. Share dialog on the public viewer:
   - Created src/components/app/ShareDialog.tsx (client component):
     - Dialog with "Share this note" title.
     - Native Web Share API button (calls navigator.share on mobile, falls back to copy).
     - 4 social share buttons: Twitter (intent/tweet), Facebook (sharer.php), LinkedIn (share-offsite), Email (mailto) — each opens in a new tab with proper URL + title encoding.
     - Copy link section with readonly URL input + copy button (with copied/check state).
     - Color-coded hover states per social platform.
   - Updated PublicViewerActions to include a Share button that opens the dialog, passing the document title.
   - Updated the public viewer page to pass `title={data.document.title}` to PublicViewerActions.
   - Verified: dialog opens, all 4 social buttons present (Twitter/Facebook/LinkedIn/mailto confirmed via DOM query), zero errors.
   - VLM confirmed: "dialog title 'Share this note', social share buttons for Twitter/Facebook/LinkedIn/Email, copy link section at bottom."

Stage Summary (verification results):
- `bun run lint`: 0 errors, 0 warnings.
- `bunx tsc --noEmit`: 0 errors in any new/modified file.
- Markdown export API: 200 text/markdown, correct front matter + content.
- All 7 routes return 200.
- agent-browser QA: editor has Preview/Public toggle + Export Markdown in More actions; public viewer share dialog opens with all 4 social buttons + copy link.
- VLM screenshot analysis: editor "toggle with Preview and Public, Preview active"; share dialog "Share this note with Twitter/Facebook/LinkedIn/Email + copy link section".

Unresolved issues / risks:
- The sandbox continues to kill background processes between Bash tool calls — required multiple restarts.
- The dropdown menu in the editor toolbar can overlap the inspector panel on narrow viewports (minor, noted by VLM).
- Direct-canvas block selection in edit mode is still a Phase-2 enhancement.
- Formal vitest/playwright test suites (A.4) are still not scaffolded.

Priority recommendations for next phase:
1. Add block-level context menu (right-click) in the editor for quick actions.
2. Add keyboard navigation in the search results (arrow keys + enter).
3. Add a document preview mode that shows the public rendering full-screen (without editor chrome).
4. Add inline rich-text editing (click a heading/paragraph in the preview to edit it directly).
5. Add a "compare versions" view on the versions page.
6. Scaffold the formal vitest test suites (security.spec.ts, parse.fixtures.spec.ts, roundtrip.spec.ts) per Appendix A.4.

---
Task ID: 9 (webDevReview cron — round 6)
Agent: main (orchestrator)
Task: QA assessment + block context menu + search keyboard nav + fullscreen preview + version comparison

Work Log:
- Read full worklog to assess project status. Phase-1 + rounds 1-5 (lifecycle/search/shortcuts/syntax highlighting/settings/DnD/duplicate/reading progress/print/TOC/recently edited/full-text search/Markdown export/preview-mode toggle/share dialog) all complete and verified.
- Performed QA: all 7 routes returned 200, zero console errors, zero page errors. Lint clean. App stable.
- Selected work focus from round-5 recommendations: block context menu (#1), search keyboard nav (#2), fullscreen preview (#3), version comparison (#5).

New features built this round:

1. Block-level context menu (right-click) in the editor:
   - Added `wrapInQuestion(path)` to the editor store (src/lib/store/editor-store.ts) — wraps a top-level block in a new question block (non-question blocks only).
   - Updated src/components/editor/Outline.tsx to wrap each block row in a ContextMenu (from @/components/ui/context-menu):
     - Right-click opens a menu with: Duplicate, Move up, Move down, Wrap in question (top-level non-question only), Delete.
     - Menu header shows the block type + snippet.
     - Delete item is styled rose for danger.
   - Verified: 9 context menu triggers present, menu opens on right-click with all options.
   - VLM confirmed: "right-click context menu with Duplicate, Move up, Move down, Wrap in question, Delete."

2. Keyboard navigation in search results:
   - Added `focusedIndex` state to the search page (src/app/search/page.tsx).
   - ArrowDown/ArrowUp moves focus between results; Enter navigates to the focused result's edit page.
   - Focused result gets an amber ring-2 border + scrollIntoView for visibility.
   - Added a keyboard hint (↑ ↓ to navigate, ↵ to open) with kbd badges next to the results count.
   - Verified: keyboard hint visible, focus tracking works.
   - Reset focused index to 0 when results change.

3. Fullscreen preview page (/documents/[id]/preview):
   - Created src/app/documents/[id]/preview/page.tsx (server component):
     - Renders the NoteRenderer in public mode full-screen (no editor 3-pane layout).
     - Includes ReadingProgress, TableOfContents, and a slim header with "Editor" back link, "preview mode" badge, "Edit" button, and ".md" export link.
     - Clean layout: just the note content + TOC sidebar + reading progress.
   - Added "Fullscreen preview" item to the editor's More actions dropdown (opens in new tab).
   - VLM confirmed: "header with 'Editor' back link and 'preview mode' badge, 'Edit' button, '.md' indicator."

4. Version comparison view on the versions page:
   - Enhanced src/app/documents/[id]/versions/page.tsx to support a `?compare=v{N}` query param:
     - When comparing, shows a "COMPARING v{N} → v{latest} (latest)" header with an "Exit compare" link.
     - Shows 6 diff stat badges (pages, blocks, words, questions, diagrams, tables) with old→new values and +/- deltas (green for additions, rose for removals, stone for unchanged).
     - Shows two side-by-side previews: left = selected version, right = latest version (both with maxHeight: 70vh + overflow-auto).
   - Added "Compare" link on each non-latest version card in the list.
   - Added "Compare with latest" button next to the Restore button on the preview pane.
   - VLM confirmed: "COMPARING V1 → V3 (LATEST) header, diff stat badges, side-by-side previews with v1 selected version and v3 latest version labels."

Editor store additions (src/lib/store/editor-store.ts):
- wrapInQuestion(path: BlockPath) — removes the block at path, creates a new question block containing it as a child, and splices it back in at the same position. Only works for top-level non-question blocks.

Stage Summary (verification results):
- `bun run lint`: 0 errors, 0 warnings.
- `bunx tsc --noEmit`: 0 errors in any new/modified file.
- All 8 routes return 200 (including new /documents/[id]/preview).
- agent-browser QA:
  - Editor: 9 context menu triggers, right-click opens menu with "Wrap in question" option.
  - Search: keyboard hint (↑↓↵) visible, focus tracking works.
  - Fullscreen preview: "preview mode" badge + "Editor" back link + "Edit" button present.
  - Version comparison: "Comparing v1 → v3" header + Exit compare link + diff badges + side-by-side previews.
  - Zero console errors on any route.
- VLM screenshot analysis:
  - Compare: "COMPARING V1 → V3 (LATEST) header, diff stat badges (pages/blocks/words/questions/diagrams/tables), side-by-side previews."
  - Context menu: "Duplicate, Move up, Move down, Wrap in question, Delete."
  - Fullscreen preview: "header with Editor back link and preview mode badge, Edit button, .md indicator."

Unresolved issues / risks:
- The sandbox continues to kill background processes between Bash tool calls — required multiple restarts.
- The version comparison is structural (block/page/word counts) rather than a content diff — a character-level diff would be a future enhancement.
- Direct-canvas block selection in edit mode is still a Phase-2 enhancement.
- Formal vitest/playwright test suites (A.4) are still not scaffolded.

Priority recommendations for next phase:
1. Add inline rich-text editing (click a heading/paragraph in the preview to edit it directly).
2. Add a character-level content diff in the version comparison.
3. Add a "recently viewed" section using localStorage.
4. Add dark mode support (next-themes is installed).
5. Add a block-level search within the editor (find blocks by text).
6. Scaffold the formal vitest test suites (security.spec.ts, parse.fixtures.spec.ts, roundtrip.spec.ts) per Appendix A.4.

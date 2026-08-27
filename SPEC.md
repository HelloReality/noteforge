# NoteForge — Visual Notes Specification (SPEC.md)

> **Status:** Phase-1 binding specification. Fixtures in `fixtures/` are authoritative test artifacts — never modify them to make tests pass.

---

## 1. Purpose

NoteForge is a visual-notes authoring and publishing platform. Notes are authored in a custom, forgiving HTML subset called **Note Format** (`visual-notes/1`) that maps to a rich document model. The platform imports `.note.html` files, sanitizes them aggressively, stores a normalized model, and renders them identically in an editor, a preview, and a public viewer through one **Shared Renderer**.

## 2. Goals (Phase 1)

1. Import `.note.html` files via drag & drop, parse → sanitize → validate → persist.
2. Render documents identically across editor / preview / public viewer (Single Source of Truth renderer).
3. Provide an import-review page that surfaces every warning and the structural validation result.
4. Provide a basic block editor with undo/redo.
5. Provide a public SSR viewer with clean URLs (`/notes/[slug]`).
6. Maintain versions and allow re-publishing.

Non-goals (Phase 1): real-time multi-user collaboration, PDF export, full WYSIWYG diagram authoring inside the editor.

## 3. Project Setup

### 3.1 Environment

- Next.js 16 App Router, TypeScript 5, Tailwind 4, shadcn/ui (New York), Prisma + SQLite.
- `.env`:
  - `DATABASE_URL=file:/home/z/my-project/db/custom.db`
- Dev server on port 3000.

## 4. Document Model

A `NoteDocument` is:

```
NoteDocument {
  title: string
  version: string
  css: string            // sanitized stylesheet text
  pages: NotePage[]
}
NotePage {
  page: number
  width: number          // default 900
  height: number         // default 1270 (A4-ish)
  background: string     // default #ffffff
  blocks: Block[]
}
Block =
  | TitleBlock
  | HeadingBlock
  | ParagraphBlock
  | QuestionBlock
  | ListBlock
  | CalloutBlock
  | DefinitionBlock
  | QuoteBlock
  | DividerBlock
  | SpacerBlock
  | CodeBlock
  | TableBlock
  | ImageBlock
  | DiagramBlock
  | RawBlock   // absolutely-positioned free element carrying data-x/y/w/z + sanitized html
```

## 5. Note Format (visual-notes/1)

A `.note.html` file is a complete HTML document with:

- `<meta name="note-format" content="visual-notes/1">` (required for detection).
- A `<style>` in `<head>` carrying author CSS (sanitized on import).
- A single `<note-document data-title data-version>` containing one or more `<note-page>` elements.

### 5.1 Block-level elements

| Tag | Attributes | Model |
|---|---|---|
| `<note-title data-align>` | align: left|center|right | TitleBlock |
| `<note-heading level>` | level: 2|3|4 (default 2) | HeadingBlock |
| `<note-paragraph data-align>` | align | ParagraphBlock |
| `<note-question number class>` | number (int), class | QuestionBlock |
| `<note-list type start>` | type: bullet\|numbered\|check; start (int) | ListBlock |
| `<note-item data-checked>` | checked: bool | list item |
| `<note-callout type title data-x data-y data-w data-z>` | type: tip\|info\|warning\|danger\|note | CalloutBlock |
| `<note-definition term>` | term (string) | DefinitionBlock |
| `<note-quote data-cite>` | cite | QuoteBlock |
| `<note-divider style>` | style: solid\|dashed\|dotted | DividerBlock |
| `<note-spacer height>` | height (px int) | SpacerBlock |
| `<note-code language>` | language | CodeBlock |
| `<note-table data-caption>` | caption | TableBlock (wraps a real `<table>`) |
| `<note-image src alt width height data-caption>` | | ImageBlock |
| `<note-diagram type data-width data-height data-title>` | type: mermaid\|svg\|excalidraw | DiagramBlock |

### 5.2 Diagrams

- `type="mermaid"`: text child = Mermaid source.
- `type="svg"`: one `<svg>` child (sanitized).
- `type="excalidraw"`: text child = Excalidraw scene JSON.

### 5.3 Lists

- `type="bullet"` → `<ul>`.
- `type="numbered"` with `start` → `<ol start>`.
- `type="check"` → `<ul class="note-list--check">` with each item prefixed by `☑` / `☐` from `data-checked`.

### 5.4 Inline rich text (allowed inside paragraph/heading/item/callout/quote/definition)

`<span>` (classes preserved), `<strong>`, `<em>`, `<u>`, `<s>`, `<mark>`, `<code>`, `<sub>`, `<sup>`, `<a href>` (http/https only, target=_blank rel=noopener). Any other inline tag (e.g. `<img>`, `<iframe>`) is **stripped** (element removed; text content kept by default per A.3.6 unwrapping rule).

### 5.5 Page container

`<note-page data-page data-width data-height data-background>` becomes the visual page frame. Width/height/background are stored as integers / hex color. Unknown attributes are dropped.

### 5.6 Document metadata

`<note-document data-title data-version>`. `data-title` falls back to `<title>`.

### 5.7 Generator hint

`<meta name="note-generator">` is captured but not used for behavior.

### 5.8 Question card styling

Fixture A applies `class="q-card"` to its `<note-question>` elements (the author's stylesheet defines `.q-card` and questions carry that class). Importers preserve imported classes on `<note-question>`.

## 6. Identification & Warnings

Every parse returns `{ model, warnings }`. Each warning has:

```
{ code: string, level: 'info'|'warn'|'error', message: string, path: string }
```

`path` is a dotted location, e.g. `pages[0].blocks[3]` or `css`.

## 7. Persistence (Prisma)

```
model Document {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  status      String   @default("draft")     // draft | review | published
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  versions    Version[]
}

model Version {
  id          String   @id @default(cuid())
  documentId  String
  document    Document @relation(fields:[documentId], references:[id], onDelete: Cascade)
  number      Int
  modelJson   String   // serialized NoteDocument model
  warningsJson String  // warnings from import
  note        String?
  createdAt   DateTime @default(now())
}
```

A "current version" pointer is stored on Document via `latestVersionId` (nullable). The public viewer reads the latest **published** version.

## 8. API Routes

- `POST /api/import` — accept `.note.html` upload (FormData), run pipeline, return `{ documentId, versionId, warnings }`.
- `GET  /api/documents` — list documents (library).
- `GET  /api/documents/:id` — document + latest version model + warnings.
- `PATCH /api/documents/:id` — update title / status / slug.
- `POST /api/documents/:id/versions` — save a new version (editor commit).
- `GET  /api/documents/:id/versions` — list versions.
- `GET  /api/notes/:slug` — public published model (SSR data fetch).

## 9. Import Pipeline

### 9.1 Import Review

After upload, the user lands on `/documents/[id]/review` showing:

- Document title, detected format, generator.
- Structural validation result (valid / invalid).
- All warnings grouped by code with counts.
- A live preview using the Shared Renderer.
- "Approve & open editor" and "Discard" actions.

## 10. Sanitizer (Security)

The sanitizer is the security boundary. It runs on import and on every save.

### 10.1 Strip entirely

HTML comments. `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<template>` (entire subtree). `<style>` outside `<head>` (entire text dropped, warning `CSS_RULE_DROPPED`). `<base>`, `<link>`, `<meta http-equiv="refresh">` in `<head>`.

### 10.2 Attribute allowlist

- Global: `class`, `style` (sanitized), `data-*` (only known data attributes per element).
- Inline rich-text allows: `href` (http/https/mailto/tel only), `target` (forced `_blank`), `rel` (forced `noopener noreferrer`).
- SVG allows presentation + geometry attributes + `viewBox`; **not** `on*`, `xlink:href` with script scheme.

### 10.3 Scheme checks

`javascript:`, `data:text/html`, `vbscript:` — case-insensitive, whitespace-trimmed. Catches `jAvAsCrIpT:`, `"jav\tascript:"`.

### 10.4 External resources

`<img>` / `<note-image>` with external `src` → attribute removed + warning `EXTERNAL_RESOURCE_STRIPPED`; element kept (renderer shows broken-image placeholder). Never fetched.

### 10.5 CSS sanitizer

- Drops `@import` and remote `@font-face` src / remote `url(...)` in declarations.
- Drops `behavior` property.
- Rewrites `position: fixed` → `position: absolute` (warning `CSS_PROPERTY_REWRITTEN`); drops if it can't be safely rewritten.
- Drops rules/selectors containing dangerous constructs.
- When a `<style>` mixes legitimate and dangerous rules, only dangerous rules/declarations are dropped (per-rule/per-declaration warnings); the rest survives.

### 10.6 Vector coverage (binding)

The `fixtures/malicious.note.html` covers: meta refresh, base href, external link, `@import`, remote `@font-face`, remote `background-image`, IE `behavior`, external script, inline script, `<img onerror>`, `javascript:` href (incl. case variant), `data:text/html` link, `javascript:` inside inline `style`, `position:fixed` overlay, `<form>` exfil, `<iframe>`, external `<note-image>`, malicious SVG (`onload`, `<script>`, `xlink:href` wrapper), `<style>` in body, `<object>`, `<embed>`, trailing script. All must be neutralized while legitimate content survives.

### 10.7 Unwrapping vs dropping

- Disallowed inline wrappers (e.g. `<a xlink:href="javascript:…">text</a>`) → unwrap: wrapper removed, children kept.
- Dangerous container elements (form/iframe/object/embed/script/template) → dropped with entire subtree.

## 11. Shared Renderer

`src/components/renderer/NoteRenderer` is the **only** renderer. It takes a `NoteDocument` model and a `mode: 'edit' | 'preview' | 'public'` and renders identical structure. Differences between modes are limited to interactivity affordances (selection outlines, drag handles in edit) — not structure or class names.

### 11.1 Base class contract

Every element emits a **base class equal to the source tag name** plus any imported classes. This is what the fixture stylesheets target.

### 11.2 Element → DOM contract

- `<div class="note-page" style="width/height/background…">` page container.
- `<div class="note-title">…</div>`, `<div class="note-paragraph">…</div>`.
- `<div class="note-question">…</div>`.
- `<div class="note-heading" data-level="2">…</div>`.
- `<div class="note-definition"><span class="note-definition-term">{term}</span> {html}</div>`.
- `<div class="note-callout note-callout--{type}">` + optional `<div class="note-callout-title">{title}</div><div class="note-callout-body">{html/children}</div>`.
- `<ul class="note-list note-list--{type}">`; check items prefixed `<span class="note-check">☑|☐</span>`.
- `<hr class="note-divider">`.
- `<pre class="note-code"><code>…</code></pre>`.
- `<figure class="note-table">` wrapping a real `<table>` + optional `<figcaption>`.
- `<figure class="note-image">` with `<img>` + optional `<figcaption>`.
- `<div class="note-diagram note-diagram--{type}">` containing the rendered diagram (Mermaid SVG, raw sanitized SVG, or Excalidraw canvas).
- `<blockquote class="note-quote">` with optional `<cite>`.
- Absolutely-positioned elements: rendered inside `.note-page` with `position:absolute; left/top/width/z-index` from `data-x/y/w/z`.

### 11.3 Diagrams

- Mermaid: rendered via dynamically-imported `mermaid` client component (no SSR) — fallback to `<pre>` source on error.
- SVG: rendered via `dangerouslySetInnerHTML` with already-sanitized source.
- Excalidraw: rendered via dynamically-imported `@excalidraw/excalidraw` viewer.

### 11.4 Public mode semantic mapping

In **public** mode, the renderer additionally emits semantic tags for accessibility/SEO while keeping identical class names:

- heading → `<h2|h3|h4 class="note-heading">`
- paragraph → `<p class="note-paragraph">`
- quote → `<blockquote class="note-quote">`
- title → `<h1 class="note-title">`

Edit/preview modes use `<div>` wrappers for stable editing coordinates.

## 12. Editor

`/documents/[id]/edit` hosts a block-based editor:

- Left: outline / page list.
- Center: the Shared Renderer in `edit` mode (selection, drag handles, inline property panel).
- Right: inspector (per-block properties).
- Top bar: undo/redo, add block, page nav, "Save version", "Publish".
- Zustand store with past/present/future stacks for undo/redo.

## 13. Versions

`/documents/[id]/versions` lists every saved version with number, note, warning count, timestamp, and a "preview" action. Restoring a version creates a new version (append-only).

## 14. Publish

Publishing marks `status='published'` and creates/updates a `Slug` → latest published version mapping. Public viewer reads the latest published version.

## 15. Public Viewer

### 15.2 Public viewer (`/notes/[slug]`)

SSR route that fetches the published model and renders via the Shared Renderer in `public` mode. Includes document title in `<head>`, semantic tags per §11.4, and a footer with "Powered by NoteForge".

## 16. Testing (deferred structure)

- `tests/unit/security.spec.ts` — malicious fixture assertions (A.4).
- `tests/unit/parse.fixtures.spec.ts` — exact model assertions for A & B.
- `tests/unit/roundtrip.spec.ts` — `parse(serialize(parse(f)))` deep-equals `parse(f)` for A & B.
- Playwright visual tests: editor ≡ preview ≡ public for A & B.

> Phase-1 ships the application and fixtures; the test suites are scaffolded but the binding assertion files are the fixtures themselves.

---

## Appendix A — Fixture Files, Renderer DOM Contract & Spec Addenda

The three fixture files (`fixtures/minimal.note.html`, `fixtures/full.note.html`, `fixtures/malicious.note.html`) are **authoritative test artifacts**. The coding agent must write them to disk **byte-for-byte** (do not reformat, re-indent, or "clean up") and must never edit them to make a failing test pass — a failing fixture means the code is wrong, not the fixture.

### A.1 What each fixture locks in

| Fixture | Purpose |
|---|---|
| `minimal.note.html` | Golden-path import: 1 page, title, 2 questions, bullet list, callout, spans with classes, valid escaped Mermaid. Must import with **zero warnings**. |
| `full.note.html` | Full component coverage: 2 pages, table, SVG diagram (markers + gradient), Excalidraw scene, definition, code, quote, divider, spacer, check list, numbered list, absolutely-positioned element, data-URI image, all inline rich-text tags, heading levels 2 & 3, multiple font families. Must import with **zero warnings**. |
| `malicious.note.html` | Security suite: every §10.6 vector plus extras. Must import **successfully** (structural validation passes) with all vectors neutralized and all legitimate content intact. |

### A.2 Renderer DOM contract (fixtures' stylesheets depend on this)

The Shared Renderer (§11) emits, for every element, a **base class equal to the source tag name**, in addition to any imported classes:

- Text elements: `<div class="note-heading [imported classes]" …>` (semantic tag mapping per §11.4 applies to the *public* mode: heading → `h2/h3/h4`, paragraph → `p`, quote → `blockquote`; class names are identical in all modes).
- `<note-definition>` → `<div class="note-definition"><span class="note-definition-term">{term}</span> {html}</div>`
- `<note-callout type="T">` → `<div class="note-callout note-callout--T">` + optional `<div class="note-callout-title">{title}</div><div class="note-callout-body">{html/children}</div>`
- `<note-list type="check">` → `<ul class="note-list note-list--check">` with each item prefixed by `<span class="note-check">☑</span>` / `☐` from `data-checked`.
- `<note-divider>` → `<hr class="note-divider">`; `<note-code>` → `<pre class="note-code"><code>…</code></pre>`; `<note-table>` → real `<table>` inside `<figure class="note-table">` (+ `<figcaption>` when `data-caption` present).
- Page container: `<div class="note-page" style="width/height/background…">` (this is why fixture stylesheets scope rules with `.note-page …`).

### A.3 Sanitizer clarifications & errata (binding addenda to §10)

1. **HTML comments are stripped** entirely during sanitization.
2. **A `<style>` element outside `<head>` is dropped entirely** (warning `CSS_RULE_DROPPED`), including its text.
3. `<base>`, `<link>`, and `<meta http-equiv="refresh">` in `<head>` are dropped.
4. Scheme checks (`javascript:`, `data:text/html`, `vbscript:`) are **case-insensitive and whitespace-trimmed** (catch `jAvAsCrIpT:`, `"jav\tascript:"`).
5. `<img>` / `<note-image>` with an external `src`: the attribute is **removed** + warning `EXTERNAL_RESOURCE_STRIPPED`; the element is kept (renderer shows a broken-image placeholder). Never fetched.
6. **Disallowed inline wrappers are unwrapped** (wrapper removed, children kept) — e.g., `<a xlink:href="javascript:…">text</a>` in SVG keeps the text. **Dangerous container elements are dropped with their entire subtree** — `form`, `iframe`, `object`, `embed`, `script`, `template`.
7. **Erratum to §5.8:** Fixture A applies `class="q-card"` to its `<note-question>` elements (the §5.8 sketch defined `.q-card` in CSS but omitted applying it).
8. When a `<style>` in `<head>` mixes legitimate and dangerous rules, only the dangerous **rules/declarations** are dropped (warning each); the rest of the stylesheet survives.

### A.4 Malicious-fixture assertion suite (sketch — implement in `tests/unit/security.spec.ts`)

```ts
const { model, warnings } = parseNoteHtml(read('fixtures/malicious.note.html'));
const s = JSON.stringify(model);
expect(s).not.toMatch(/<script/i);
expect(s).not.toMatch(/\son[a-z]+\s*=/i);       // any on* handler
expect(s).not.toMatch(/javascript\s*:/i);
expect(s).not.toMatch(/data:text\/html/i);
expect(s).not.toMatch(/evil\.com/);
expect(s).not.toMatch(/@import/i);
expect(s).not.toMatch(/position:\s*fixed/i);
expect(s).not.toMatch(/<!--/);                   // comments stripped
// legit content survives
expect(model.css).toContain('#b91c1c');          // .mf-q rule survived head <style>
const q1 = findQuestion(model, 1);
expect(plainText(q1)).toContain('Output encoding');
expect(findDiagram(model, 'mermaid').source).toContain('Sanitize');
const svg = findDiagram(model, 'svg');
expect(svg.source).toContain('<rect');           // green box survived
expect(svg.source).toContain('Safe text');       // unwrapped text survived
expect(svg.source).not.toContain('xlink:href');  // malicious wrapper gone
```

Also required: `tests/unit/parse.fixtures.spec.ts` (exact model assertions for A & B), `tests/unit/roundtrip.spec.ts` (`parse(serialize(parse(f)))` deep-equals `parse(f)` for A & B), and Playwright visual tests proving editor ≡ preview ≡ public rendering of both A and B.

### A.5 Phase-1 repo layout

```
noteforge/
├─ SPEC.md
├─ fixtures/                      # A.1 — never modified after creation
├─ prisma/schema.prisma           # §7
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                        # library / dashboard
│  │  ├─ import/page.tsx                 # drag & drop upload
│  │  ├─ documents/[id]/review/page.tsx  # §9.1 Import Review
│  │  ├─ documents/[id]/edit/page.tsx    # §12 editor
│  │  ├─ documents/[id]/versions/page.tsx
│  │  ├─ notes/[slug]/page.tsx           # §15.2 public viewer (SSR)
│  │  └─ api/                            # §8 routes
│  ├─ components/renderer/        # NoteRenderer + element components — THE ONLY renderer
│  ├─ components/editor/
│  ├─ components/diagrams/        # mermaid & excalidraw modals (dynamic imports)
│  ├─ lib/
│  │  ├─ note-format/             # types.ts · parse.ts · sanitize.ts · css.ts · serialize.ts
│  │  ├─ store/                   # zustand editor store + undo/redo
│  │  └─ server/                  # storage.ts · import-pipeline.ts
│  └─ tests/                      # vitest + playwright (A.4)
└─ .env.example                   # §3.1
```

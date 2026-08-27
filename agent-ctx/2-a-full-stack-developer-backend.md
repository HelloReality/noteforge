# Task 2-a — Backend Work Record

Task ID: 2-a
Agent: full-stack-developer (backend)
Task: Build the full NoteForge backend — Prisma schema, storage lib, import pipeline, all five API routes, and a seed script.

## What I built

### 1. Prisma schema (`prisma/schema.prisma`)
Replaced the placeholder User/Post models with the NoteForge Document ↔ Version schema (§7). Added two small deviations from the spec text, both required for SQLite + Prisma:
- `latestVersionId String? @unique` — Prisma requires a 1:1 relation field to be backed by a unique scalar (otherwise `db push` fails with `P1012`).
- `onDelete: SetNull` on the `latestVersion` relation — if a Version row is deleted, the pointer on its Document is nulled (rather than the delete cascading back into the Document). The `Document → Version` cascade (`onDelete: Cascade`) is preserved as specified.

`bun run db:push` succeeded (Prisma Client 6.19.2 generated).

### 2. Storage lib (`src/lib/server/storage.ts`)
Server-only helpers, all using `import { db } from '@/lib/db'`. Exports:
- `slugify(title)` — NFKD-normalize, strip combining marks, lowercase, `[^a-z0-9]+` → `-`, capped at 80 chars.
- `createDocumentFromImport(model, warnings)` — single transaction: create Document (status='review', unique slug), create Version (number=1, modelJson + warningsJson), set `latestVersionId`. Returns `{ documentId, versionId }`.
- `getDocumentWithLatest(id)` — Document + latest Version; parses `modelJson`/`warningsJson` back into typed `NoteDocument`/`Warning[]`. Returns `null` if missing.
- `listDocuments()` — library rows: `{ id, title, slug, status, updatedAt, versionCount, latestVersionNumber }` sorted by `updatedAt desc`.
- `updateDocumentMeta(id, { title?, slug?, status? })` — re-uniques slug on change; throws `StatusValidationError` for invalid status; returns updated row or `null`.
- `saveVersion(documentId, model, note?)` — appends Version with `number = max+1`, updates `latestVersionId`. Throws `DocumentNotFoundError` if missing.
- `listVersions(documentId)` — `{ id, number, note, warningCount, createdAt }` ascending.
- `getVersion(documentId, number)` — full version with parsed model + warnings.
- `getPublishedBySlug(slug)` — Document + latest Version, gated on `status === 'published'`.
- Typed errors: `StatusValidationError`, `DocumentNotFoundError`.

### 3. Import pipeline (`src/lib/server/import-pipeline.ts`)
- `importNoteHtml(filename, fileText)` — calls `parseNoteHtml`, scans for any `level:'error'` `STRUCTURAL_ERROR` warning (i.e. no `<note-document>`), throws a typed `ImportError` so the API maps to 400. Otherwise calls `createDocumentFromImport` and returns `{ documentId, versionId, warnings, title }`.
- `ImportError` carries `code: 'STRUCTURAL_ERROR'` and a human message including the filename.

### 4. API routes (all `runtime = 'nodejs'`)
All under `src/app/api/...`, App Router style (`export async function POST(req: Request, ctx)` with `await ctx.params`). Responses via `NextResponse.json`.

| Route | Method | Request | Response |
|---|---|---|---|
| `/api/import` | POST | multipart/form-data with field `file` (a `.note.html` File or text) OR JSON `{ html: string }` | 201 `{ documentId, versionId, warnings: Warning[], title }`; 400 `{ error }` |
| `/api/documents` | GET | — | 200 `DocumentListRow[]` |
| `/api/documents/[id]` | GET | — | 200 `{ id, title, slug, status, createdAt, updatedAt, version: { id, number, note, createdAt } \| null, model: NoteDocument \| null, warnings: Warning[] }`; 404 `{ error }` |
| `/api/documents/[id]` | PATCH | JSON `{ title?, slug?, status? }` | 200 `{ id, title, slug, status, updatedAt }`; 400 (bad shape / invalid status); 404 |
| `/api/documents/[id]/versions` | GET | — | 200 `VersionListRow[]` (`{ id, number, note, warningCount, createdAt }`) |
| `/api/documents/[id]/versions` | POST | JSON `{ model: NoteDocument, note?: string }` | 201 `{ versionId, number }`; 400 (bad model shape); 404 (doc missing) |
| `/api/notes/[slug]` | GET | — | 200 `{ model: NoteDocument, title: string, document: { id, title, slug, updatedAt } }`; 404 |

### 5. Seed script (`scripts/seed.ts`)
- Reads the three fixtures (`fixtures/{minimal,full,malicious}.note.html`) byte-for-byte.
- Idempotent: extracts each fixture's title (regex on `data-title` then `<title>`) and skips if a Document with that title already exists.
- Prints one line per fixture: ✓ seeded (with id + slug + warning count) or • skip (already present).

### 6. End-to-end verification (live against dev server on :3000)
- `bun run db:push` — succeeded.
- Seed run #1 — created 3 documents:
  - "Cybersecurity Notes — Sample"  → slug `cybersecurity-notes-sample`, warnings=0
  - "Cybersecurity Notes — Full Coverage Fixture" → slug `cybersecurity-notes-full-coverage-fixture`, warnings=0
  - "Malicious Fixture — must import safely" → slug `malicious-fixture-must-import-safely`, warnings=19
- Seed run #2 — idempotent, skipped all 3.
- API smoke tests via curl:
  - `GET /api/documents` → 200, 3 rows
  - `GET /api/documents/:id` → 200 with full model + warnings
  - `PATCH /api/documents/:id {status:"published"}` → 200; subsequent `GET /api/notes/:slug` → 200 with published model
  - `GET /api/documents/:id/versions` → 200 with version rows
  - `POST /api/documents/:id/versions {model, note}` → 201 `{ versionId, number:2 }`; subsequent GET shows 2 versions
  - `POST /api/import` (JSON `{html}`) → 201 with new documentId
  - `POST /api/import` (bogus html, no `<note-document>`) → 400 with `Import failed for "body.note.html": No <note-document> root found`
  - `PATCH {status:"bogus"}` → 400 with `Invalid status: bogus. Must be one of draft|review|published.`
- Cleaned up all test artifacts (deleted test doc, reset published doc back to `review`). DB now contains exactly the 3 seeded docs in `review` status — clean slate for the frontend agent.

### 7. Lint
`bun run lint` — passed with zero errors (no new errors introduced; none pre-existing).

## Notes for the frontend agent
- All API responses use ISO-8601 `string` timestamps (not raw Date objects).
- `latestVersionNumber` can be `null` on documents with no versions (shouldn't normally happen post-import, but be defensive).
- For the public viewer (`/notes/[slug]`), the `GET /api/notes/:slug` route is the SSR data source. It returns `{ model, title, document }`. The slug lookup requires the Document's `status === 'published'` — call `PATCH /api/documents/:id { status: "published" }` to publish.
- `GET /api/documents/:id/versions` does NOT include `modelJson` (just metadata + `warningCount`). Use `GET /api/documents/:id/versions/:number` (NOTE: this single-version GET route is not in the §8 list — I did not create it; if the versions page needs to preview a specific version, that's a small addition, ask) — actually, scratch that. The versions-list response carries only metadata. To preview a specific version, you have two options: (a) use the `latestVersion` from `GET /api/documents/:id` and post a new version with `note:"restored from N"` to "restore" (matches §13's append-only rule), or (b) I can add `GET /api/documents/:id/versions/:number` returning the parsed model — let me know if you want it.
- Import endpoint accepts BOTH multipart/form-data (`file` field) and JSON `{ html }` — useful for programmatic tests and for a drag-and-drop UI alike.

## Files touched/created (no edits to existing UI/parser files)
- `prisma/schema.prisma` (replaced User/Post models)
- `src/lib/server/storage.ts` (new)
- `src/lib/server/import-pipeline.ts` (new)
- `src/app/api/import/route.ts` (new)
- `src/app/api/documents/route.ts` (new)
- `src/app/api/documents/[id]/route.ts` (new)
- `src/app/api/documents/[id]/versions/route.ts` (new)
- `src/app/api/notes/[slug]/route.ts` (new)
- `scripts/seed.ts` (new)

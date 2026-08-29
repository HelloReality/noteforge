// NoteForge — server-only storage helpers (§7, §8)
// All functions use the Prisma client via `@/lib/db`. Imported only from
// server contexts (route handlers / scripts). Never imported from a
// `'use client'` module — Prisma cannot run in the browser/edge runtime.

import { db } from '@/lib/db'
import type { NoteDocument, Warning, DocumentStatus } from '@/lib/note-format/types'

/** Library-list row shape (§8 GET /api/documents). */
export interface DocumentListRow {
  id: string
  title: string
  slug: string
  status: string
  updatedAt: string
  versionCount: number
  latestVersionNumber: number | null
}

/** Full document + latest version shape (§8 GET /api/documents/:id). */
export interface DocumentWithLatest {
  id: string
  title: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
  version: {
    id: string
    number: number
    note: string | null
    createdAt: string
  } | null
  model: NoteDocument | null
  warnings: Warning[]
}

/** Version-list row shape (§8 GET /api/documents/:id/versions). */
export interface VersionListRow {
  id: string
  number: number
  note: string | null
  warningCount: number
  createdAt: string
}

const STATUS_VALUES: readonly DocumentStatus[] = ['draft', 'review', 'published'] as const

function isStatus(v: unknown): v is DocumentStatus {
  return typeof v === 'string' && (STATUS_VALUES as readonly string[]).includes(v)
}

/**
 * Convert a free-form title into a URL-safe slug.
 * Lowercase, dash-separated, ASCII alphanumerics only. If a document with the
 * candidate slug already exists, a short random suffix is appended.
 */
export function slugify(title: string): string {
  const base =
    (title || 'untitled')
      .toLowerCase()
      .normalize('NFKD')
      // strip combining marks (accents → base letter)
      .replace(/[\u0300-\u036f]/g, '')
      // replace any non-alphanumeric run with a single dash
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .slice(0, 80) || 'untitled'

  return base
}

/** Return a slug guaranteed unique within the documents table. */
async function uniqueSlug(base: string): Promise<string> {
  let candidate = base
  // If the exact slug is free, take it.
  const existing = await db.document.findUnique({ where: { slug: candidate }, select: { id: true } })
  if (!existing) return candidate
  // Otherwise append short random suffixes until we find a free slot.
  for (let attempt = 0; attempt < 16; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6) // ~4 chars
    candidate = `${base}-${suffix}`
    const clash = await db.document.findUnique({ where: { slug: candidate }, select: { id: true } })
    if (!clash) return candidate
  }
  // Last resort: timestamp suffix.
  return `${base}-${Date.now().toString(36).slice(-6)}`
}

/**
 * Create a Document (status='review') and its first Version (number=1) in a
 * single transaction, wiring the latestVersionId pointer. Returns the new IDs.
 */
export async function createDocumentFromImport(
  model: NoteDocument,
  warnings: Warning[],
): Promise<{ documentId: string; versionId: string }> {
  const slug = await uniqueSlug(slugify(model.title || 'untitled'))
  const modelJson = JSON.stringify(model)
  const warningsJson = JSON.stringify(warnings)

  return db.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        title: model.title || 'Untitled',
        slug,
        status: 'review',
      },
    })
    const version = await tx.version.create({
      data: {
        documentId: document.id,
        number: 1,
        modelJson,
        warningsJson,
        note: null,
      },
    })
    await tx.document.update({
      where: { id: document.id },
      data: { latestVersionId: version.id },
    })
    return { documentId: document.id, versionId: version.id }
  })
}

/**
 * Fetch a Document with its latest Version, parsing the model + warnings JSON
 * back into typed objects. Returns null if the document does not exist.
 */
export async function getDocumentWithLatest(id: string): Promise<DocumentWithLatest | null> {
  const doc = await db.document.findUnique({
    where: { id },
    include: { latestVersion: true },
  })
  if (!doc) return null
  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    version: doc.latestVersion
      ? {
          id: doc.latestVersion.id,
          number: doc.latestVersion.number,
          note: doc.latestVersion.note,
          createdAt: doc.latestVersion.createdAt.toISOString(),
        }
      : null,
    model: doc.latestVersion ? (JSON.parse(doc.latestVersion.modelJson) as NoteDocument) : null,
    warnings: doc.latestVersion
      ? (JSON.parse(doc.latestVersion.warningsJson) as Warning[])
      : [],
  }
}

/**
 * Library list — id, title, slug, status, updatedAt, versionCount,
 * latestVersionNumber. Sorted by updatedAt desc.
 */
export async function listDocuments(): Promise<DocumentListRow[]> {
  const docs = await db.document.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { versions: true } },
      latestVersion: { select: { number: true } },
    },
  })
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    status: d.status,
    updatedAt: d.updatedAt.toISOString(),
    versionCount: d._count.versions,
    latestVersionNumber: d.latestVersion?.number ?? null,
  }))
}

/**
 * Update a Document's title / slug / status. `slug` is re-uniqued if changed
 * (collision-avoiding suffix appended). `status` must be one of
 * draft|review|published. Returns the updated row.
 */
export async function updateDocumentMeta(
  id: string,
  patch: { title?: string; slug?: string; status?: string; publishedVersionId?: string },
): Promise<{ id: string; title: string; slug: string; status: string; updatedAt: string } | null> {
  const existing = await db.document.findUnique({ where: { id }, select: { id: true, slug: true } })
  if (!existing) return null

  const data: { title?: string; slug?: string; status?: string; publishedVersionId?: string | null } = {}
  if (typeof patch.title === 'string' && patch.title.trim().length > 0) {
    data.title = patch.title.trim()
  }
  if (typeof patch.slug === 'string' && patch.slug.trim().length > 0) {
    const desired = slugify(patch.slug.trim())
    if (desired !== existing.slug) {
      data.slug = await uniqueSlug(desired)
    }
  }
  if (typeof patch.status === 'string') {
    if (!isStatus(patch.status)) {
      throw new StatusValidationError(patch.status)
    }
    data.status = patch.status
    // When unpublishing (setting status away from 'published'), also clear
    // the publishedVersionId so the public viewer returns 404. Re-publishing
    // later sets a fresh publishedVersionId via publishVersion().
    if (patch.status !== 'published') {
      data.publishedVersionId = null
    }
  }
  if (typeof patch.publishedVersionId === 'string') {
    data.publishedVersionId = patch.publishedVersionId
  }

  const updated = await db.document.update({ where: { id }, data })
  return {
    id: updated.id,
    title: updated.title,
    slug: updated.slug,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  }
}

/**
 * Append a new Version (number = max+1) for the given document and update the
 * latestVersionId pointer. The caller is responsible for the model already
 * being sanitized — the storage layer just persists JSON.
 */
export async function saveVersion(
  documentId: string,
  model: NoteDocument,
  note?: string,
): Promise<{ versionId: string; number: number }> {
  const doc = await db.document.findUnique({ where: { id: documentId }, select: { id: true } })
  if (!doc) throw new DocumentNotFoundError(documentId)

  const modelJson = JSON.stringify(model)
  // Editor-saved versions are not re-import warnings; persist an empty array
  // so the warnings channel stays consistent.
  const warningsJson = JSON.stringify([] as Warning[])

  return db.$transaction(async (tx) => {
    const latest = await tx.version.aggregate({
      where: { documentId },
      _max: { number: true },
    })
    const number = (latest._max.number ?? 0) + 1
    const version = await tx.version.create({
      data: { documentId, number, modelJson, warningsJson, note: note ?? null },
    })
    await tx.document.update({
      where: { id: documentId },
      data: { latestVersionId: version.id },
    })
    return { versionId: version.id, number }
  })
}

/** All versions of a document, oldest → newest. */
export async function listVersions(documentId: string): Promise<VersionListRow[]> {
  const versions = await db.version.findMany({
    where: { documentId },
    orderBy: { number: 'asc' },
  })
  return versions.map((v) => ({
    id: v.id,
    number: v.number,
    note: v.note,
    warningCount: countWarnings(v.warningsJson),
    createdAt: v.createdAt.toISOString(),
  }))
}

function countWarnings(warningsJson: string): number {
  try {
    const arr = JSON.parse(warningsJson) as unknown
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

/** Fetch a specific version by document + number. Returns parsed model + warnings. */
export async function getVersion(
  documentId: string,
  number: number,
): Promise<{
  id: string
  number: number
  note: string | null
  createdAt: string
  model: NoteDocument
  warnings: Warning[]
} | null> {
  const v = await db.version.findFirst({
    where: { documentId, number },
  })
  if (!v) return null
  return {
    id: v.id,
    number: v.number,
    note: v.note,
    createdAt: v.createdAt.toISOString(),
    model: JSON.parse(v.modelJson) as NoteDocument,
    warnings: JSON.parse(v.warningsJson) as Warning[],
  }
}

/**
 * Fetch the published document by slug — the document's status must be
 * 'published'. We return the *published* version (the version that was
 * explicitly promoted via publishVersion), NOT the latest version — so
 * editing a draft after publishing does NOT change the public page.
 * If publishedVersionId is null (legacy docs published before this field
 * existed), fall back to latestVersion for backward compat.
 */
export async function getPublishedBySlug(slug: string): Promise<{
  document: { id: string; title: string; slug: string; updatedAt: string }
  model: NoteDocument
  warnings: Warning[]
} | null> {
  const doc = await db.document.findUnique({
    where: { slug },
    include: { latestVersion: true, publishedVersion: true },
  })
  if (!doc || doc.status !== 'published') return null
  const pubVer = doc.publishedVersion ?? doc.latestVersion
  if (!pubVer) return null
  return {
    document: {
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      updatedAt: doc.updatedAt.toISOString(),
    },
    model: JSON.parse(pubVer.modelJson) as NoteDocument,
    warnings: JSON.parse(pubVer.warningsJson) as Warning[],
  }
}

/**
 * Promote a specific version to "published": sets status='published' AND
 * publishedVersionId = that version's id. The latestVersionId is NOT changed
 * — the editor keeps working on the latest draft. The public viewer will
 * read publishedVersion from now on.
 * If versionId is omitted, the latest version is used (backward-compat with
 * the old "save + set status" publish flow).
 */
export async function publishVersion(
  documentId: string,
  versionId?: string,
): Promise<{ id: string; status: string; publishedVersionId: string | null } | null> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { id: true, latestVersionId: true },
  })
  if (!doc) throw new DocumentNotFoundError(documentId)
  const targetVersionId = versionId ?? doc.latestVersionId
  if (!targetVersionId) {
    throw new Error('Cannot publish a document with no versions')
  }
  const updated = await db.document.update({
    where: { id: documentId },
    data: { status: 'published', publishedVersionId: targetVersionId },
  })
  return {
    id: updated.id,
    status: updated.status,
    publishedVersionId: updated.publishedVersionId,
  }
}

// ── Typed errors ───────────────────────────────────────────────────────────

/** Return the slugs of all currently-published documents (for the library to badge "public"). */
export async function getPublishedSlugs(): Promise<string[]> {
  const rows = await db.document.findMany({
    where: { status: 'published' },
    select: { slug: true },
  })
  return rows.map((r) => r.slug)
}

export class StatusValidationError extends Error {
  readonly value: string
  constructor(value: unknown) {
    super(`Invalid status: ${String(value)}. Must be one of draft|review|published.`)
    this.name = 'StatusValidationError'
    this.value = typeof value === 'string' ? value : String(value)
  }
}

export class DocumentNotFoundError extends Error {
  readonly documentId: string
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`)
    this.name = 'DocumentNotFoundError'
    this.documentId = documentId
  }
}

// ── Document lifecycle: duplicate / delete / stats ──────────────────────────

/** Duplicate a document (its latest version's model + warnings) into a new
 *  Document with status='draft' and slug "<base>-copy" (de-conflicted). */
export async function duplicateDocument(id: string): Promise<{ documentId: string; versionId: string; slug: string }> {
  const source = await getDocumentWithLatest(id)
  if (!source || !source.model) throw new DocumentNotFoundError(id)
  const slug = await uniqueSlug(slugify(`${source.title} copy`))
  const modelJson = JSON.stringify(source.model)
  const warningsJson = JSON.stringify(source.warnings || [])
  return db.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: { title: `${source.title} (copy)`, slug, status: 'draft' },
    })
    const version = await tx.version.create({
      data: { documentId: document.id, number: 1, modelJson, warningsJson, note: 'Duplicated from another document' },
    })
    await tx.document.update({ where: { id: document.id }, data: { latestVersionId: version.id } })
    return { documentId: document.id, versionId: version.id, slug }
  })
}

/** Delete a document and all its versions (cascade). */
export async function deleteDocument(id: string): Promise<void> {
  // ensure it exists (throws DocumentNotFoundError otherwise)
  const doc = await db.document.findUnique({ where: { id }, select: { id: true } })
  if (!doc) throw new DocumentNotFoundError(id)
  await db.document.delete({ where: { id } })
}

/** Restore an old version by creating a NEW version (append-only) with that
 *  version's model + warnings. Returns the new version number. */
export async function restoreVersion(documentId: string, number: number): Promise<{ versionId: string; number: number }> {
  const source = await getVersion(documentId, number)
  if (!source) throw new DocumentNotFoundError(documentId)
  const modelJson = JSON.stringify(source.model)
  const warningsJson = JSON.stringify(source.warnings || [])
  return db.$transaction(async (tx) => {
    const latest = await tx.version.findFirst({
      where: { documentId }, orderBy: { number: 'desc' }, select: { number: true },
    })
    const nextNumber = (latest?.number ?? 0) + 1
    const version = await tx.version.create({
      data: {
        documentId, number: nextNumber, modelJson, warningsJson,
        note: `Restored from v${number}`,
      },
    })
    await tx.document.update({
      where: { id: documentId },
      data: { latestVersionId: version.id },
    })
    return { versionId: version.id, number: nextNumber }
  })
}

/** Aggregate document statistics (page count, block count, word count, diagram count). */
export interface DocumentStats {
  pages: number
  blocks: number
  words: number
  diagrams: number
  tables: number
  questions: number
}
export async function getDocumentStats(id: string): Promise<DocumentStats | null> {
  const data = await getDocumentWithLatest(id)
  if (!data || !data.model) return null
  const model = data.model
  let blocks = 0
  let words = 0
  let diagrams = 0
  let tables = 0
  let questions = 0
  const countBlock = (b: any) => {
    blocks++
    switch (b.type) {
      case 'question':
        questions++
        b.children?.forEach(countBlock)
        break
      case 'diagram': diagrams++; break
      case 'table': tables++; break
    }
    const html = b.html || b.text || b.term || ''
    if (html) words += html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
    if (b.items) words += b.items.map((i: any) => i.html?.replace(/<[^>]+>/g, ' ') || '').join(' ').split(/\s+/).filter(Boolean).length
  }
  for (const page of model.pages) for (const b of page.blocks) countBlock(b)
  return { pages: model.pages.length, blocks, words, diagrams, tables, questions }
}

// ── Full-text search across document content ────────────────────────────────

export interface SearchResultHit {
  page: number
  blockIndex: number
  blockType: string
  snippet: string
  /** the matched text with <mark> around the query term */
  highlighted: string
}

export interface SearchResultRow {
  id: string
  title: string
  slug: string
  status: string
  updatedAt: string
  hits: SearchResultHit[]
  totalMatches: number
}

/** Extract plain text from a block (recursively for questions). */
function blockText(block: any): string {
  if (!block) return ''
  let text = ''
  if (block.html) text += ' ' + block.html.replace(/<[^>]+>/g, ' ')
  if (block.text) text += ' ' + block.text
  if (block.term) text += ' ' + block.term
  if (block.title) text += ' ' + block.title
  if (block.caption) text += ' ' + block.caption
  if (block.cite) text += ' ' + block.cite
  if (block.alt) text += ' ' + block.alt
  if (block.items) text += ' ' + block.items.map((i: any) => i.html?.replace(/<[^>]+>/g, ' ') || '').join(' ')
  if (block.children) text += ' ' + block.children.map(blockText).join(' ')
  return text.replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function makeSnippet(text: string, query: string, radius = 60): { snippet: string; highlighted: string } {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return { snippet: text.slice(0, radius * 2), highlighted: text.slice(0, radius * 2) }
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + query.length + radius)
  const raw = text.slice(start, end)
  // Build highlighted version with <mark> around matches (case-insensitive)
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlighted = raw.replace(new RegExp(escapedQuery, 'gi'), (m) => `<mark>${m}</mark>`)
  return {
    snippet: (start > 0 ? '…' : '') + raw + (end < text.length ? '…' : ''),
    highlighted: (start > 0 ? '…' : '') + highlighted + (end < text.length ? '…' : ''),
  }
}

/**
 * Search across all documents' latest version content for a query string.
 * Returns documents with hits (title/slug/status + per-block matches).
 * Case-insensitive, matches plain text content (HTML tags stripped).
 */
export async function searchDocumentContent(query: string, limit = 20): Promise<SearchResultRow[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const docs = await db.document.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { latestVersion: true },
    take: 100, // scan at most 100 latest versions
  })

  const results: SearchResultRow[] = []
  for (const doc of docs) {
    if (!doc.latestVersion) continue
    let model: NoteDocument
    try {
      model = JSON.parse(doc.latestVersion.modelJson) as NoteDocument
    } catch {
      continue
    }
    const hits: SearchResultHit[] = []
    for (let pi = 0; pi < model.pages.length; pi++) {
      const page = model.pages[pi]
      for (let bi = 0; bi < page.blocks.length; bi++) {
        const block = page.blocks[bi] as any
        const text = blockText(block)
        if (!text) continue
        if (text.toLowerCase().includes(q)) {
          const { snippet, highlighted } = makeSnippet(text, q)
          hits.push({
            page: page.page,
            blockIndex: bi,
            blockType: block.type,
            snippet,
            highlighted,
          })
        }
      }
    }
    if (hits.length > 0) {
      results.push({
        id: doc.id,
        title: doc.title,
        slug: doc.slug,
        status: doc.status,
        updatedAt: doc.updatedAt.toISOString(),
        hits: hits.slice(0, 5), // cap hits per doc
        totalMatches: hits.length,
      })
    }
    if (results.length >= limit) break
  }
  return results
}

/** Return the most recently edited documents (for the library dashboard). */
export async function listRecentDocuments(limit = 5): Promise<DocumentListRow[]> {
  const docs = await db.document.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: {
      _count: { select: { versions: true } },
      latestVersion: { select: { number: true } },
    },
  })
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    slug: d.slug,
    status: d.status,
    updatedAt: d.updatedAt.toISOString(),
    versionCount: d._count.versions,
    latestVersionNumber: d.latestVersion?.number ?? null,
  }))
}

/** Aggregate statistics across ALL documents (for the dashboard summary). */
export interface LibraryStats {
  documents: number
  versions: number
  pages: number
  blocks: number
  words: number
  diagrams: number
  tables: number
  questions: number
}
export async function getLibraryStats(): Promise<LibraryStats> {
  const docs = await db.document.findMany({
    include: {
      _count: { select: { versions: true } },
      latestVersion: { select: { modelJson: true } },
    },
  })
  let pages = 0, blocks = 0, words = 0, diagrams = 0, tables = 0, questions = 0, versions = 0
  for (const d of docs) {
    versions += d._count.versions
    if (!d.latestVersion) continue
    try {
      const model = JSON.parse(d.latestVersion.modelJson) as NoteDocument
      pages += model.pages.length
      for (const page of model.pages) {
        for (const b of page.blocks) {
          const count = (blk: any) => {
            blocks++
            if (blk.type === 'question') { questions++; blk.children?.forEach(count) }
            if (blk.type === 'diagram') diagrams++
            if (blk.type === 'table') tables++
            const html = blk.html || blk.text || blk.term || ''
            if (html) words += html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
            if (blk.items) words += blk.items.map((i: any) => i.html?.replace(/<[^>]+>/g, ' ') || '').join(' ').split(/\s+/).filter(Boolean).length
          }
          count(b)
        }
      }
    } catch {
      // skip unparseable
    }
  }
  return { documents: docs.length, versions, pages, blocks, words, diagrams, tables, questions }
}

// ── Batch operations ─────────────────────────────────────────────────────────

export interface BatchResult {
  successful: string[]
  failed: { id: string; error: string }[]
}

/** Bulk update status for multiple documents. */
export async function batchUpdateStatus(ids: string[], status: string): Promise<BatchResult> {
  if (!['draft', 'review', 'published'].includes(status)) {
    throw new StatusValidationError(status)
  }
  const successful: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      const updated = await updateDocumentMeta(id, { status })
      if (updated) successful.push(id)
      else failed.push({ id, error: 'Not found' })
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }
  return { successful, failed }
}

/** Bulk delete multiple documents. */
export async function batchDeleteDocuments(ids: string[]): Promise<BatchResult> {
  const successful: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await deleteDocument(id)
      successful.push(id)
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }
  return { successful, failed }
}

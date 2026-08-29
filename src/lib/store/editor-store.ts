// NoteForge — editor store (zustand) with undo/redo (§12)
// Holds the current NoteDocument model, selection, page cursor, dirty flag,
// and past/future history stacks. All mutations are immutable (structuredClone)
// so React re-renders and undo/redo work.

'use client'

import { create } from 'zustand'
import type { Block, NoteDocument, NotePage } from '@/lib/note-format/types'

/** A block location. [page, block] for top-level blocks; [page, questionBlock, child] for nested. */
export type BlockPath = [number, number] | [number, number, number]

interface EditorState {
  doc: NoteDocument | null
  selectedPath: BlockPath | null
  currentPage: number
  dirty: boolean
  past: NoteDocument[]
  future: NoteDocument[]
  // actions
  load: (doc: NoteDocument) => void
  select: (path: BlockPath | null) => void
  setCurrentPage: (page: number) => void
  updateDocMeta: (patch: Partial<Pick<NoteDocument, 'title' | 'version'>>) => void
  updateBlock: (path: BlockPath, patch: Partial<Block>) => void
  addBlock: (page: number, block: Block, at?: BlockPath | 'end') => void
  deleteBlock: (path: BlockPath) => void
  moveBlock: (path: BlockPath, dir: 'up' | 'down') => void
  reorderBlock: (from: BlockPath, toIndex: number) => void
  duplicateBlock: (path: BlockPath) => void
  wrapInQuestion: (path: BlockPath) => void
  replaceBlock: (path: BlockPath, block: Block) => void
  undo: () => void
  redo: () => void
  resetDirty: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  // page management
  addPage: () => void
  deletePage: (page: number) => void
  duplicatePage: (page: number) => void
  updatePageMeta: (page: number, patch: Partial<Pick<NotePage, 'width' | 'height' | 'background'>>) => void
}

function clone<T>(v: T): T {
  return (typeof structuredClone === 'function')
    ? structuredClone(v)
    : JSON.parse(JSON.stringify(v))
}

function getBlockArray(doc: NoteDocument, page: number): Block[] {
  return doc.pages[page]?.blocks ?? []
}

function getBlock(doc: NoteDocument, path: BlockPath): Block | undefined {
  const [p, b, c] = path
  const block = doc.pages[p]?.blocks?.[b]
  if (!block) return undefined
  if (c === undefined) return block
  if (block.type === 'question') return block.children[c]
  return undefined
}

function setBlock(doc: NoteDocument, path: BlockPath, block: Block): NoteDocument {
  const next = clone(doc)
  const [p, b, c] = path
  if (c === undefined) {
    next.pages[p].blocks[b] = block
  } else {
    const parent = next.pages[p].blocks[b]
    if (parent.type === 'question') parent.children[c] = block
  }
  return next
}

function withHistory(state: EditorState, next: NoteDocument): Partial<EditorState> {
  return {
    doc: next,
    past: [...state.past, state.doc as NoteDocument].slice(-50),
    future: [],
    dirty: true,
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  doc: null,
  selectedPath: null,
  currentPage: 0,
  dirty: false,
  past: [],
  future: [],

  load: (doc) => set({ doc, past: [], future: [], dirty: false, selectedPath: null, currentPage: 0 }),

  select: (path) => set({ selectedPath: path }),

  setCurrentPage: (page) => set({ currentPage: page, selectedPath: null }),

  updateDocMeta: (patch) => set((s) => s.doc ? withHistory(s, { ...clone(s.doc), ...patch }) : {}),

  updateBlock: (path, patch) => set((s) => {
    if (!s.doc) return {}
    const block = getBlock(s.doc, path)
    if (!block) return {}
    const next = setBlock(s.doc, path, { ...block, ...patch } as Block)
    return withHistory(s, next)
  }),

  replaceBlock: (path, block) => set((s) => {
    if (!s.doc) return {}
    const next = setBlock(s.doc, path, block)
    return withHistory(s, next)
  }),

  addBlock: (page, block, at = 'end') => set((s) => {
    if (!s.doc) return {}
    const next = clone(s.doc)
    const arr = getBlockArray(next, page)
    if (at === 'end') {
      arr.push(block)
    } else {
      const [, idx] = at
      arr.splice(idx + 1, 0, block)
    }
    return withHistory(s, next)
  }),

  deleteBlock: (path) => set((s) => {
    if (!s.doc) return {}
    const next = clone(s.doc)
    const [p, b, c] = path
    if (c === undefined) {
      next.pages[p].blocks.splice(b, 1)
    } else {
      const parent = next.pages[p].blocks[b]
      if (parent.type === 'question') parent.children.splice(c, 1)
    }
    return { ...withHistory(s, next), selectedPath: null }
  }),

  moveBlock: (path, dir) => set((s) => {
    if (!s.doc) return {}
    const [p, b, c] = path
    const next = clone(s.doc)
    if (c === undefined) {
      const arr = next.pages[p].blocks
      const target = dir === 'up' ? b - 1 : b + 1
      if (target < 0 || target >= arr.length) return {}
      ;[arr[b], arr[target]] = [arr[target], arr[b]]
      return withHistory(s, next)
    } else {
      const parent = next.pages[p].blocks[b]
      if (parent.type !== 'question') return {}
      const arr = parent.children
      const target = dir === 'up' ? c - 1 : c + 1
      if (target < 0 || target >= arr.length) return {}
      ;[arr[c], arr[target]] = [arr[target], arr[c]]
      return withHistory(s, next)
    }
  }),

  reorderBlock: (from, toIndex) => set((s) => {
    if (!s.doc) return {}
    const [p, b, c] = from
    if (c !== undefined) return {} // only top-level blocks reorder via DnD for now
    const next = clone(s.doc)
    const arr = next.pages[p].blocks
    if (b === toIndex || toIndex < 0 || toIndex >= arr.length) return {}
    const [moved] = arr.splice(b, 1)
    arr.splice(toIndex, 0, moved)
    return withHistory(s, next)
  }),

  duplicateBlock: (path) => set((s) => {
    if (!s.doc) return {}
    const [p, b, c] = path
    const next = clone(s.doc)
    if (c === undefined) {
      const arr = next.pages[p].blocks
      const dup = clone(arr[b])
      arr.splice(b + 1, 0, dup)
    } else {
      const parent = next.pages[p].blocks[b]
      if (parent.type === 'question') {
        const dup = clone(parent.children[c])
        parent.children.splice(c + 1, 0, dup)
      }
    }
    return withHistory(s, next)
  }),

  wrapInQuestion: (path) => set((s) => {
    if (!s.doc) return {}
    const [p, b, c] = path
    if (c !== undefined) return {} // only top-level blocks can be wrapped
    const next = clone(s.doc)
    const arr = next.pages[p].blocks
    const block = arr[b]
    // Don't wrap a question in a question
    if (block.type === 'question') return {}
    const question: Block = {
      type: 'question',
      classes: [],
      children: [block],
    }
    arr.splice(b, 1, question)
    return withHistory(s, next)
  }),

  undo: () => set((s) => {
    if (!s.past.length || !s.doc) return {}
    const previous = s.past[s.past.length - 1]
    return {
      doc: previous,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future].slice(0, 50),
      dirty: true,
      selectedPath: null,
    }
  }),

  redo: () => set((s) => {
    if (!s.future.length || !s.doc) return {}
    const nextDoc = s.future[0]
    return {
      doc: nextDoc,
      future: s.future.slice(1),
      past: [...s.past, s.doc].slice(-50),
      dirty: true,
      selectedPath: null,
    }
  }),

  resetDirty: () => set({ dirty: false }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  // ── Page management ───────────────────────────────────────────────────
  addPage: () => set((s) => {
    if (!s.doc) return {}
    const next = clone(s.doc)
    const newPage: NotePage = {
      page: next.pages.length + 1,
      width: 900,
      height: 1270,
      background: '#ffffff',
      blocks: [emptyBlock('title')],
    }
    next.pages.push(newPage)
    return { ...withHistory(s, next), currentPage: next.pages.length - 1, selectedPath: null }
  }),

  deletePage: (pageIdx) => set((s) => {
    if (!s.doc) return {}
    if (s.doc.pages.length <= 1) return {}  // don't delete the last page
    const next = clone(s.doc)
    next.pages.splice(pageIdx, 1)
    // Re-number pages sequentially
    next.pages.forEach((p, i) => { p.page = i + 1 })
    const newCurrent = Math.max(0, Math.min(pageIdx, next.pages.length - 1))
    return { ...withHistory(s, next), currentPage: newCurrent, selectedPath: null }
  }),

  duplicatePage: (pageIdx) => set((s) => {
    if (!s.doc) return {}
    const next = clone(s.doc)
    const src = next.pages[pageIdx]
    if (!src) return {}
    const dup: NotePage = clone(src)
    // Insert right after the source page
    next.pages.splice(pageIdx + 1, 0, dup)
    // Re-number pages sequentially
    next.pages.forEach((p, i) => { p.page = i + 1 })
    return { ...withHistory(s, next), currentPage: pageIdx + 1, selectedPath: null }
  }),

  updatePageMeta: (pageIdx, patch) => set((s) => {
    if (!s.doc) return {}
    const next = clone(s.doc)
    const page = next.pages[pageIdx]
    if (!page) return {}
    if (patch.width !== undefined) page.width = patch.width
    if (patch.height !== undefined) page.height = patch.height
    if (patch.background !== undefined) page.background = patch.background
    return withHistory(s, next)
  }),
}))

/** Helper to create a fresh empty block of a given type. */
export function emptyBlock(type: Block['type']): Block {
  switch (type) {
    case 'title': return { type: 'title', html: 'New title', classes: [] }
    case 'heading': return { type: 'heading', level: 2, html: 'New heading', classes: [] }
    case 'paragraph': return { type: 'paragraph', html: 'New paragraph', classes: [] }
    case 'question': return { type: 'question', classes: [], children: [emptyBlock('heading')] }
    case 'list': return { type: 'list', listType: 'bullet', items: [{ html: 'First item' }], classes: [] }
    case 'callout': return { type: 'callout', calloutType: 'info', html: 'Callout text', classes: [] }
    case 'definition': return { type: 'definition', term: 'Term', html: 'definition body', classes: [] }
    case 'quote': return { type: 'quote', html: 'Quote text', classes: [] }
    case 'divider': return { type: 'divider', style: 'solid' }
    case 'spacer': return { type: 'spacer', height: 24 }
    case 'code': return { type: 'code', language: 'text', text: '// code' }
    case 'table': return { type: 'table', html: '<thead><tr><th>Col 1</th><th>Col 2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody>', classes: [] }
    case 'image': return { type: 'image', alt: 'image', classes: [] }
    case 'diagram': return { type: 'diagram', diagramType: 'mermaid', source: 'flowchart LR\n  A --> B', classes: [] }
  }
}

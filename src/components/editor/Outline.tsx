// NoteForge — editor outline (§12): page + block tree, selection, reorder, add.
'use client'

import { useState } from 'react'
import { useEditorStore, emptyBlock, type BlockPath } from '@/lib/store/editor-store'
import type { Block } from '@/lib/note-format/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Heading1, Pilcrow, List, HelpCircle,
  MessageSquareQuote, StickyNote, Quote, Minus, Square, Code2, Table, Image as ImageIcon,
  Spline, Type, Layers, FileText,
} from 'lucide-react'

const BLOCK_ICON: Record<Block['type'], React.ReactNode> = {
  title: <Type className="h-3.5 w-3.5" />,
  heading: <Heading1 className="h-3.5 w-3.5" />,
  paragraph: <Pilcrow className="h-3.5 w-3.5" />,
  question: <HelpCircle className="h-3.5 w-3.5" />,
  list: <List className="h-3.5 w-3.5" />,
  callout: <StickyNote className="h-3.5 w-3.5" />,
  definition: <MessageSquareQuote className="h-3.5 w-3.5" />,
  quote: <Quote className="h-3.5 w-3.5" />,
  divider: <Minus className="h-3.5 w-3.5" />,
  spacer: <Square className="h-3.5 w-3.5" />,
  code: <Code2 className="h-3.5 w-3.5" />,
  table: <Table className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  diagram: <Spline className="h-3.5 w-3.5" />,
}

const BLOCK_LABEL: Record<Block['type'], string> = {
  title: 'Title', heading: 'Heading', paragraph: 'Paragraph', question: 'Question',
  list: 'List', callout: 'Callout', definition: 'Definition', quote: 'Quote',
  divider: 'Divider', spacer: 'Spacer', code: 'Code', table: 'Table',
  image: 'Image', diagram: 'Diagram',
}

const ADDABLE: Block['type'][] = [
  'title', 'heading', 'paragraph', 'question', 'list', 'callout', 'definition',
  'quote', 'divider', 'spacer', 'code', 'table', 'image', 'diagram',
]

export function Outline({ currentPage }: { currentPage: number }) {
  const doc = useEditorStore((s) => s.doc)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const select = useEditorStore((s) => s.select)
  const setCurrentPage = useEditorStore((s) => s.setCurrentPage)
  const deleteBlock = useEditorStore((s) => s.deleteBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)
  const addBlock = useEditorStore((s) => s.addBlock)
  const [adding, setAdding] = useState(false)

  if (!doc) return null
  const page = doc.pages[currentPage]
  if (!page) return null

  const pathEq = (a: BlockPath | null, b: BlockPath): boolean => {
    if (!a) return false
    return a.length === b.length && a.every((v, i) => v === b[i])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500">
          <Layers className="h-3.5 w-3.5" /> Outline
        </h3>
        <span className="text-xs text-stone-400">{page.blocks.length} blocks</span>
      </div>

      {doc.pages.length > 1 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {doc.pages.map((p, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition',
                i === currentPage ? 'bg-amber-100 text-amber-900' : 'text-stone-500 hover:bg-stone-200/60',
              )}
            >
              P{p.page}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto px-2 pb-2">
        {page.blocks.map((b, i) => (
          <BlockRow
            key={i}
            block={b}
            path={[currentPage, i]}
            depth={0}
            selectedPath={selectedPath}
            pathEq={pathEq}
            onSelect={select}
            onDelete={deleteBlock}
            onMove={moveBlock}
          />
        ))}
      </div>

      <div className="border-t border-stone-200 p-2">
        {adding ? (
          <div className="grid grid-cols-2 gap-1 rounded-md border border-stone-200 bg-white p-2">
            {ADDABLE.map((t) => (
              <button
                key={t}
                onClick={() => {
                  addBlock(currentPage, emptyBlock(t), 'end')
                  setAdding(false)
                }}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-stone-700 hover:bg-amber-50"
              >
                {BLOCK_ICON[t]} {BLOCK_LABEL[t]}
              </button>
            ))}
            <button
              onClick={() => setAdding(false)}
              className="col-span-2 mt-1 rounded px-2 py-1 text-xs text-stone-400 hover:bg-stone-100"
            >Cancel</button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full">
            <Plus className="mr-1.5 h-4 w-4" /> Add block
          </Button>
        )}
      </div>
    </div>
  )
}

function BlockRow({
  block, path, depth, selectedPath, pathEq, onSelect, onDelete, onMove,
}: {
  block: Block
  path: BlockPath
  depth: number
  selectedPath: BlockPath | null
  pathEq: (a: BlockPath | null, b: BlockPath) => boolean
  onSelect: (p: BlockPath | null) => void
  onDelete: (p: BlockPath) => void
  onMove: (p: BlockPath, dir: 'up' | 'down') => void
}) {
  const selected = pathEq(selectedPath, path)
  const snippet = blockSnippet(block)
  const hasChildren = block.type === 'question' && block.children.length > 0

  return (
    <div>
      <div
        onClick={() => onSelect(selected ? null : path)}
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition',
          selected ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'text-stone-700 hover:bg-stone-100',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <span className="shrink-0 text-stone-400">{BLOCK_ICON[block.type]}</span>
        <span className="flex-1 truncate text-xs">{snippet}</span>
        <span className="hidden shrink-0 gap-0.5 group-hover:flex">
          <IconBtn title="Up" onClick={(e) => { e.stopPropagation(); onMove(path, 'up') }}><ChevronUp className="h-3 w-3" /></IconBtn>
          <IconBtn title="Down" onClick={(e) => { e.stopPropagation(); onMove(path, 'down') }}><ChevronDown className="h-3 w-3" /></IconBtn>
          <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(path) }}><Trash2 className="h-3 w-3" /></IconBtn>
        </span>
      </div>
      {hasChildren && (block as any).children.map((c: Block, ci: number) => (
        <BlockRow
          key={ci}
          block={c}
          path={[path[0], path[1], ci]}
          depth={depth + 1}
          selectedPath={selectedPath}
          pathEq={pathEq}
          onSelect={onSelect}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"
    >{children}</button>
  )
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
}

function blockSnippet(block: Block): string {
  switch (block.type) {
    case 'title': return stripHtml(block.html) || 'Title'
    case 'heading': return `${stripHtml(block.html) || 'Heading'}`
    case 'paragraph': return stripHtml(block.html).slice(0, 60) || 'Paragraph'
    case 'question': return block.number !== undefined ? `Q${block.number}` : 'Question'
    case 'list': return `${block.listType} · ${block.items.length} items`
    case 'callout': return `${block.calloutType}${block.title ? ` · ${block.title}` : ''}`
    case 'definition': return `def: ${block.term}`
    case 'quote': return block.cite ? `quote · ${block.cite}` : 'Quote'
    case 'divider': return `divider (${block.style})`
    case 'spacer': return `spacer ${block.height}px`
    case 'code': return `code${block.language ? ` · ${block.language}` : ''}`
    case 'table': return block.caption ? `table · ${block.caption}` : 'Table'
    case 'image': return block.alt ? `img · ${block.alt}` : 'Image'
    case 'diagram': return `${block.diagramType} diagram`
  }
}

// keep FileText referenced (used in icons map fallback)
void FileText

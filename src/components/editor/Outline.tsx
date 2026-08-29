// NoteForge — editor outline (§12): page + block tree, selection, reorder, add.
// Now with @dnd-kit drag-and-drop reordering + duplicate-block action.
'use client'

import { useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore, emptyBlock, type BlockPath } from '@/lib/store/editor-store'
import type { Block } from '@/lib/note-format/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Heading1, Pilcrow, List, HelpCircle,
  MessageSquareQuote, StickyNote, Quote, Minus, Square, Code2, Table, Image as ImageIcon,
  Spline, Type, Layers, GripVertical, Copy, WrapText, Search, X, FilePlus, CopyPlus,
} from 'lucide-react'
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuLabel,
} from '@/components/ui/context-menu'

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
  const reorderBlock = useEditorStore((s) => s.reorderBlock)
  const duplicateBlock = useEditorStore((s) => s.duplicateBlock)
  const wrapInQuestion = useEditorStore((s) => s.wrapInQuestion)
  const addPage = useEditorStore((s) => s.addPage)
  const deletePage = useEditorStore((s) => s.deletePage)
  const duplicatePage = useEditorStore((s) => s.duplicatePage)
  const [adding, setAdding] = useState(false)
  const [filter, setFilter] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!doc) return null
  const page = doc.pages[currentPage]
  if (!page) return null

  const pathEq = (a: BlockPath | null, b: BlockPath): boolean => {
    if (!a) return false
    return a.length === b.length && a.every((v, i) => v === b[i])
  }

  const blockIds = page.blocks.map((_, i) => `block-${i}`)

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const fromIndex = Number(String(active.id).replace('block-', ''))
    const toIndex = Number(String(over.id).replace('block-', ''))
    reorderBlock([currentPage, fromIndex], toIndex)
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
        <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
          {doc.pages.map((p, i) => (
            <ContextMenu key={i}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => setCurrentPage(i)}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium transition',
                    i === currentPage ? 'bg-amber-100 text-amber-900' : 'text-stone-500 hover:bg-stone-200/60',
                  )}
                >
                  P{p.page}
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuLabel className="text-xs text-stone-400">Page {p.page}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => duplicatePage(i)}>
                  <CopyPlus className="mr-2 h-4 w-4" /> Duplicate page
                </ContextMenuItem>
                {doc.pages.length > 1 && (
                  <ContextMenuItem onClick={() => deletePage(i)} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete page
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          ))}
          <button
            onClick={() => addPage()}
            title="Add a new page"
            className="rounded-md px-1.5 py-1 text-xs text-stone-400 transition hover:bg-amber-100 hover:text-amber-700"
          >
            <FilePlus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {doc.pages.length === 1 && (
        <div className="flex items-center gap-1 px-3 pb-2">
          <button
            onClick={() => addPage()}
            title="Add a new page"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-stone-400 transition hover:bg-amber-100 hover:text-amber-700"
          >
            <FilePlus className="h-3.5 w-3.5" /> Add page
          </button>
        </div>
      )}

      {/* Block search filter */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter blocks…"
            className="h-7 w-full rounded-md border border-stone-200 bg-white pl-7 pr-2 text-xs text-stone-700 placeholder:text-stone-400 focus:border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-300 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
            aria-label="Filter blocks"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
              aria-label="Clear filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2 pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
            {page.blocks.map((b, i) => {
              // When filtering, hide blocks that don't match.
              if (filter) {
                const snippet = blockSnippet(b).toLowerCase()
                const childMatch = b.type === 'question' && b.children.some((c: Block) =>
                  blockSnippet(c).toLowerCase().includes(filter.toLowerCase())
                )
                if (!snippet.includes(filter.toLowerCase()) && !childMatch) return null
              }
              return (
                <SortableBlockRow
                  key={`block-${i}`}
                  id={`block-${i}`}
                  block={b}
                  path={[currentPage, i]}
                  depth={0}
                  selectedPath={selectedPath}
                  pathEq={pathEq}
                  onSelect={select}
                  onDelete={deleteBlock}
                  onMove={moveBlock}
                  onDuplicate={duplicateBlock}
                  onWrapInQuestion={wrapInQuestion}
                />
              )
            })}
          </SortableContext>
        </DndContext>
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

function SortableBlockRow(props: {
  id: string
  block: Block
  path: BlockPath
  depth: number
  selectedPath: BlockPath | null
  pathEq: (a: BlockPath | null, b: BlockPath) => boolean
  onSelect: (p: BlockPath | null) => void
  onDelete: (p: BlockPath) => void
  onMove: (p: BlockPath, dir: 'up' | 'down') => void
  onDuplicate: (p: BlockPath) => void
  onWrapInQuestion: (p: BlockPath) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <BlockRowInner
        {...props}
        dragHandle={(
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-stone-300 hover:text-stone-500 active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      />
    </div>
  )
}

function BlockRowInner({
  block, path, depth, selectedPath, pathEq, onSelect, onDelete, onMove, onDuplicate, onWrapInQuestion, dragHandle,
}: {
  block: Block
  path: BlockPath
  depth: number
  selectedPath: BlockPath | null
  pathEq: (a: BlockPath | null, b: BlockPath) => boolean
  onSelect: (p: BlockPath | null) => void
  onDelete: (p: BlockPath) => void
  onMove: (p: BlockPath, dir: 'up' | 'down') => void
  onDuplicate: (p: BlockPath) => void
  onWrapInQuestion: (p: BlockPath) => void
  dragHandle: React.ReactNode
}) {
  const selected = pathEq(selectedPath, path)
  const snippet = blockSnippet(block)
  const hasChildren = block.type === 'question' && block.children.length > 0
  const isTopLevel = path.length === 2
  const canWrap = isTopLevel && block.type !== 'question'

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={() => onSelect(selected ? null : path)}
            className={cn(
              'group flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition',
              selected ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'text-stone-700 hover:bg-stone-100',
            )}
            style={{ paddingLeft: 8 + depth * 12 }}
          >
            <span className="shrink-0 opacity-30 transition group-hover:opacity-100">{dragHandle}</span>
            <span className="shrink-0 text-stone-400">{BLOCK_ICON[block.type]}</span>
            <span className="flex-1 truncate text-xs">{snippet}</span>
            <span className="hidden shrink-0 gap-0.5 group-hover:flex">
              <IconBtn title="Duplicate" onClick={(e) => { e.stopPropagation(); onDuplicate(path) }}><Copy className="h-3 w-3" /></IconBtn>
              <IconBtn title="Up" onClick={(e) => { e.stopPropagation(); onMove(path, 'up') }}><ChevronUp className="h-3 w-3" /></IconBtn>
              <IconBtn title="Down" onClick={(e) => { e.stopPropagation(); onMove(path, 'down') }}><ChevronDown className="h-3 w-3" /></IconBtn>
              <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(path) }}><Trash2 className="h-3 w-3" /></IconBtn>
            </span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuLabel className="text-xs text-stone-400">{BLOCK_LABEL[block.type]} · {snippet.slice(0, 30)}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDuplicate(path)}>
            <Copy className="mr-2 h-4 w-4" /> Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onMove(path, 'up')}>
            <ChevronUp className="mr-2 h-4 w-4" /> Move up
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onMove(path, 'down')}>
            <ChevronDown className="mr-2 h-4 w-4" /> Move down
          </ContextMenuItem>
          {canWrap && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onWrapInQuestion(path)}>
                <WrapText className="mr-2 h-4 w-4" /> Wrap in question
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDelete(path)} className="text-rose-600 focus:text-rose-700 focus:bg-rose-50">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {hasChildren && (block as any).children.map((c: Block, ci: number) => (
        <BlockRowInner
          key={ci}
          block={c}
          path={[path[0], path[1], ci]}
          depth={depth + 1}
          selectedPath={selectedPath}
          pathEq={pathEq}
          onSelect={onSelect}
          onDelete={onDelete}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onWrapInQuestion={onWrapInQuestion}
          dragHandle={<span className="hidden"><GripVertical className="h-3.5 w-3.5" /></span>}
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

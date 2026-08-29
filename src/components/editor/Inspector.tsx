// NoteForge — editor inspector (§12): per-block property editor.
'use client'

import Link from 'next/link'
import { useEditorStore, type BlockPath } from '@/lib/store/editor-store'
import type { Block, Align, CalloutType, DividerStyle, HeadingLevel, ListType, DiagramType } from '@/lib/note-format/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Eye, History, Globe, MousePointerClick } from 'lucide-react'

export interface InspectorProps {
  documentId: string
  selectedBlock: Block | null
  selectedPath: BlockPath | null
  pageBlocks: Block[]
}

export function Inspector({ documentId, selectedBlock, selectedPath }: InspectorProps) {
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const replaceBlock = useEditorStore((s) => s.replaceBlock)
  const doc = useEditorStore((s) => s.doc)
  const currentPage = useEditorStore((s) => s.currentPage)
  const updatePageMeta = useEditorStore((s) => s.updatePageMeta)

  if (!selectedBlock || !selectedPath) {
    // ── No block selected: show page settings + quick links ───────────
    const page = doc?.pages[currentPage]
    return (
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-3">
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Page Settings
            </span>
            <code className="ml-2 text-xs text-stone-400">P{page?.page ?? currentPage + 1}</code>
          </div>
          {page && (
            <div className="space-y-4">
              <Field label="Page width (px)">
                <Input
                  type="number"
                  value={page.width}
                  onChange={(e) => updatePageMeta(currentPage, { width: Number(e.target.value) || page.width })}
                  className="h-8"
                />
              </Field>
              <Field label="Page height (px)">
                <Input
                  type="number"
                  value={page.height}
                  onChange={(e) => updatePageMeta(currentPage, { height: Number(e.target.value) || page.height })}
                  className="h-8"
                />
              </Field>
              <Field label="Background color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={page.background}
                    onChange={(e) => updatePageMeta(currentPage, { background: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded border border-stone-200"
                    aria-label="Background color picker"
                  />
                  <Input
                    value={page.background}
                    onChange={(e) => updatePageMeta(currentPage, { background: e.target.value })}
                    className="h-8 flex-1 font-mono text-xs"
                  />
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => updatePageMeta(currentPage, { width: 900, height: 1270, background: '#ffffff' })}
                >
                  A4 Portrait
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => updatePageMeta(currentPage, { width: 1270, height: 900, background: '#ffffff' })}
                >
                  A4 Landscape
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => updatePageMeta(currentPage, { width: 1080, height: 1350, background: '#fdf8ec' })}
                >
                  Note (4:5)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => updatePageMeta(currentPage, { width: 1024, height: 1400, background: '#fdf8ec' })}
                >
                  Study Card
                </Button>
              </div>
            </div>
          )}
          <div className="mt-6 border-t border-stone-200 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Quick links</p>
            <div className="space-y-2">
              <QuickLink href={`/documents/${documentId}/review`} icon={<Eye className="h-4 w-4" />}>Review &amp; warnings</QuickLink>
              <QuickLink href={`/documents/${documentId}/versions`} icon={<History className="h-4 w-4" />}>Version history</QuickLink>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const b = selectedBlock
  const path = selectedPath

  const set = (patch: Partial<Block>) => updateBlock(path, patch as any)

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-3">
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-800">
            {b.type}
          </span>
          <code className="ml-2 text-xs text-stone-400">{path.join('.')}</code>
        </div>

        <div className="space-y-4">
          {/* Text / HTML fields */}
          {(b.type === 'title' || b.type === 'heading' || b.type === 'paragraph' || b.type === 'quote' || b.type === 'definition' || b.type === 'callout') && 'html' in b && (
            <Field label="Rich text (HTML)">
              <Textarea
                value={(b as any).html}
                onChange={(e) => set({ html: e.target.value } as any)}
                className="min-h-[80px] font-mono text-xs"
              />
            </Field>
          )}

          {b.type === 'definition' && (
            <Field label="Term">
              <Input value={b.term} onChange={(e) => set({ term: e.target.value } as any)} />
            </Field>
          )}

          {b.type === 'quote' && (
            <Field label="Cite">
              <Input value={b.cite ?? ''} onChange={(e) => set({ cite: e.target.value } as any)} />
            </Field>
          )}

          {/* Align */}
          {(b.type === 'title' || b.type === 'heading' || b.type === 'paragraph') && (
            <Field label="Alignment">
              <Select value={b.align ?? 'left'} onValueChange={(v) => set({ align: (v === 'left' ? undefined : v) as Align } as any)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Heading level */}
          {b.type === 'heading' && (
            <Field label="Level">
              <Select value={String(b.level)} onValueChange={(v) => set({ level: Number(v) as HeadingLevel } as any)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">H2</SelectItem>
                  <SelectItem value="3">H3</SelectItem>
                  <SelectItem value="4">H4</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}

          {/* Question number */}
          {b.type === 'question' && (
            <Field label="Question number">
              <Input
                type="number"
                value={b.number ?? ''}
                onChange={(e) => set({ number: e.target.value === '' ? undefined : Number(e.target.value) } as any)}
              />
            </Field>
          )}

          {/* Callout */}
          {b.type === 'callout' && (
            <>
              <Field label="Callout type">
                <Select value={b.calloutType} onValueChange={(v) => set({ calloutType: v as CalloutType } as any)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['tip', 'info', 'warning', 'danger', 'note'] as CalloutType[]).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Title">
                <Input value={b.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined } as any)} />
              </Field>
              <Field label="Absolute position (x / y / w / z) — optional">
                <div className="grid grid-cols-4 gap-2">
                  <NumInput label="x" value={b.x} onChange={(v) => set({ x: v } as any)} />
                  <NumInput label="y" value={b.y} onChange={(v) => set({ y: v } as any)} />
                  <NumInput label="w" value={b.w} onChange={(v) => set({ w: v } as any)} />
                  <NumInput label="z" value={b.z} onChange={(v) => set({ z: v } as any)} />
                </div>
              </Field>
            </>
          )}

          {/* List */}
          {b.type === 'list' && (
            <>
              <Field label="List type">
                <Select value={b.listType} onValueChange={(v) => set({ listType: v as ListType } as any)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bullet">Bullet</SelectItem>
                    <SelectItem value="numbered">Numbered</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {b.listType === 'numbered' && (
                <Field label="Start at">
                  <Input type="number" value={b.start ?? 1} onChange={(e) => set({ start: Number(e.target.value) } as any)} />
                </Field>
              )}
              <Field label={`Items (${b.items.length})`}>
                <div className="space-y-2">
                  {b.items.map((it, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      {b.listType === 'check' && (
                        <Button
                          variant="outline" size="sm" className="mt-0.5 h-7 w-7 p-0"
                          onClick={() => {
                            const items = [...b.items]; items[i] = { ...items[i], checked: !items[i].checked }
                            set({ items } as any)
                          }}
                          title={it.checked ? 'Checked' : 'Unchecked'}
                        >{it.checked ? '☑' : '☐'}</Button>
                      )}
                      <Textarea
                        value={it.html}
                        onChange={(e) => {
                          const items = [...b.items]; items[i] = { ...items[i], html: e.target.value }
                          set({ items } as any)
                        }}
                        className="min-h-[40px] flex-1 font-mono text-xs"
                      />
                      <Button
                        variant="ghost" size="sm" className="mt-0.5 h-7 w-7 p-0 text-stone-400 hover:text-rose-600"
                        onClick={() => { const items = b.items.filter((_, j) => j !== i); set({ items } as any) }}
                      ><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                  <Button
                    variant="outline" size="sm" className="w-full"
                    onClick={() => set({ items: [...b.items, { html: 'new item', checked: b.listType === 'check' ? false : undefined }] } as any)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
                  </Button>
                </div>
              </Field>
            </>
          )}

          {/* Divider / Spacer */}
          {b.type === 'divider' && (
            <Field label="Style">
              <Select value={b.style ?? 'solid'} onValueChange={(v) => set({ style: v as DividerStyle } as any)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">solid</SelectItem>
                  <SelectItem value="dashed">dashed</SelectItem>
                  <SelectItem value="dotted">dotted</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          {b.type === 'spacer' && (
            <Field label="Height (px)">
              <Input type="number" value={b.height} onChange={(e) => set({ height: Number(e.target.value) } as any)} />
            </Field>
          )}

          {/* Code */}
          {b.type === 'code' && (
            <>
              <Field label="Language">
                <Input value={b.language ?? ''} onChange={(e) => set({ language: e.target.value || undefined } as any)} placeholder="sql, js, …" />
              </Field>
              <Field label="Code">
                <Textarea value={b.text} onChange={(e) => set({ text: e.target.value } as any)} className="min-h-[140px] font-mono text-xs" />
              </Field>
            </>
          )}

          {/* Table */}
          {b.type === 'table' && (
            <>
              <Field label="Caption">
                <Input value={b.caption ?? ''} onChange={(e) => set({ caption: e.target.value || undefined } as any)} />
              </Field>
              <Field label="Table HTML (inner)">
                <Textarea value={b.html} onChange={(e) => set({ html: e.target.value } as any)} className="min-h-[120px] font-mono text-xs" />
              </Field>
            </>
          )}

          {/* Image */}
          {b.type === 'image' && (
            <>
              <Field label="Src (data: URI or relative)">
                <Textarea value={b.src ?? ''} onChange={(e) => set({ src: e.target.value || undefined } as any)} className="min-h-[60px] font-mono text-xs" />
              </Field>
              <Field label="Alt">
                <Input value={b.alt ?? ''} onChange={(e) => set({ alt: e.target.value || undefined } as any)} />
              </Field>
              <Field label="Caption">
                <Input value={b.caption ?? ''} onChange={(e) => set({ caption: e.target.value || undefined } as any)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="width" value={b.width} onChange={(v) => set({ width: v } as any)} />
                <NumInput label="height" value={b.height} onChange={(v) => set({ height: v } as any)} />
              </div>
            </>
          )}

          {/* Diagram */}
          {b.type === 'diagram' && (
            <>
              <Field label="Diagram type">
                <Select value={b.diagramType} onValueChange={(v) => set({ diagramType: v as DiagramType } as any)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mermaid">mermaid</SelectItem>
                    <SelectItem value="svg">svg</SelectItem>
                    <SelectItem value="excalidraw">excalidraw</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Title">
                <Input value={b.title ?? ''} onChange={(e) => set({ title: e.target.value || undefined } as any)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <NumInput label="width" value={b.width} onChange={(v) => set({ width: v } as any)} />
                <NumInput label="height" value={b.height} onChange={(v) => set({ height: v } as any)} />
              </div>
              <Field label="Source">
                <Textarea value={b.source} onChange={(e) => set({ source: e.target.value } as any)} className="min-h-[140px] font-mono text-xs" />
              </Field>
            </>
          )}

          {/* Raw HTML */}
          {b.type === 'raw-html' && (
            <Field label="Raw HTML (preserves original design — divs, grids, SVGs, styles)">
              <Textarea
                value={b.html}
                onChange={(e) => set({ html: e.target.value } as any)}
                className="min-h-[240px] font-mono text-xs"
              />
            </Field>
          )}
        </div>

        <div className="mt-6 border-t border-stone-200 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Quick links</p>
          <div className="space-y-2">
            <QuickLink href={`/documents/${documentId}/review`} icon={<Eye className="h-4 w-4" />}>Review &amp; warnings</QuickLink>
            <QuickLink href={`/documents/${documentId}/versions`} icon={<History className="h-4 w-4" />}>Version history</QuickLink>
          </div>
        </div>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Inspector</h3>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-600">{label}</Label>
      {children}
    </div>
  )
}

function NumInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] uppercase tracking-wide text-stone-400">{label}</span>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="h-8"
      />
    </div>
  )
}

function QuickLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 transition hover:border-amber-300 hover:bg-amber-50">
      <span className="text-amber-600">{icon}</span>
      {children}
    </Link>
  )
}

// keep Globe referenced for the public link hint; not used in selection mode
void Globe

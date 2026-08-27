// NoteForge — parser (§5, §6, §10, Appendix A)
// Server-side. Uses linkedom to parse `.note.html`, sanitizes, and produces
// { model, warnings }. Runs in the import pipeline (API route).
//
// SVG diagrams are pre-extracted from the *raw* HTML before linkedom parses it,
// because linkedom parses as HTML and lowercases tag names — which would corrupt
// case-sensitive SVG (`linearGradient` -> `lineargradient`). The raw SVG string
// is then run through a case-preserving string sanitizer.

import { parseHTML } from 'linkedom'
import type {
  Block, CalloutType, DiagramType, DividerStyle, HeadingLevel, ListType,
  NoteDocument, NotePage, ParseResult, Warning,
} from './types'
import { WarningCode } from './types'
import { sanitizeInlineChildren, sanitizeSvgString, sanitizeTable, sanitizeImageSrc, hasBadScheme } from './sanitize'
import { sanitizeStylesheet, sanitizeInlineStyle } from './css'

const BLOCK_TAGS = new Set([
  'note-title', 'note-heading', 'note-paragraph', 'note-question', 'note-list',
  'note-callout', 'note-definition', 'note-quote', 'note-divider', 'note-spacer',
  'note-code', 'note-table', 'note-image', 'note-diagram',
])

const DANGEROUS_CONTAINERS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'template', 'style',
])

interface ParseCtx {
  svgSources: string[]   // raw (case-preserved) SVG strings, in document order
  svgIdx: number          // mutable cursor consumed in document order
}

/** Parse a `.note.html` string into { model, warnings }. */
export function parseNoteHtml(html: string): ParseResult {
  const warnings: Warning[] = []
  const svgSources = extractSvgSources(html)
  const ctx: ParseCtx = { svgSources, svgIdx: 0 }
  const { document } = parseHTML(html)

  // 1. Capture head metadata.
  let generator: string | undefined
  let formatDetected = false
  for (const m of Array.from(document.querySelectorAll('meta'))) {
    const name = (m.getAttribute('name') || '').toLowerCase()
    if (name === 'note-format') formatDetected = true
    if (name === 'note-generator') generator = m.getAttribute('content') || undefined
  }
  if (!formatDetected) {
    warnings.push({ code: WarningCode.STRUCTURAL_ERROR, level: 'warn', message: `Missing <meta name="note-format">; importing anyway`, path: 'head' })
  }

  // 2. Collect & sanitize head <style> blocks.
  let css = ''
  const head = document.querySelector('head')
  if (head) {
    for (const style of Array.from(head.querySelectorAll('style'))) {
      css += '\n' + sanitizeStylesheet(style.textContent || '', warnings, 'css')
    }
  }

  // 3. Find the document element.
  const docEl = document.querySelector('note-document')
  if (!docEl) {
    warnings.push({ code: WarningCode.STRUCTURAL_ERROR, level: 'error', message: `No <note-document> root found`, path: 'document' })
    return { model: { title: 'Untitled', version: '1', css: css.trim(), pages: [] }, warnings }
  }

  const titleAttr = docEl.getAttribute('data-title') || undefined
  const versionAttr = docEl.getAttribute('data-version') || '1'
  const headTitle = document.querySelector('title')?.textContent || undefined
  const title = titleAttr || headTitle || 'Untitled'

  // 4. Walk pages.
  const pages: NotePage[] = []
  let pageIndex = 0
  for (const pageEl of Array.from(docEl.children)) {
    const tag = pageEl.tagName.toLowerCase()
    if (tag !== 'note-page') {
      if (DANGEROUS_CONTAINERS.has(tag)) {
        warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <${tag}> inside <note-document>`, path: `document` })
        continue
      }
      warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Unwrapped unknown element <${tag}> under <note-document>`, path: `document` })
      for (const inner of Array.from(pageEl.querySelectorAll('note-page'))) {
        pages.push(parsePage(inner, warnings, pages.length, ctx))
      }
      continue
    }
    pages.push(parsePage(pageEl, warnings, pageIndex, ctx))
    pageIndex++
  }

  if (pages.length === 0) {
    warnings.push({ code: WarningCode.STRUCTURAL_ERROR, level: 'error', message: `Document has no pages`, path: 'document' })
  }

  const model: NoteDocument = { title, version: versionAttr, generator, css: css.trim(), pages }
  return { model, warnings }
}

function parsePage(el: Element, warnings: Warning[], pageIndex: number, ctx: ParseCtx): NotePage {
  const page = parseInt(el.getAttribute('data-page') || String(pageIndex + 1), 10) || pageIndex + 1
  const width = parseInt(el.getAttribute('data-width') || '900', 10) || 900
  const height = parseInt(el.getAttribute('data-height') || '1270', 10) || 1270
  const background = el.getAttribute('data-background') || '#ffffff'

  const blocks: Block[] = []
  let blockIdx = 0
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 8 /* COMMENT */) continue
    if (child.nodeType === 3 /* TEXT */) {
      const txt = (child.textContent || '').trim()
      if (!txt) continue
      warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Dropped stray text in page`, path: `pages[${pageIndex}]` })
      continue
    }
    if (child.nodeType !== 1) continue
    const parsed = parseBlock(child as Element, warnings, `pages[${pageIndex}].blocks[${blockIdx}]`, ctx)
    if (parsed) {
      blocks.push(parsed)
      blockIdx++
    }
  }

  return { page, width, height, background, blocks }
}

function parseBlock(el: Element, warnings: Warning[], path: string, ctx: ParseCtx): Block | null {
  const tag = el.tagName.toLowerCase()

  if (DANGEROUS_CONTAINERS.has(tag)) {
    warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <${tag}> with subtree`, path })
    return null
  }

  switch (tag) {
    case 'note-title':
      return {
        type: 'title',
        align: parseAlign(el.getAttribute('data-align')),
        html: sanitizeInlineChildren(el, warnings, path),
        classes: parseClasses(el.getAttribute('class')),
      }
    case 'note-heading': {
      const lvl = parseInt(el.getAttribute('level') || '2', 10)
      const level = (lvl === 3 || lvl === 4 ? lvl : 2) as HeadingLevel
      return {
        type: 'heading',
        level,
        align: parseAlign(el.getAttribute('data-align')),
        html: sanitizeInlineChildren(el, warnings, path),
        classes: parseClasses(el.getAttribute('class')),
      }
    }
    case 'note-paragraph': {
      const style = el.getAttribute('style')
      return {
        type: 'paragraph',
        align: parseAlign(el.getAttribute('data-align')),
        html: sanitizeInlineChildren(el, warnings, path),
        classes: parseClasses(el.getAttribute('class')),
        style: style ? sanitizeInlineStyle(style, warnings, path) || undefined : undefined,
      }
    }
    case 'note-question': {
      const numberAttr = el.getAttribute('number')
      const number = numberAttr ? parseInt(numberAttr, 10) : undefined
      const children: Block[] = []
      let idx = 0
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType === 8) continue
        if (c.nodeType === 3) {
          if (!(c.textContent || '').trim()) continue
          warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Dropped stray text in question`, path })
          continue
        }
        if (c.nodeType !== 1) continue
        const sub = parseBlock(c as Element, warnings, `${path}.children[${idx}]`, ctx)
        if (sub) { children.push(sub); idx++ }
      }
      return {
        type: 'question',
        number: Number.isFinite(number) ? number : undefined,
        classes: parseClasses(el.getAttribute('class')),
        children,
      }
    }
    case 'note-list': {
      const type = (el.getAttribute('type') || 'bullet') as ListType
      const listType: ListType = (['bullet', 'numbered', 'check'] as const).includes(type as any) ? type : 'bullet'
      const startAttr = el.getAttribute('start')
      const start = startAttr ? parseInt(startAttr, 10) : undefined
      const items = []
      let iidx = 0
      for (const c of Array.from(el.children)) {
        if (c.tagName.toLowerCase() !== 'note-item') {
          warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Dropped <${c.tagName.toLowerCase()}> inside list`, path })
          continue
        }
        items.push({
          html: sanitizeInlineChildren(c, warnings, `${path}.items[${iidx}]`),
          checked: listType === 'check' ? c.getAttribute('data-checked') === 'true' : undefined,
        })
        iidx++
      }
      return {
        type: 'list',
        listType,
        start: listType === 'numbered' ? (Number.isFinite(start) ? start : 1) : undefined,
        items,
        classes: parseClasses(el.getAttribute('class')),
      }
    }
    case 'note-callout': {
      const calloutType = ((el.getAttribute('type') || 'note') as CalloutType)
      const title = el.getAttribute('title') || undefined
      const x = parseOptionalInt(el.getAttribute('data-x'))
      const y = parseOptionalInt(el.getAttribute('data-y'))
      const w = parseOptionalInt(el.getAttribute('data-w'))
      const z = parseOptionalInt(el.getAttribute('data-z'))
      const hasBlockChild = Array.from(el.children).some(c => BLOCK_TAGS.has(c.tagName.toLowerCase()))
      if (hasBlockChild) {
        const children: Block[] = []
        let idx = 0
        for (const c of Array.from(el.childNodes)) {
          if (c.nodeType === 8) continue
          if (c.nodeType === 3) {
            if (!(c.textContent || '').trim()) continue
            children.push({ type: 'paragraph', html: escapeForModel(c.textContent || ''), classes: [] })
            idx++
            continue
          }
          if (c.nodeType !== 1) continue
          const sub = parseBlock(c as Element, warnings, `${path}.children[${idx}]`, ctx)
          if (sub) { children.push(sub); idx++ }
        }
        return {
          type: 'callout', calloutType, title, children,
          classes: parseClasses(el.getAttribute('class')), x, y, w, z,
        }
      }
      return {
        type: 'callout', calloutType, title,
        html: sanitizeInlineChildren(el, warnings, path),
        classes: parseClasses(el.getAttribute('class')), x, y, w, z,
      }
    }
    case 'note-definition':
      return {
        type: 'definition',
        term: el.getAttribute('term') || '',
        html: sanitizeInlineChildren(el, warnings, path),
        classes: parseClasses(el.getAttribute('class')),
      }
    case 'note-quote':
      return {
        type: 'quote',
        cite: el.getAttribute('data-cite') || undefined,
        html: sanitizeInlineChildren(el, warnings, path),
        classes: parseClasses(el.getAttribute('class')),
      }
    case 'note-divider': {
      const style = (el.getAttribute('style') || 'solid') as DividerStyle
      return { type: 'divider', style: (['solid', 'dashed', 'dotted'] as const).includes(style as any) ? style : 'solid' }
    }
    case 'note-spacer':
      return { type: 'spacer', height: parseInt(el.getAttribute('height') || '16', 10) || 16 }
    case 'note-code':
      return { type: 'code', language: el.getAttribute('language') || undefined, text: el.textContent || '' }
    case 'note-table': {
      const caption = el.getAttribute('data-caption') || undefined
      const tableEl = el.querySelector('table')
      if (!tableEl) {
        warnings.push({ code: WarningCode.STRUCTURAL_ERROR, level: 'warn', message: `<note-table> has no <table> child`, path })
        return null
      }
      return {
        type: 'table', caption,
        html: sanitizeTable(tableEl, warnings, path),
        classes: parseClasses(el.getAttribute('class')),
      }
    }
    case 'note-image': {
      return {
        type: 'image',
        src: sanitizeImageSrc(el.getAttribute('src'), warnings, path) || undefined,
        alt: el.getAttribute('alt') || undefined,
        width: parseOptionalInt(el.getAttribute('width')) ?? parseOptionalInt(el.getAttribute('data-width')),
        height: parseOptionalInt(el.getAttribute('height')) ?? parseOptionalInt(el.getAttribute('data-height')),
        caption: el.getAttribute('data-caption') || undefined,
        classes: parseClasses(el.getAttribute('class')),
      }
    }
    case 'note-diagram': {
      const diagramType = (el.getAttribute('type') || 'mermaid') as DiagramType
      const dt: DiagramType = (['mermaid', 'svg', 'excalidraw'] as const).includes(diagramType as any) ? diagramType : 'mermaid'
      const width = parseOptionalInt(el.getAttribute('data-width'))
      const height = parseOptionalInt(el.getAttribute('data-height'))
      const dtitle = el.getAttribute('data-title') || undefined
      let source = ''
      if (dt === 'svg') {
        // consume pre-extracted case-preserved raw SVG (document order)
        if (ctx.svgIdx < ctx.svgSources.length) {
          source = sanitizeSvgString(ctx.svgSources[ctx.svgIdx++], warnings, path)
        } else {
          const svg = el.querySelector('svg')
          if (svg) source = sanitizeSvgString((svg as unknown as { outerHTML: string }).outerHTML, warnings, path)
        }
      } else {
        source = (el.textContent || '').trim()
      }
      return {
        type: 'diagram', diagramType: dt, source, width, height, title: dtitle,
        classes: parseClasses(el.getAttribute('class')),
      }
    }
    default:
      warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Unwrapped unknown block <${tag}>`, path })
      return null
  }
}

/** Extract raw (case-preserved) `<svg>…</svg>` strings from `<note-diagram type="svg">` blocks. */
function extractSvgSources(html: string): string[] {
  const out: string[] = []
  const re = /<note-diagram\b[^>]*\btype="svg"[^>]*>([\s\S]*?)<\/note-diagram>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const inner = m[1]
    const start = inner.indexOf('<svg')
    const end = inner.lastIndexOf('</svg>')
    if (start >= 0 && end > start) {
      out.push(inner.slice(start, end + '</svg>'.length))
    }
  }
  return out
}

function parseAlign(v: string | null): 'left' | 'center' | 'right' | undefined {
  if (v === 'left' || v === 'center' || v === 'right') return v
  return undefined
}

function parseClasses(v: string | null): string[] {
  if (!v) return []
  return v.split(/\s+/).filter(Boolean)
}

function parseOptionalInt(v: string | null): number | undefined {
  if (!v) return undefined
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

function escapeForModel(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export { hasBadScheme }

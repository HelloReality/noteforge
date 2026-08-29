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
import { sanitizeInlineChildren, sanitizeSvgString, sanitizeTable, sanitizeImageSrc, sanitizeRawHtml, hasBadScheme } from './sanitize'
import { sanitizeStylesheet, sanitizeInlineStyle } from './css'

const BLOCK_TAGS = new Set([
  'note-title', 'note-heading', 'note-paragraph', 'note-question', 'note-list',
  'note-callout', 'note-definition', 'note-quote', 'note-divider', 'note-spacer',
  'note-code', 'note-table', 'note-image', 'note-diagram', 'note-raw',
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
    // ── Fallback: auto-import plain HTML as a single-page note ──────────
    // If the file has no <note-document>, try to import the <body> content
    // by converting standard HTML tags (h1-h6, p, ul, blockquote, pre, table,
    // img, div) into the equivalent note-* blocks. This lets users import
    // existing HTML study notes without manually converting them.
    const body = document.querySelector('body')
    if (!body) {
      warnings.push({ code: WarningCode.STRUCTURAL_ERROR, level: 'error', message: `No <note-document> root and no <body> found`, path: 'document' })
      return { model: { title: 'Untitled', version: '1', css: css.trim(), pages: [] }, warnings }
    }
    warnings.push({
      code: WarningCode.STRUCTURAL_ERROR, level: 'warn',
      message: `No <note-document> root found; auto-converting plain HTML to a single-page note`,
      path: 'document',
    })
    const headTitle = document.querySelector('title')?.textContent || undefined
    const firstH1 = body.querySelector('h1')
    const autoTitle = headTitle || (firstH1 ? (firstH1.textContent || '').trim() : 'Imported Note')
    // Estimate the page width from the original .page div (if present),
    // otherwise default to 1024. Estimate height from the content — count
    // blocks and assign ~80px per block + 600px base so the whole page fits.
    const origPageDiv = body.querySelector('.page, [class*="page"]')
    const pageWidth = origPageDiv?.getAttribute('data-width') ?
      parseInt(origPageDiv.getAttribute('data-width')!, 10) || 1024 : 1024
    // Rough height estimate: each block ~80px + base 800px, capped at 4000px
    const blockCount = body.querySelectorAll('h1, h2, h3, p, ul, ol, blockquote, pre, table, img, hr, .q-block, .box, .diagram, .check-item').length
    const estimatedHeight = Math.min(4000, Math.max(1400, 800 + blockCount * 80))
    const page: NotePage = { page: 1, width: pageWidth, height: estimatedHeight, background: '#fdf8ec', blocks: [] }
    convertPlainHtmlToBlocks(body, page.blocks, warnings, 'document', ctx)
    const model: NoteDocument = { title: autoTitle, version: '1', generator, css: css.trim(), pages: [page] }
    return { model, warnings }
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

/**
 * Fallback: convert plain HTML children of an element (usually <body>) into
 * NoteForge note-* blocks. Standard HTML tags are mapped to their note-*
 * equivalents; complex divs (grids, boxes, diagrams) are preserved as
 * raw-html blocks so the original design is not lost.
 *
 * Special handling: if a div has the class "page" (common in study-note HTML)
 * or is a top-level wrapper, its children are promoted to the top level
 * rather than wrapped in a single question block.
 */
function convertPlainHtmlToBlocks(
  el: Element,
  out: Block[],
  warnings: Warning[],
  path: string,
  ctx: ParseCtx,
): void {
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 8 /* COMMENT */) continue
    if (child.nodeType === 3 /* TEXT */) {
      const txt = (child.textContent || '').trim()
      if (!txt) continue
      // Stray text → paragraph
      out.push({ type: 'paragraph', html: escapeForModel(txt), classes: [] })
      continue
    }
    if (child.nodeType !== 1) continue
    const childEl = child as Element
    const childTag = childEl.tagName.toLowerCase()

    // If this is a wrapper div (class="page" or similar), unwrap its children
    // to the top level rather than wrapping them in a question block.
    if (childTag === 'div' || childTag === 'section' || childTag === 'main' || childTag === 'article') {
      const classList = parseClasses(childEl.getAttribute('class'))
      const classStr = classList.join(' ').toLowerCase()
      const isWrapper = classList.some(c => /^(page|container|wrapper|content|main)$/i.test(c)) ||
                        classStr.includes('page') && !classStr.includes('q-block')

      if (isWrapper) {
        // Unwrap: process children at the top level
        convertPlainHtmlToBlocks(childEl, out, warnings, `${path}.blocks[${out.length}]`, ctx)
        continue
      }
    }

    const block = htmlElementToBlock(childEl, warnings, `${path}.blocks[${out.length}]`, ctx)
    if (block) out.push(block)
  }
}

/** Convert a single standard HTML element into a NoteForge block. */
function htmlElementToBlock(
  el: Element,
  warnings: Warning[],
  path: string,
  ctx: ParseCtx,
): Block | null {
  const tag = el.tagName.toLowerCase()

  // Dangerous containers are dropped entirely.
  if (DANGEROUS_CONTAINERS.has(tag)) {
    warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <${tag}> with subtree`, path })
    return null
  }

  // If it's already a note-* tag, use the native parser.
  if (BLOCK_TAGS.has(tag)) {
    return parseBlock(el, warnings, path, ctx)
  }

  switch (tag) {
    case 'h1':
      return { type: 'title', align: 'center', html: sanitizeInlineChildren(el, warnings, path), classes: parseClasses(el.getAttribute('class')) }
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const lvl = tag === 'h2' ? 2 : tag === 'h3' ? 3 : 4
      return { type: 'heading', level: lvl as HeadingLevel, html: sanitizeInlineChildren(el, warnings, path), classes: parseClasses(el.getAttribute('class')) }
    }
    case 'p':
      return { type: 'paragraph', html: sanitizeInlineChildren(el, warnings, path), classes: parseClasses(el.getAttribute('class')) }
    case 'ul':
    case 'ol': {
      const classList = parseClasses(el.getAttribute('class'))
      const isCheck = classList.some(c => c.includes('check'))
      const listType: ListType = tag === 'ol' ? 'numbered' : isCheck ? 'check' : 'bullet'
      const items: { html: string; checked?: boolean }[] = []
      let i = 0
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue
        items.push({
          html: sanitizeInlineChildren(li, warnings, `${path}.items[${i}]`),
          checked: listType === 'check' ? (li as Element).getAttribute('data-checked') === 'true' : undefined,
        })
        i++
      }
      return { type: 'list', listType, items, classes: classList }
    }
    case 'blockquote': {
      const cite = el.getAttribute('cite') || undefined
      return { type: 'quote', cite, html: sanitizeInlineChildren(el, warnings, path), classes: parseClasses(el.getAttribute('class')) }
    }
    case 'pre': {
      // <pre><code>...</code></pre> → code block
      const codeEl = el.querySelector('code')
      const text = (codeEl || el).textContent || ''
      const language = codeEl?.className?.match(/language-(\w+)/)?.[1] || 'text'
      return { type: 'code', language, text }
    }
    case 'table': {
      return { type: 'table', html: sanitizeTable(el as unknown as HTMLTableElement, warnings, path), classes: parseClasses(el.getAttribute('class')) }
    }
    case 'img': {
      const src = sanitizeImageSrc(el.getAttribute('src'), warnings, path) || undefined
      return {
        type: 'image', src,
        alt: el.getAttribute('alt') || undefined,
        width: parseOptionalInt(el.getAttribute('width')),
        height: parseOptionalInt(el.getAttribute('height')),
        classes: parseClasses(el.getAttribute('class')),
      }
    }
    case 'hr':
      return { type: 'divider', style: 'solid' }
    case 'svg':
      // Standalone SVG → note-diagram type="svg"
      return {
        type: 'diagram', diagramType: 'svg',
        source: sanitizeSvgString((el as unknown as { outerHTML: string }).outerHTML, warnings, path),
        classes: [],
      }
    case 'figure': {
      // <figure><img><figcaption> → image block with caption
      const img = el.querySelector('img')
      const figcaption = el.querySelector('figcaption')
      if (img) {
        return {
          type: 'image',
          src: sanitizeImageSrc(img.getAttribute('src'), warnings, path) || undefined,
          alt: img.getAttribute('alt') || undefined,
          caption: figcaption?.textContent?.trim() || undefined,
          classes: parseClasses(el.getAttribute('class')),
        }
      }
      // Fallback: unwrap figure children
      const blocks: Block[] = []
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType === 1) {
          const b = htmlElementToBlock(c as Element, warnings, path, ctx)
          if (b) blocks.push(b)
        }
      }
      return blocks[0] || null
    }
    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'span': {
      const classList = parseClasses(el.getAttribute('class'))
      const classStr = classList.join(' ').toLowerCase()

      // If it's a .q-block (question block in the user's HTML), unwrap children
      // to the top level. Each child becomes its own block — the heading, the
      // list, AND each box in the grid becomes a separately-selectable block.
      if (classList.some(c => c.toLowerCase().includes('q-block'))) {
        // Unwrap: process children at the top level (NOT wrapped in a question)
        // so each box/diagram/list is individually selectable in the outline.
        const children: Block[] = []
        for (const c of Array.from(el.childNodes)) {
          if (c.nodeType === 8) continue
          if (c.nodeType === 3) {
            const txt = (c.textContent || '').trim()
            if (!txt) continue
            children.push({ type: 'paragraph', html: escapeForModel(txt), classes: [] })
            continue
          }
          if (c.nodeType !== 1) continue
          const b = htmlElementToBlock(c as Element, warnings, `${path}.blocks[${children.length}]`, ctx)
          if (b) children.push(b)
        }
        // Return the children as a question group so they stay together but
        // each child is individually selectable.
        if (children.length > 0) {
          return { type: 'question', classes: classList, children }
        }
        return null
      }

      // ── If it's a .grid-2 or .grid-3-1, split into separate raw-html blocks ──
      // Each child box becomes its own individually-selectable raw-html block.
      if (classList.some(c => /^grid-(2|3-1)$/i.test(c))) {
        const gridChildren: Block[] = []
        for (const c of Array.from(el.children)) {
          if (c.nodeType !== 1) continue
          const childEl = c as Element
          // Each box in the grid → its own raw-html block
          const rawHtml = sanitizeRawHtml(childEl, warnings, `${path}.blocks[${gridChildren.length}]`)
          gridChildren.push({
            type: 'raw-html',
            html: rawHtml,
            classes: parseClasses(childEl.getAttribute('class')),
          })
        }
        if (gridChildren.length === 1) return gridChildren[0]
        if (gridChildren.length > 1) {
          // Wrap in a question so they stay grouped but are individually selectable
          return { type: 'question', classes: classList, children: gridChildren }
        }
        return null
      }

      // ── Preserve complex divs as raw-html blocks ──────────────────────
      const hasComplexChildren = el.querySelector('.grid-2, .grid-3-1, .box, .diagram, .node, .arrow, .check-item, .flow-caption, .code, .label-small, .top-bar, .q-head, svg, .box-title') !== null
      const isCallout = classList.some(c => /^(callout|box|tip|info|warning|warn|danger|note|alert)$/i.test(c)) ||
                        /\b(warning|tip|info|danger|note|alert|callout)\b/i.test(classStr)

      if (hasComplexChildren) {
        // Preserve as raw-html — the original design (grids, boxes, SVGs,
        // hand-drawn borders, rotations) is kept exactly.
        const rawHtml = sanitizeRawHtml(el, warnings, path)
        return {
          type: 'raw-html',
          html: rawHtml,
          classes: classList,
        }
      }

      if (isCallout) {
        let calloutType: CalloutType = 'note'
        if (/tip/i.test(classStr)) calloutType = 'tip'
        else if (/danger/i.test(classStr)) calloutType = 'danger'
        else if (/warn(ing)?/i.test(classStr)) calloutType = 'warning'
        else if (/info/i.test(classStr)) calloutType = 'info'
        const titleEl = el.querySelector('.box-title, .title, h1, h2, h3, h4, h5, h6')
        const title = titleEl ? (titleEl.textContent || '').trim() : undefined
        if (titleEl) {
          (titleEl as Element).textContent = ''
        }
        return {
          type: 'callout', calloutType, title,
          html: sanitizeInlineChildren(el, warnings, path),
          classes: classList,
        }
      }

      // Generic div with only simple children → unwrap
      const blocks: Block[] = []
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType === 8) continue
        if (c.nodeType === 3) {
          const txt = (c.textContent || '').trim()
          if (!txt) continue
          blocks.push({ type: 'paragraph', html: escapeForModel(txt), classes: [] })
          continue
        }
        if (c.nodeType !== 1) continue
        const b = htmlElementToBlock(c as Element, warnings, `${path}.blocks[${blocks.length}]`, ctx)
        if (b) blocks.push(b)
      }
      if (blocks.length === 1) return blocks[0]
      if (blocks.length > 1) return { type: 'question', classes: classList, children: blocks }
      return null
    }
    case 'dl': {
      // <dl><dt>Term</dt><dd>Definition</dd></dl> → definition block(s)
      const dts = Array.from(el.querySelectorAll('dt'))
      const dds = Array.from(el.querySelectorAll('dd'))
      if (dts.length > 0 && dds.length > 0) {
        return {
          type: 'definition',
          term: (dts[0].textContent || '').trim(),
          html: sanitizeInlineChildren(dds[0] as unknown as Element, warnings, path),
          classes: parseClasses(el.getAttribute('class')),
        }
      }
      return null
    }
    default:
      // Unknown tag: unwrap and try children
      warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Unwrapped unknown element <${tag}>`, path })
      const blocks: Block[] = []
      for (const c of Array.from(el.childNodes)) {
        if (c.nodeType === 8) continue
        if (c.nodeType === 3) {
          const txt = (c.textContent || '').trim()
          if (!txt) continue
          blocks.push({ type: 'paragraph', html: escapeForModel(txt), classes: [] })
          continue
        }
        if (c.nodeType !== 1) continue
        const b = htmlElementToBlock(c as Element, warnings, `${path}.blocks[${blocks.length}]`, ctx)
        if (b) blocks.push(b)
      }
      if (blocks.length === 1) return blocks[0]
      if (blocks.length > 1) return { type: 'question', children: blocks, classes: [] }
      return null
  }
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
    case 'note-raw': {
      // <note-raw> preserves arbitrary HTML content (divs, grids, boxes, SVGs,
      // inline styles) exactly as authored. The inner HTML is sanitized
      // (dangerous tags/attrs removed) but the visual structure is preserved.
      // This is the "escape hatch" for rich layouts that don't fit the
      // semantic note-* blocks.
      const rawHtml = sanitizeRawHtml(el, warnings, path)
      return {
        type: 'raw-html',
        html: rawHtml,
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

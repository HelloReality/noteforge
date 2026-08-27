// NoteForge — serializer (§A.4 round-trip, export)
// Converts a NoteDocument model back to `.note.html`. The output re-parses
// to the same model (idempotent), enabling round-trip tests and export.

import type {
  Block, NoteDocument, NotePage, Align, CalloutType, DividerStyle, HeadingLevel, ListType,
} from './types'

function escAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function classesAttr(classes: string[]): string {
  const c = classes.filter(Boolean).join(' ')
  return c ? ` class="${escAttr(c)}"` : ''
}

function alignAttr(align?: Align): string {
  return align ? ` data-align="${align}"` : ''
}

function styleAttr(style?: string): string {
  return style ? ` style="${escAttr(style)}"` : ''
}

function serializeBlock(b: Block, indent: string): string {
  switch (b.type) {
    case 'title':
      return `${indent}<note-title${alignAttr(b.align)}${classesAttr(b.classes)}>${b.html}</note-title>`
    case 'heading':
      return `${indent}<note-heading level="${b.level}"${alignAttr(b.align)}${classesAttr(b.classes)}>${b.html}</note-heading>`
    case 'paragraph':
      return `${indent}<note-paragraph${alignAttr(b.align)}${classesAttr(b.classes)}${styleAttr(b.style)}>${b.html}</note-paragraph>`
    case 'question': {
      const num = b.number !== undefined ? ` number="${b.number}"` : ''
      const inner = b.children.map(c => serializeBlock(c, indent + '  ')).join('\n')
      return `${indent}<note-question${num}${classesAttr(b.classes)}>\n${inner}\n${indent}</note-question>`
    }
    case 'list': {
      const type = ` type="${b.listType}"`
      const start = b.listType === 'numbered' && b.start !== undefined ? ` start="${b.start}"` : ''
      const items = b.items.map(it => {
        const checked = b.listType === 'check' ? ` data-checked="${it.checked ? 'true' : 'false'}"` : ''
        return `${indent}  <note-item${checked}>${it.html}</note-item>`
      }).join('\n')
      return `${indent}<note-list${type}${start}${classesAttr(b.classes)}>\n${items}\n${indent}</note-list>`
    }
    case 'callout': {
      const ct = ` type="${b.calloutType}"`
      const title = b.title ? ` title="${escAttr(b.title)}"` : ''
      const pos =
        (b.x !== undefined ? ` data-x="${b.x}"` : '') +
        (b.y !== undefined ? ` data-y="${b.y}"` : '') +
        (b.w !== undefined ? ` data-w="${b.w}"` : '') +
        (b.z !== undefined ? ` data-z="${b.z}"` : '')
      if (b.children && b.children.length) {
        const inner = b.children.map(c => serializeBlock(c, indent + '  ')).join('\n')
        return `${indent}<note-callout${ct}${title}${pos}${classesAttr(b.classes)}>\n${inner}\n${indent}</note-callout>`
      }
      return `${indent}<note-callout${ct}${title}${pos}${classesAttr(b.classes)}>${b.html || ''}</note-callout>`
    }
    case 'definition':
      return `${indent}<note-definition term="${escAttr(b.term)}"${classesAttr(b.classes)}>${b.html}</note-definition>`
    case 'quote': {
      const cite = b.cite ? ` data-cite="${escAttr(b.cite)}"` : ''
      return `${indent}<note-quote${cite}${classesAttr(b.classes)}>${b.html}</note-quote>`
    }
    case 'divider':
      return `${indent}<note-divider style="${b.style || 'solid'}"></note-divider>`
    case 'spacer':
      return `${indent}<note-spacer height="${b.height}"></note-spacer>`
    case 'code': {
      const lang = b.language ? ` language="${escAttr(b.language)}"` : ''
      return `${indent}<note-code${lang}>${b.text}</note-code>`
    }
    case 'table': {
      const cap = b.caption ? ` data-caption="${escAttr(b.caption)}"` : ''
      return `${indent}<note-table${cap}${classesAttr(b.classes)}>\n${indent}  <table>${b.html}</table>\n${indent}</note-table>`
    }
    case 'image': {
      const src = b.src ? ` src="${escAttr(b.src)}"` : ''
      const alt = b.alt ? ` alt="${escAttr(b.alt)}"` : ''
      const w = b.width !== undefined ? ` width="${b.width}"` : ''
      const h = b.height !== undefined ? ` height="${b.height}"` : ''
      const cap = b.caption ? ` data-caption="${escAttr(b.caption)}"` : ''
      return `${indent}<note-image${src}${alt}${w}${h}${cap}${classesAttr(b.classes)}></note-image>`
    }
    case 'diagram': {
      const w = b.width !== undefined ? ` data-width="${b.width}"` : ''
      const h = b.height !== undefined ? ` data-height="${b.height}"` : ''
      const t = b.title ? ` data-title="${escAttr(b.title)}"` : ''
      if (b.diagramType === 'svg') {
        return `${indent}<note-diagram type="svg"${w}${h}${t}>\n${indent}  ${b.source}\n${indent}</note-diagram>`
      }
      // mermaid / excalidraw: text content (CDATA-safe-ish; kept as raw text)
      return `${indent}<note-diagram type="${b.diagramType}"${w}${h}${t}>\n${indent}  ${escapeForXmlText(b.source)}\n${indent}</note-diagram>`
    }
  }
}

/** Escape characters that would break XML-ish text content for non-HTML diagram sources. */
function escapeForXmlText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
}

function serializePage(p: NotePage): string {
  const blocks = p.blocks.map(b => serializeBlock(b, '    ')).join('\n')
  return `  <note-page data-page="${p.page}" data-width="${p.width}" data-height="${p.height}" data-background="${escAttr(p.background)}">\n${blocks}\n  </note-page>`
}

export function serializeNoteDocument(doc: NoteDocument): string {
  const pages = doc.pages.map(serializePage).join('\n')
  const generator = doc.generator ? `\n    <meta name="note-generator" content="${escAttr(doc.generator)}">` : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="note-format" content="visual-notes/1">${generator}
  <title>${doc.title}</title>
  <style>
${doc.css}
  </style>
</head>
<body>
<note-document data-title="${escAttr(doc.title)}" data-version="${escAttr(doc.version)}">
${pages}
</note-document>
</body>
</html>`
}

// Type-only re-exports for convenience (so editor/store can import from one place).
export type { CalloutType, DividerStyle, HeadingLevel, ListType }

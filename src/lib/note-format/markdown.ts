// NoteForge — Markdown serializer
// Converts a NoteDocument model to a Markdown string for export.
// Maps each block type to its Markdown equivalent. Rich-text HTML is
// converted to plain text with basic inline formatting preserved where
// possible (strong/em/code). Diagrams are exported as fenced code blocks.

import type {
  Block, NoteDocument, NotePage, CalloutType, DividerStyle,
} from './types'

/** Convert inline rich-text HTML to a Markdown-safe plain-text-ish string.
 *  Preserves <strong>/<em>/<code>/<a> as MD inline syntax; strips other tags. */
function inlineToMd(html: string): string {
  if (!html) return ''
  let out = html
  // Convert <strong>/<b> → **text**
  out = out.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => `**${stripTagsExceptKnown(inner)}**`)
  // Convert <em>/<i> → *text*
  out = out.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => `*${stripTagsExceptKnown(inner)}*`)
  // Convert <code> → `text`
  out = out.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_m, inner) => `\`${stripAllTags(inner)}\``)
  // Convert <mark> → ==text== (custom MD extension, widely supported)
  out = out.replace(/<mark\b[^>]*>([\s\S]*?)<\/mark>/gi, (_m, inner) => `==${stripTagsExceptKnown(inner)}==`)
  // Convert <u> → <u>text</u> (HTML — MD has no underline)
  // leave as-is, it's valid HTML in MD
  // Convert <s>/<del> → ~~text~~
  out = out.replace(/<(s|del)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => `~~${stripTagsExceptKnown(inner)}~~`)
  // Convert <a href="url">text</a> → [text](url)
  out = out.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, inner) => {
    const text = stripTagsExceptKnown(inner).trim() || href
    return `[${text}](${href})`
  })
  // <br> → line break (two spaces + newline)
  out = out.replace(/<br\s*\/?>/gi, '  \n')
  // Strip all remaining tags
  out = stripAllTags(out)
  // Decode common HTML entities
  out = out
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
  return out.trim()
}

function stripAllTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function stripTagsExceptKnown(html: string): string {
  // Keep only strong/em/code/a/mark/s/u tags, strip the rest
  return html.replace(/<(?!\/?(?:strong|b|em|i|code|mark|s|del|u|a)\b)[^>]+>/gi, '')
}

function calloutEmoji(type: CalloutType): string {
  return { tip: '💡', info: 'ℹ️', warning: '⚠️', danger: '🚨', note: '📝' }[type] || '📝'
}

function dividerToMd(style?: DividerStyle): string {
  const char = style === 'dashed' ? '- ' : style === 'dotted' ? '· ' : ''
  return `---\n<!-- divider: ${style || 'solid'} -->`
}

function serializeBlockToMd(b: Block, depth = 0): string {
  const indent = '  '.repeat(depth)
  switch (b.type) {
    case 'title':
      return `# ${inlineToMd(b.html)}`
    case 'heading': {
      const hashes = '#'.repeat(b.level)
      return `${hashes} ${inlineToMd(b.html)}`
    }
    case 'paragraph':
      return inlineToMd(b.html)
    case 'question': {
      const numPrefix = b.number !== undefined ? `**Q${b.number}**\n\n` : ''
      const children = b.children
        .map(c => serializeBlockToMd(c, depth))
        .filter(Boolean)
        .join('\n\n')
      return `${numPrefix}${children}`
    }
    case 'list': {
      const lines = b.items.map((item, i) => {
        const text = inlineToMd(item.html)
        if (b.listType === 'bullet') return `${indent}- ${text}`
        if (b.listType === 'numbered') return `${indent}${(b.start ?? 1) + i}. ${text}`
        // check
        const mark = item.checked ? '[x]' : '[ ]'
        return `${indent}- ${mark} ${text}`
      })
      return lines.join('\n')
    }
    case 'callout': {
      const emoji = calloutEmoji(b.calloutType)
      const titlePart = b.title ? ` **${b.title}**` : ''
      const body = b.children
        ? b.children.map(c => serializeBlockToMd(c, depth)).filter(Boolean).join('\n\n')
        : inlineToMd(b.html || '')
      return `> ${emoji}${titlePart}\n>\n> ${body.split('\n').join('\n> ')}`
    }
    case 'definition':
      return `**${b.term}** — ${inlineToMd(b.html)}`
    case 'quote': {
      const cite = b.cite ? ` — *${b.cite}*` : ''
      const text = inlineToMd(b.html)
      return `> ${text}${cite}`
    }
    case 'divider':
      return dividerToMd(b.style)
    case 'spacer':
      return `<!-- spacer: ${b.height}px -->\n&nbsp;`
    case 'code': {
      const lang = b.language || ''
      return '```' + lang + '\n' + b.text + '\n```'
    }
    case 'table': {
      // Parse the inner table HTML to build a GFM table.
      return htmlTableToGfm(b.html, b.caption)
    }
    case 'image': {
      const alt = b.alt || ''
      const src = b.src || ''
      const cap = b.caption ? `\n*${b.caption}*` : ''
      return `![${alt}](${src})${cap}`
    }
    case 'diagram': {
      const lang = b.diagramType === 'mermaid' ? 'mermaid' : b.diagramType === 'excalidraw' ? 'json' : 'html'
      const titlePart = b.title ? ` *${b.title}*` : ''
      return '```' + lang + '\n' + b.source + '\n```' + titlePart
    }
  }
}

function htmlTableToGfm(html: string, caption?: string): string {
  // Lightweight table parser: extract rows from <tr>, cells from <th>/<td>.
  const rows: { cells: string[]; header: boolean }[] = []
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(html))) {
    const rowHtml = rowMatch[1]
    const cells: string[] = []
    let isHeader = false
    const cellRe = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowHtml))) {
      if (cellMatch[1].toLowerCase() === 'th') isHeader = true
      cells.push(inlineToMd(cellMatch[2]).replace(/\|/g, '\\|'))
    }
    if (cells.length) rows.push({ cells, header: isHeader })
  }
  if (rows.length === 0) return '<!-- empty table -->'
  const colCount = Math.max(...rows.map(r => r.cells.length))
  const headerRow = rows[0].header ? rows[0] : { cells: Array(colCount).fill(''), header: true }
  const bodyRows = rows[0].header ? rows.slice(1) : rows
  const lines: string[] = []
  lines.push(`| ${headerRow.cells.map(c => c || ' ').join(' | ')} |`)
  lines.push(`| ${Array(colCount).fill('---').join(' | ')} |`)
  for (const r of bodyRows) {
    while (r.cells.length < colCount) r.cells.push('')
    lines.push(`| ${r.cells.join(' | ')} |`)
  }
  if (caption) lines.push(`\n*${caption}*`)
  return lines.join('\n')
}

function serializePageToMd(page: NotePage): string {
  const blocks = page.blocks.map(b => serializeBlockToMd(b)).filter(Boolean)
  return blocks.join('\n\n')
}

/** Convert a NoteDocument to a Markdown string. */
export function serializeToMarkdown(doc: NoteDocument): string {
  const parts: string[] = []
  // YAML front matter for metadata
  parts.push('---')
  parts.push(`title: ${JSON.stringify(doc.title)}`)
  parts.push(`version: ${JSON.stringify(doc.version)}`)
  if (doc.generator) parts.push(`generator: ${JSON.stringify(doc.generator)}`)
  parts.push(`format: visual-notes/1`)
  parts.push('---')
  parts.push('')

  for (let i = 0; i < doc.pages.length; i++) {
    if (doc.pages.length > 1) {
      parts.push(`<!-- Page ${i + 1} of ${doc.pages.length} -->`)
      parts.push('')
    }
    parts.push(serializePageToMd(doc.pages[i]))
    parts.push('')
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

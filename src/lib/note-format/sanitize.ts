// NoteForge — HTML sanitizer (§10, Appendix A.3)
// Server-side. Uses linkedom DOM. Produces sanitized HTML strings stored in the model.
//
// Inline rich-text contexts (paragraph / heading / item / callout / quote / definition)
// allow only: span, strong, em, b, i, u, s, mark, code, sub, sup, a, br.
// Disallowed inline wrappers are unwrapped (children kept).
// Dangerous container elements (script, iframe, object, embed, form, template, style)
// are dropped with their entire subtree.
// Void inline elements not on the allowlist (e.g. <img>) are dropped (no children to keep).
// <a href="javascript:…"> is unwrapped (text kept) so neither link nor scheme survives.

import type { Warning } from './types'
import { WarningCode } from './types'
import { sanitizeInlineStyle } from './css'

// Minimal DOM-like accessors we depend on. linkedom provides all of these.
interface DomLike {
  parseFromString(html: string, mime: string): Document
}
type AnyNode = Element | Text | Comment | CDATASection | Document | DocumentFragment

const INLINE_ALLOWLIST = new Set([
  'span', 'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'code', 'sub', 'sup', 'a', 'br',
])

// Dangerous containers — dropped with their entire subtree.
const DANGEROUS_CONTAINERS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'template', 'style', 'noscript', 'frame', 'applet', 'meta', 'link', 'base',
])

const SAFE_SCHEMES = /^(https?:|mailto:|tel:|data:image\/|\/|\.\/|\.\.\/|#)/i

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;')
}

/** Trim + lowercase scheme check for href/src. Catches `jAvAsCrIpT:`, `jav\tascript:`. */
function hasBadScheme(url: string): boolean {
  const u = url.trim().replace(/[\t\r\n\s]+/g, '').toLowerCase()
  if (u.startsWith('javascript:')) return true
  if (u.startsWith('data:text/html')) return true
  if (u.startsWith('vbscript:')) return true
  return false
}

function isExternalUrl(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (u.startsWith('data:image/')) return false
  if (/^(https?:|\/\/|ftp:|file:)/i.test(u)) return true
  return false
}

/** Build the inner sanitized HTML for the children of `node`. */
export function sanitizeInlineChildren(
  node: Element,
  warnings: Warning[],
  path: string,
): string {
  let out = ''
  for (const child of Array.from(node.childNodes as NodeListOf<AnyNode>)) {
    out += sanitizeInlineNode(child, warnings, path)
  }
  return out
}

function sanitizeInlineNode(node: AnyNode, warnings: Warning[], path: string): string {
  if (node.nodeType === 3 /* TEXT */) {
    return escapeHtml(node.textContent || '')
  }
  if (node.nodeType === 8 /* COMMENT */) {
    return '' // comments stripped (A.3.1)
  }
  if (node.nodeType !== 1 /* ELEMENT */) return ''
  const el = node as Element
  const tag = el.tagName.toLowerCase()

  if (DANGEROUS_CONTAINERS.has(tag)) {
    warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped dangerous element <${tag}> with subtree`, path })
    return ''
  }

  if (tag === 'br') return '<br>'

  if (INLINE_ALLOWLIST.has(tag)) {
    return sanitizeInlineElement(el, warnings, path)
  }

  // Unknown inline — unwrap (keep children). Void elements (img, etc.) have no
  // children, so this effectively drops them.
  return sanitizeInlineChildren(el, warnings, path)
}

function sanitizeInlineElement(el: Element, warnings: Warning[], path: string): string {
  const tag = el.tagName.toLowerCase()
  const attrs: string[] = []
  let hrefAdded = false
  let hasTarget = false
  let hasRel = false

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    const value = attr.value

    if (name === 'class') {
      attrs.push(`class="${escapeAttr(value)}"`)
      continue
    }
    if (name === 'style') {
      const cleaned = sanitizeInlineStyle(value, warnings, path)
      if (cleaned) attrs.push(`style="${escapeAttr(cleaned)}"`)
      continue
    }
    if (tag === 'a' && name === 'href') {
      if (hasBadScheme(value)) {
        warnings.push({ code: WarningCode.BAD_SCHEME, level: 'warn', message: `Dropped <a> with unsafe href scheme`, path })
        // unwrap: keep children, drop the <a> wrapper.
        return sanitizeInlineChildren(el, warnings, path)
      }
      attrs.push(`href="${escapeAttr(value)}"`)
      hrefAdded = true
      continue
    }
    if (tag === 'a' && name === 'target') {
      attrs.push(`target="${escapeAttr(value)}"`)
      hasTarget = true
      continue
    }
    if (tag === 'a' && name === 'rel') {
      attrs.push(`rel="${escapeAttr(value)}"`)
      hasRel = true
      continue
    }
    if (name.startsWith('on')) {
      warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'warn', message: `Dropped event handler \`${name}\``, path })
      continue
    }
    warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'info', message: `Dropped attribute \`${name}\` on <${tag}>`, path })
  }

  // Force safe link behavior on <a> (idempotent: only add when missing).
  if (tag === 'a' && hrefAdded) {
    if (!hasTarget) attrs.push('target="_blank"')
    if (!hasRel) attrs.push('rel="noopener noreferrer"')
  }

  const inner = sanitizeInlineChildren(el, warnings, path)
  return `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${inner}</${tag}>`
}

/** Sanitize an <svg> element, return its serialized outerHTML.
 *
 * Note: linkedom parses HTML and lowercases tag names, which corrupts
 * case-sensitive SVG (`linearGradient` -> `lineargradient`). For correctness
 * we sanitise SVG via a string-based, case-preserving sanitizer. Pass the
 * raw (un-parsed) SVG markup; this function is case-preserving. */
export function sanitizeSvgString(rawSvg: string, warnings: Warning[], path: string): string {
  let out = rawSvg

  // 1. Strip comments.
  out = out.replace(/<!--[\s\S]*?-->/g, '')

  // 2. Drop <script>...</script> blocks.
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, () => {
    warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <script> inside SVG`, path })
    return ''
  })

  // 3. Drop dangerous container subtrees (foreignObject, iframe, object, embed, form, template, style).
  out = out.replace(/<(foreignObject|iframe|object|embed|form|template|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (_m, tag) => {
    warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <${tag}> inside SVG`, path })
    return ''
  })
  // 3b. Self-closing dangerous void-ish elements (<embed .../>).
  out = out.replace(/<(embed|iframe|object|form|template|style)\b[^>]*\/>/gi, (_m, tag) => {
    warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <${tag}/> inside SVG`, path })
    return ''
  })

  // 4. Unwrap <a ...>...</a> whose href/xlink:href has a bad scheme (keep inner content).
  out = out.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, (full, inner) => {
    const m = full.match(/(?:xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/i)
    if (m) {
      const val = m[1].slice(1, -1)
      if (hasBadScheme(val)) {
        warnings.push({ code: WarningCode.BAD_SCHEME, level: 'warn', message: `Unwrapped <a> with unsafe href in SVG`, path })
        return inner
      }
      if (isExternalUrl(val)) {
        warnings.push({ code: WarningCode.EXTERNAL_RESOURCE_STRIPPED, level: 'warn', message: `Unwrapped <a> with external href in SVG`, path })
        return inner
      }
    }
    // Clean the opening tag (strip on*, bad-scheme href).
    const cleanedOpen = cleanSvgOpenTag(full.match(/<a\b[^>]*>/i)![0], warnings, path)
    return `${cleanedOpen}${inner}</a>`
  })

  // 5. Strip on* event handlers everywhere.
  out = out.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, () => {
    warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'warn', message: `Dropped SVG event handler`, path })
    return ''
  })

  // 6. Strip any remaining bad-scheme href/xlink:href attributes.
  out = out.replace(/\s+(?:xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/gi, (fullAttr, quoted) => {
    const val = quoted.slice(1, -1)
    if (hasBadScheme(val) || isExternalUrl(val)) {
      warnings.push({ code: WarningCode.BAD_SCHEME, level: 'warn', message: `Dropped unsafe href in SVG`, path })
      return ''
    }
    return fullAttr
  })

  return out
}

function cleanSvgOpenTag(openTag: string, warnings: Warning[], path: string): string {
  // strip on* and bad href from an opening tag, keep the rest (case preserved).
  let out = openTag.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  out = out.replace(/\s+(?:xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/gi, (fullAttr, quoted) => {
    const val = quoted.slice(1, -1)
    if (hasBadScheme(val) || isExternalUrl(val)) {
      warnings.push({ code: WarningCode.BAD_SCHEME, level: 'warn', message: `Dropped unsafe href in SVG`, path })
      return ''
    }
    return fullAttr
  })
  return out
}

/** Sanitize an <svg> element via DOM (legacy path). Prefer sanitizeSvgString for case preservation. */
export function sanitizeSvg(svg: Element, warnings: Warning[], path: string): string {
  // Not used in the default pipeline (parse.ts uses sanitizeSvgString), kept for API completeness.
  return sanitizeSvgString((svg as unknown as { outerHTML: string }).outerHTML, warnings, path)
}

/** Sanitize a real <table> element, return its innerHTML. */
export function sanitizeTable(table: Element, warnings: Warning[], path: string): string {
  const clone = table.cloneNode(true) as Element
  // table only allows: thead, tbody, tfoot, tr, th, td, caption, colgroup, col.
  cleanTableSubtree(clone, warnings, path)
  return (clone as unknown as { innerHTML: string }).innerHTML
}

const TABLE_ALLOWED = new Set(['thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col'])
const TABLE_CELL = new Set(['th', 'td'])

function cleanTableSubtree(el: Element, warnings: Warning[], path: string): void {
  // Cells contain rich-text inline content, NOT structural table children.
  // Handle them by replacing their inner HTML with sanitized inline HTML.
  if (TABLE_CELL.has(el.tagName.toLowerCase())) {
    const attrs = Array.from(el.attributes)
    for (const attr of attrs) {
      const name = attr.name.toLowerCase()
      if (name === 'class' || name === 'style') {
        if (name === 'style') {
          const cleaned = sanitizeInlineStyle(attr.value, warnings, path)
          if (cleaned) el.setAttribute('style', cleaned)
          else el.removeAttribute('style')
        }
        continue
      }
      if (name === 'colspan' || name === 'rowspan') continue
      if (name.startsWith('on')) {
        warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'warn', message: `Dropped table event handler \`${name}\``, path })
        el.removeAttribute(attr.name)
        continue
      }
      warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'info', message: `Dropped attribute \`${name}\` on <${el.tagName.toLowerCase()}>`, path })
      el.removeAttribute(attr.name)
    }
    const sanitized = sanitizeInlineChildren(el, warnings, path)
    el.innerHTML = sanitized
    return
  }

  const children = Array.from(el.children)
  for (const child of children) {
    const ctag = child.tagName.toLowerCase()
    if (DANGEROUS_CONTAINERS.has(ctag)) {
      warnings.push({ code: WarningCode.DANGEROUS_ELEMENT_DROPPED, level: 'warn', message: `Dropped <${ctag}> inside table`, path })
      child.remove()
      continue
    }
    if (!TABLE_ALLOWED.has(ctag)) {
      warnings.push({ code: WarningCode.UNKNOWN_ELEMENT, level: 'info', message: `Unwrapped unknown table element <${ctag}>`, path })
      const parent = child.parentNode
      if (parent) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child)
        parent.removeChild(child)
      }
      continue
    }
    cleanTableSubtree(child, warnings, path)
  }
  // sanitize attributes on structural table elements (table/thead/tbody/tr/etc.)
  const attrs = Array.from(el.attributes)
  for (const attr of attrs) {
    const name = attr.name.toLowerCase()
    if (name === 'class') continue
    if (name === 'style') {
      const cleaned = sanitizeInlineStyle(attr.value, warnings, path)
      if (cleaned) el.setAttribute('style', cleaned)
      else el.removeAttribute('style')
      continue
    }
    if (name.startsWith('on')) {
      warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'warn', message: `Dropped table event handler \`${name}\``, path })
      el.removeAttribute(attr.name)
      continue
    }
    warnings.push({ code: WarningCode.UNKNOWN_ATTRIBUTE, level: 'info', message: `Dropped attribute \`${name}\` on <${el.tagName.toLowerCase()}>`, path })
    el.removeAttribute(attr.name)
  }
}

/** Sanitize a data: or relative image src. Returns null if external/unsafe. */
export function sanitizeImageSrc(src: string | null, warnings: Warning[], path: string): string | null {
  if (!src) return null
  if (hasBadScheme(src)) {
    warnings.push({ code: WarningCode.BAD_SCHEME, level: 'warn', message: `Dropped unsafe image src scheme`, path })
    return null
  }
  if (isExternalUrl(src)) {
    warnings.push({ code: WarningCode.EXTERNAL_RESOURCE_STRIPPED, level: 'warn', message: `Stripped external image src`, path })
    return null
  }
  return src
}

export { hasBadScheme, isExternalUrl }

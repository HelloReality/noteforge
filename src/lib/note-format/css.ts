// NoteForge — CSS sanitizer (§10.5, Appendix A.3.8)
// Sanitizes a `<style>` stylesheet text or an inline `style="..."` declaration list.
// - Strips /* */ comments.
// - Drops @import rules entirely.
// - Drops @font-face rules whose src references a remote URL.
// - Drops remote url(...) declarations.
// - Drops the `behavior` property (IE).
// - Rewrites `position: fixed` -> `position: absolute`.
// - Drops rules/selectors containing dangerous constructs.
// Legitimate rules survive (e.g. `.mf-q { border:2px solid #b91c1c; … }`).

import type { Warning } from './types'
import { WarningCode } from './types'

const REMOTE_URL = /url\(\s*(['"]?)\s*(https?:|\/\/|ftp:|file:)/i
const ANY_URL = /url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi
const JAVASCRIPT_SCHEME = /javascript:/i
const HTML_DATA = /data:text\/html/i

function isRemoteUrlValue(value: string): boolean {
  return REMOTE_URL.test(value) || JAVASCRIPT_SCHEME.test(value) || HTML_DATA.test(value)
}

/** Sanitize a single declaration string `prop:value`. Returns null if dropped. */
function sanitizeDeclaration(decl: string, warnings: Warning[], path: string): string | null {
  const idx = decl.indexOf(':')
  if (idx === -1) return decl.trim() ? decl.trim() : null
  const prop = decl.slice(0, idx).trim().toLowerCase()
  const value = decl.slice(idx + 1).trim()

  if (prop === 'behavior') {
    warnings.push({ code: WarningCode.CSS_DECLARATION_DROPPED, level: 'warn', message: `Dropped IE \`behavior\` property`, path })
    return null
  }
  if (isRemoteUrlValue(value)) {
    warnings.push({ code: WarningCode.CSS_DECLARATION_DROPPED, level: 'warn', message: `Dropped declaration \`${prop}\` with remote/unsafe url()`, path })
    return null
  }
  if (prop === 'position' && /^fixed\b/i.test(value)) {
    const rewritten = value.replace(/^fixed\b/i, 'absolute')
    warnings.push({ code: WarningCode.CSS_PROPERTY_REWRITTEN, level: 'warn', message: `Rewrote \`position:fixed\` -> \`position:absolute\``, path })
    return `position: ${rewritten}`
  }
  // Normalise any remaining url() to keep quotes tidy (no behaviour change).
  return `${prop}: ${value}`
}

/** Sanitize an inline `style="..."` value. */
export function sanitizeInlineStyle(value: string, warnings: Warning[], path: string): string {
  const decls = splitDeclarations(value)
  const out: string[] = []
  for (const d of decls) {
    const kept = sanitizeDeclaration(d, warnings, path)
    if (kept) out.push(kept)
  }
  return out.join('; ')
}

/** Sanitize a full stylesheet (head `<style>`). */
export function sanitizeStylesheet(css: string, warnings: Warning[], path: string): string {
  // 1. Strip comments.
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return parseBlock(noComments, 0, noComments.length, warnings, path).result
}

/** Split a declaration list on `;` respecting parentheses (for url()). */
function splitDeclarations(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    if (ch === ';' && depth === 0) {
      if (cur.trim()) out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** Recursively parse a CSS block range, returning sanitized CSS. */
function parseBlock(src: string, start: number, end: number, warnings: Warning[], path: string): { result: string; next: number } {
  let i = start
  let out = ''
  while (i < end) {
    // Find next `{` or `;` or `}`.
    let brace = -1, semi = -1
    for (let j = i; j < end; j++) {
      const c = src[j]
      if (c === '{') { brace = j; break }
      if (c === ';') { semi = j; break }
      if (c === '}') { break }
    }
    if (brace === -1 && semi === -1) {
      // end of block
      out += src.slice(i, end)
      return { result: out, next: end }
    }
    if (semi !== -1 && (brace === -1 || semi < brace)) {
      // at-statement without body (e.g. @import) — drop if @import
      const stmt = src.slice(i, semi).trim()
      if (stmt.toLowerCase().startsWith('@import')) {
        warnings.push({ code: WarningCode.CSS_RULE_DROPPED, level: 'warn', message: `Dropped @import rule`, path })
      } else if (stmt) {
        out += stmt + ';'
      }
      i = semi + 1
      continue
    }
    // We have a `{` at `brace`. Selector/at-rule preamble is [i, brace).
    const prelude = src.slice(i, brace).trim()
    // Find matching `}`.
    let depth = 1, j = brace + 1
    while (j < end && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      if (depth === 0) break
      j++
    }
    const body = src.slice(brace + 1, j)
    i = j + 1

    if (prelude.toLowerCase().startsWith('@import')) {
      warnings.push({ code: WarningCode.CSS_RULE_DROPPED, level: 'warn', message: `Dropped @import rule`, path })
      continue
    }
    if (prelude.toLowerCase().startsWith('@font-face')) {
      // Drop if src references remote URL.
      if (REMOTE_URL.test(body) || JAVASCRIPT_SCHEME.test(body)) {
        warnings.push({ code: WarningCode.CSS_RULE_DROPPED, level: 'warn', message: `Dropped @font-face with remote/unsafe src`, path })
        continue
      }
      out += `@font-face{${sanitizeDeclarations(body, warnings, path)}}`
      continue
    }
    if (prelude.startsWith('@')) {
      // @media / @supports / @keyframes — recurse into body, keep prelude.
      const inner = parseBlock(body, 0, body.length, warnings, path).result
      out += `${prelude}{${inner}}`
      continue
    }
    // Regular style rule.
    if (isDangerousSelector(prelude)) {
      warnings.push({ code: WarningCode.CSS_RULE_DROPPED, level: 'warn', message: `Dropped CSS rule with dangerous selector`, path })
      continue
    }
    const cleanDecls = sanitizeDeclarations(body, warnings, path)
    if (cleanDecls.trim()) {
      out += `${prelude}{${cleanDecls}}`
    } else {
      // keep empty rule? drop silently to keep output tidy, but preserve legitimacy.
      // (An empty rule carries no visual effect; dropping is safe.)
    }
  }
  return { result: out, next: i }
}

function sanitizeDeclarations(body: string, warnings: Warning[], path: string): string {
  const decls = splitDeclarations(body)
  const out: string[] = []
  for (const d of decls) {
    const kept = sanitizeDeclaration(d, warnings, path)
    if (kept) out.push(kept)
  }
  return out.join('; ')
}

function isDangerousSelector(selector: string): boolean {
  // Drop selectors that attempt to inject style/behavior beyond styling.
  return /expression\s*\(/i.test(selector) || /javascript:/i.test(selector)
}

// ---------------------------------------------------------------------------
// scopeCss — prefix every selector in a sanitized stylesheet with a scope,
// so injected fixture stylesheets (e.g. `.note-page table`, `.q-card`, …)
// only apply inside the renderer root and never leak into the app chrome.
//
// The input is *already sanitized* (run sanitizeStylesheet first). scopeCss
// reuses the same brace-matching tokenizer as parseBlock above. It:
//   - strips /* */ comments (defensive, sanitize already did)
//   - walks the top-level rule stream
//   - for ordinary style rules: prefixes every comma-separated selector with
//     the scope, unless the selector already begins with the scope (idempotent)
//   - for @media / @supports / @container: keeps the prelude, recurses
//   - for @keyframes: keeps the prelude (name), recurses and prefixes the
//     percentage/keyframe selectors with the scope as well (harmless and
//     keeps the rule body valid since each keyframe selector like `0%` or
//     `from` becomes `.scope 0%` … which is actually invalid CSS). To stay
//     safe, @keyframes bodies are passed through unchanged (keyframe
//     selectors cannot be scoped — and they are global by design).
//   - for @font-face / @import / @namespace / @charset: passed through
//     unchanged (no selectors to scope).
// Returns the rewritten stylesheet string.
// ---------------------------------------------------------------------------

/**
 * Prefix every style-rule's selector list with `scope` so the rules only
 * apply inside the scope. The input must already be sanitized.
 */
export function scopeCss(css: string, scope: string): string {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return scopeBlock(noComments, 0, noComments.length, scope).result
}

function scopeBlock(src: string, start: number, end: number, scope: string): { result: string; next: number } {
  let i = start
  let out = ''
  while (i < end) {
    // Find next `{`, `;`, or `}`.
    let brace = -1, semi = -1
    for (let j = i; j < end; j++) {
      const c = src[j]
      if (c === '{') { brace = j; break }
      if (c === ';') { semi = j; break }
      if (c === '}') { break }
    }
    if (brace === -1 && semi === -1) {
      out += src.slice(i, end)
      return { result: out, next: end }
    }
    if (semi !== -1 && (brace === -1 || semi < brace)) {
      // at-statement without body (e.g. @import, @charset, @namespace).
      // Pass through unchanged.
      const stmt = src.slice(i, semi)
      out += stmt + ';'
      i = semi + 1
      continue
    }
    // brace position
    const prelude = src.slice(i, brace).trim()
    // Find matching `}`.
    let depth = 1, j = brace + 1
    while (j < end && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      if (depth === 0) break
      j++
    }
    const body = src.slice(brace + 1, j)
    i = j + 1

    const at = prelude.startsWith('@')
    if (at) {
      const name = prelude.split(/[({\s]/, 1)[0].toLowerCase()
      if (name === '@media' || name === '@supports' || name === '@container' || name === '@layer') {
        const inner = scopeBlock(body, 0, body.length, scope).result
        out += `${prelude}{${inner}}`
        continue
      }
      // @keyframes, @font-face, @charset, @namespace, @import, @property …
      // Pass through unchanged — these have no scoping selectors (or, in
      // the case of @keyframes, scoping the keyframe selectors would be
      // invalid CSS).
      out += `${prelude}{${body}}`
      continue
    }
    // Regular style rule: prefix each selector in the comma list.
    const scoped = scopeSelectorList(prelude, scope)
    out += `${scoped}{${body}}`
  }
  return { result: out, next: i }
}

/** Split a selector list on commas (top-level only, not inside (), [], or attribute selectors), prefix each, and rejoin. */
function scopeSelectorList(selectorList: string, scope: string): string {
  const parts = splitSelectorCommas(selectorList)
  const out: string[] = []
  for (let p of parts) {
    const trimmed = p.trim()
    if (!trimmed) continue
    // Idempotent: skip if the selector already starts with the scope.
    if (trimmed.startsWith(scope)) {
      out.push(trimmed)
      continue
    }
    // Don't prefix `:root` or `html`/`body` — replace them with the scope.
    if (trimmed === ':root' || /^html$/i.test(trimmed) || /^body$/i.test(trimmed)) {
      out.push(scope)
      continue
    }
    // For selectors like `body > .x` we replace the leading `body`/`html`.
    const stripped = trimmed.replace(/^(html|body)\b/i, '').trim()
    const finalSelector = stripped ? `${scope} ${stripped}` : scope
    out.push(finalSelector)
  }
  return out.join(', ')
}

function splitSelectorCommas(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
    i++
  }
  if (cur.trim()) out.push(cur)
  return out
}

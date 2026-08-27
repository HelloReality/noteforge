// NoteForge — note-format types (visual-notes/1)
// Authoritative document model. Parsed from / serialized to `.note.html`.

export type Align = 'left' | 'center' | 'right'
export type HeadingLevel = 2 | 3 | 4
export type ListType = 'bullet' | 'numbered' | 'check'
export type CalloutType = 'tip' | 'info' | 'warning' | 'danger' | 'note'
export type DiagramType = 'mermaid' | 'svg' | 'excalidraw'
export type DividerStyle = 'solid' | 'dashed' | 'dotted'
export type DocumentStatus = 'draft' | 'review' | 'published'

/** Rich-text content is stored as a pre-sanitized HTML string. */
export type Html = string

export interface Warning {
  code: string
  level: 'info' | 'warn' | 'error'
  message: string
  path: string
}

export interface TitleBlock {
  type: 'title'
  align?: Align
  html: Html
  classes: string[]
}

export interface HeadingBlock {
  type: 'heading'
  level: HeadingLevel
  align?: Align
  html: Html
  classes: string[]
}

export interface ParagraphBlock {
  type: 'paragraph'
  align?: Align
  html: Html
  classes: string[]
  style?: string
}

export interface QuestionBlock {
  type: 'question'
  number?: number
  classes: string[]
  children: Block[]
}

export interface ListItem {
  html: Html
  checked?: boolean
}

export interface ListBlock {
  type: 'list'
  listType: ListType
  start?: number
  items: ListItem[]
  classes: string[]
}

export interface CalloutBlock {
  type: 'callout'
  calloutType: CalloutType
  title?: string
  html?: Html
  children?: Block[]
  classes: string[]
  // absolute positioning
  x?: number
  y?: number
  w?: number
  z?: number
}

export interface DefinitionBlock {
  type: 'definition'
  term: string
  html: Html
  classes: string[]
}

export interface QuoteBlock {
  type: 'quote'
  cite?: string
  html: Html
  classes: string[]
}

export interface DividerBlock {
  type: 'divider'
  style?: DividerStyle
}

export interface SpacerBlock {
  type: 'spacer'
  height: number
}

export interface CodeBlock {
  type: 'code'
  language?: string
  text: string
}

export interface TableBlock {
  type: 'table'
  caption?: string
  html: Html
  classes: string[]
}

export interface ImageBlock {
  type: 'image'
  src?: string
  alt?: string
  width?: number
  height?: number
  caption?: string
  classes: string[]
}

export interface DiagramBlock {
  type: 'diagram'
  diagramType: DiagramType
  source: string
  width?: number
  height?: number
  title?: string
  classes: string[]
}

export type Block =
  | TitleBlock
  | HeadingBlock
  | ParagraphBlock
  | QuestionBlock
  | ListBlock
  | CalloutBlock
  | DefinitionBlock
  | QuoteBlock
  | DividerBlock
  | SpacerBlock
  | CodeBlock
  | TableBlock
  | ImageBlock
  | DiagramBlock

export interface NotePage {
  page: number
  width: number
  height: number
  background: string
  blocks: Block[]
}

export interface NoteDocument {
  title: string
  version: string
  generator?: string
  css: string
  pages: NotePage[]
}

export interface ParseResult {
  model: NoteDocument
  warnings: Warning[]
}

/** Warning code constants (§6, Appendix A). */
export const WarningCode = {
  UNKNOWN_ELEMENT: 'UNKNOWN_ELEMENT',
  UNKNOWN_ATTRIBUTE: 'UNKNOWN_ATTRIBUTE',
  EXTERNAL_RESOURCE_STRIPPED: 'EXTERNAL_RESOURCE_STRIPPED',
  CSS_RULE_DROPPED: 'CSS_RULE_DROPPED',
  CSS_DECLARATION_DROPPED: 'CSS_DECLARATION_DROPPED',
  CSS_PROPERTY_REWRITTEN: 'CSS_PROPERTY_REWRITTEN',
  DANGEROUS_ELEMENT_DROPPED: 'DANGEROUS_ELEMENT_DROPPED',
  BAD_SCHEME: 'BAD_SCHEME',
  STRUCTURAL_ERROR: 'STRUCTURAL_ERROR',
} as const

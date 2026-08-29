// NoteForge — Shared Renderer / block dispatcher
//
// Switch on `block.type` and render the matching block component. Used by
// NotePage (top-level page blocks) and by the Question/Callout blocks (which
// contain nested child blocks). Keeping a single dispatcher guarantees the
// same rendering order / structure across all three modes.

import type { ReactElement } from 'react'

import type { Block } from '@/lib/note-format/types'
import type { RenderMode } from '../types'
import { TitleBlock } from './TitleBlock'
import { HeadingBlock } from './HeadingBlock'
import { ParagraphBlock } from './ParagraphBlock'
import { QuestionBlock } from './QuestionBlock'
import { ListBlock } from './ListBlock'
import { CalloutBlock } from './CalloutBlock'
import { DefinitionBlock } from './DefinitionBlock'
import { QuoteBlock } from './QuoteBlock'
import { DividerBlock } from './DividerBlock'
import { SpacerBlock } from './SpacerBlock'
import { CodeBlock } from './CodeBlock'
import { TableBlock } from './TableBlock'
import { ImageBlock } from './ImageBlock'
import { DiagramBlock } from './DiagramBlock'
import { RawHtmlBlock } from './RawHtmlBlock'

export interface BlockRendererProps {
  block: Block
  mode: RenderMode
}

export function BlockRenderer({ block, mode }: BlockRendererProps): ReactElement | null {
  switch (block.type) {
    case 'title': return <TitleBlock block={block} mode={mode} />
    case 'heading': return <HeadingBlock block={block} mode={mode} />
    case 'paragraph': return <ParagraphBlock block={block} mode={mode} />
    case 'question': return <QuestionBlock block={block} mode={mode} />
    case 'list': return <ListBlock block={block} mode={mode} />
    case 'callout': return <CalloutBlock block={block} mode={mode} />
    case 'definition': return <DefinitionBlock block={block} mode={mode} />
    case 'quote': return <QuoteBlock block={block} mode={mode} />
    case 'divider': return <DividerBlock block={block} mode={mode} />
    case 'spacer': return <SpacerBlock block={block} mode={mode} />
    case 'code': return <CodeBlock block={block} mode={mode} />
    case 'table': return <TableBlock block={block} mode={mode} />
    case 'image': return <ImageBlock block={block} mode={mode} />
    case 'diagram': return <DiagramBlock block={block} mode={mode} />
    case 'raw-html': return <RawHtmlBlock block={block} mode={mode} />
    default:
      // Exhaustiveness check — if a new block type is added to the union,
      // this branch will trigger a TS error in the noUnusedLocals build.
      return null
  }
}

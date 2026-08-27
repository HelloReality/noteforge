// NoteForge — import pipeline (§9)
// Server-only glue between the parser and storage. Parses `.note.html` text
// via the note-format library, then creates a Document + first Version.
//
// Structural errors (no <note-document>) surface as a typed `ImportError` so
// the API route handler can map them cleanly to HTTP 400.

import { parseNoteHtml } from '@/lib/note-format/parse'
import type { Warning } from '@/lib/note-format/types'
import { WarningCode } from '@/lib/note-format/types'
import { createDocumentFromImport } from '@/lib/server/storage'

export interface ImportSuccess {
  documentId: string
  versionId: string
  warnings: Warning[]
  title: string
}

/**
 * Import a `.note.html` file: parse → persist.
 *
 * `filename` is purely informational (used in error messages); only `fileText`
 * is parsed. On a structural error (no <note-document>) we throw `ImportError`
 * so the caller can return a 400 without leaking a stack trace.
 */
export async function importNoteHtml(filename: string, fileText: string): Promise<ImportSuccess> {
  const { model, warnings } = parseNoteHtml(fileText)

  // Structural error: parser sets level:'error' STRUCTURAL_ERROR on a missing
  // <note-document>. Treat any error-level warning as a hard stop.
  const structuralError = warnings.find(
    (w) => w.level === 'error' && w.code === WarningCode.STRUCTURAL_ERROR,
  )
  if (structuralError) {
    throw new ImportError(
      'STRUCTURAL_ERROR',
      `Import failed for "${filename}": ${structuralError.message}`,
    )
  }

  const { documentId, versionId } = await createDocumentFromImport(model, warnings)
  return { documentId, versionId, warnings, title: model.title }
}

/** Typed error thrown by `importNoteHtml` on a structural failure. */
export class ImportError extends Error {
  readonly code: 'STRUCTURAL_ERROR'
  constructor(code: 'STRUCTURAL_ERROR', message: string) {
    super(message)
    this.name = 'ImportError'
    this.code = code
  }
}

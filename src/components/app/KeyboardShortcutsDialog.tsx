// NoteForge — keyboard shortcuts help dialog.
'use client'

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

export interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], label: 'Undo last change' },
  { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo (or Ctrl+Y)' },
  { keys: ['Ctrl', 'S'], label: 'Save a new version' },
  { keys: ['Ctrl', 'E'], label: 'Export as .note.html' },
  { keys: ['Ctrl', 'K'], label: 'Focus the title field' },
  { keys: ['?'], label: 'Show this dialog' },
] as const

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-amber-600" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your editing with these shortcuts. On macOS, use ⌘ instead of Ctrl.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-stone-50"
            >
              <span className="text-sm text-stone-700">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-xs text-stone-300">+</span>}
                    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-stone-300 bg-stone-50 px-1.5 font-mono text-xs font-semibold text-stone-700 shadow-sm">
                      {k}
                    </kbd>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Shortcuts are active while the editor is focused.
        </p>
      </DialogContent>
    </Dialog>
  )
}

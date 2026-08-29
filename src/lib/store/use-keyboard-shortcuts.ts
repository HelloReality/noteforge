// NoteForge — keyboard shortcuts hook for the editor (§12).
// Binds: Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z or Ctrl+Y (redo),
// Ctrl/Cmd+S (save), Ctrl/Cmd+E (export), Ctrl/Cmd+K (focus title).
// Also binds: Delete/Backspace (delete selected block), ArrowUp/Down/Left/Right
// (move selected block by 1px or reorder via Shift+Arrow).
// Prevents default browser behavior for these combos while the editor is mounted.

'use client'

import { useEffect, type RefObject } from 'react'
import { useEditorStore } from '@/lib/store/editor-store'

export interface KeyboardShortcutsOptions {
  onSave: () => void
  onExport: () => void
  canSave: boolean
  titleRef?: RefObject<HTMLInputElement | null>
}

export function useEditorKeyboardShortcuts({
  onSave, onExport, canSave, titleRef,
}: KeyboardShortcutsOptions) {
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const selectedPath = useEditorStore((s) => s.selectedPath)
  const deleteBlock = useEditorStore((s) => s.deleteBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Delete / Backspace: delete the selected block (only when not typing
      // in an input/textarea/contenteditable — those handle their own deletion).
      const target = e.target as HTMLElement
      const isEditing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable

      if (!isEditing && selectedPath && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        deleteBlock(selectedPath)
        return
      }

      // ArrowUp/Down with Shift: reorder selected block up/down
      // ArrowUp/Down without Shift: move block up/down too (convenient for the outline)
      if (!isEditing && selectedPath && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        moveBlock(selectedPath, e.key === 'ArrowUp' ? 'up' : 'down')
        return
      }

      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const key = e.key.toLowerCase()

      // Undo: Ctrl+Z (not Shift)
      if (key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault()
          undo()
        }
        return
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((key === 'z' && e.shiftKey) || key === 'y') {
        if (canRedo) {
          e.preventDefault()
          redo()
        }
        return
      }
      // Save: Ctrl+S
      if (key === 's') {
        e.preventDefault()
        if (canSave) onSave()
        return
      }
      // Export: Ctrl+E
      if (key === 'e') {
        e.preventDefault()
        onExport()
        return
      }
      // Focus title: Ctrl+K
      if (key === 'k') {
        e.preventDefault()
        titleRef?.current?.focus()
        titleRef?.current?.select()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, canUndo, canRedo, canSave, onSave, onExport, titleRef, selectedPath, deleteBlock, moveBlock])
}

// NoteForge — Shared Renderer public API.
//
// The pages agent renders `<NoteRenderer doc={model} mode="..." />`. This
// barrel re-exports the named export. Block-level components and the
// diagram client components are reachable through the renderer but are not
// part of the public API; import them directly from their files if needed.

export { NoteRenderer, NOTEFORGE_SCOPE } from './NoteRenderer'
export type { NoteRendererProps } from './NoteRenderer'
export type { RenderMode } from './types'

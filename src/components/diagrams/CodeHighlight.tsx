// NoteForge — syntax-highlighted code renderer (client component).
// Uses react-syntax-highlighter (Prism) with a dark theme. Renders a plain
// <code> during SSR (matching the A.2 DOM contract) and upgrades to syntax
// highlighting after hydration.

'use client'

import { useSyncExternalStore } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export interface CodeHighlightProps {
  code: string
  language?: string
  className?: string
}

// Detect client-side rendering without triggering the set-state-in-effect rule.
// useSyncExternalStore returns false on SSR and true on the client after hydration.
const emptySubscribe = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function CodeHighlight({ code, language }: CodeHighlightProps) {
  const mounted = useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot)

  if (!mounted) {
    // SSR + initial hydration: plain <code> (matches the A.2 contract).
    return <code>{code}</code>
  }

  return (
    <SyntaxHighlighter
      language={language || 'text'}
      style={oneDark}
      customStyle={{
        margin: 0,
        background: 'transparent',
        padding: 0,
        fontSize: 'inherit',
        fontFamily: 'inherit',
      }}
      codeTagProps={{ style: { fontFamily: 'inherit', fontSize: 'inherit' } }}
      wrapLongLines
    >
      {code}
    </SyntaxHighlighter>
  )
}

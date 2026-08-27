// NoteForge — app header / top navigation.
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotebookPen, Library, Upload, Github } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-stone-50/85 backdrop-blur supports-[backdrop-filter]:bg-stone-50/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-stone-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
            <NotebookPen className="h-4 w-4" />
          </span>
          <span className="text-base">NoteForge</span>
          <span className="hidden text-xs font-normal text-stone-400 sm:inline">visual notes</span>
        </Link>
        <nav className="ml-2 flex items-center gap-1 text-sm">
          <NavLink href="/" active={pathname === '/'} icon={<Library className="h-4 w-4" />}>Library</NavLink>
          <NavLink href="/import" active={pathname?.startsWith('/import') ?? false} icon={<Upload className="h-4 w-4" />}>Import</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-stone-400">
          <span className="hidden sm:inline">visual-notes/1</span>
          <a
            href="https://spec.example/noteforge"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-700"
            aria-label="Spec"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  )
}

function NavLink({ href, active, icon, children }: {
  href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition',
        active ? 'bg-amber-100 text-amber-900' : 'text-stone-600 hover:bg-stone-200/60 hover:text-stone-900',
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

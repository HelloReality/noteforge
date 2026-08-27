// NoteForge — warnings panel (§9.1): grouped, color-coded, with counts.
import type { Warning } from '@/lib/note-format/types'
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const LEVEL_META = {
  error: { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  warn: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  info: { icon: Info, color: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-200' },
} as const

export function WarningsPanel({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-semibold">Zero warnings</span>
        </div>
        <p className="mt-1.5 text-xs text-emerald-700">
          The import met the structural and sanitization contract with no dropped content.
        </p>
      </div>
    )
  }

  // group by code
  const byCode = new Map<string, Warning[]>()
  for (const w of warnings) {
    const arr = byCode.get(w.code) || []
    arr.push(w)
    byCode.set(w.code, arr)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Warnings</h3>
        <span className="text-xs text-stone-400">{warnings.length} total</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="errors" count={warnings.filter(w => w.level === 'error').length} tone="rose" />
        <Stat label="warns" count={warnings.filter(w => w.level === 'warn').length} tone="amber" />
        <Stat label="info" count={warnings.filter(w => w.level === 'info').length} tone="stone" />
      </div>

      <div className="space-y-3">
        {Array.from(byCode.entries()).map(([code, group]) => {
          const top = group[0]
          const meta = LEVEL_META[top.level] ?? LEVEL_META.info
          const Icon = meta.icon
          return (
            <div key={code} className={cn('rounded-lg border p-3', meta.border, meta.bg)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', meta.color)} />
                  <code className="text-xs font-semibold text-stone-800">{code}</code>
                </div>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-stone-600">
                  {group.length}×
                </span>
              </div>
              <p className="mt-1.5 text-xs text-stone-600">{top.message}</p>
              <ul className="mt-2 space-y-1 text-xs text-stone-500">
                {group.slice(0, 6).map((w, i) => (
                  <li key={i} className="flex gap-2 font-mono">
                    <span className="text-stone-400">›</span>
                    <span className="truncate">{w.path}</span>
                  </li>
                ))}
                {group.length > 6 && (
                  <li className="text-stone-400">… and {group.length - 6} more</li>
                )}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, count, tone }: { label: string; count: number; tone: 'rose' | 'amber' | 'stone' }) {
  const styles = {
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    stone: 'bg-stone-50 text-stone-600 border-stone-200',
  }[tone]
  return (
    <div className={cn('rounded-lg border py-2', styles)}>
      <div className="text-lg font-bold leading-none">{count}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  )
}

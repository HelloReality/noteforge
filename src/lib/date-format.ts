// NoteForge — Stable date formatting utilities.
// All formatters here produce timezone- and locale-independent strings so the
// server-rendered HTML matches the client-hydrated HTML (no hydration mismatch).
// For user-facing "local time" displays that must reflect the user's timezone,
// use the `useMounted` pattern + `formatLocalRelative` after mount, or add
// `suppressHydrationWarning` to the element.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Format a Date as "YYYY-MM-DD HH:mm UTC" — stable across server/client. */
export function formatStableDateTime(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const mm = String(date.getUTCMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm} UTC`
}

/** Format a Date as "Mon DD, YYYY" (e.g. "Aug 28, 2026") — stable, UTC. */
export function formatStableDate(date: Date): string {
  const m = MONTHS_SHORT[date.getUTCMonth()]
  const d = date.getUTCDate()
  const y = date.getUTCFullYear()
  return `${m} ${d}, ${y}`
}

/** Format a Date as "Month DD, YYYY" (e.g. "August 28, 2026") — stable, UTC. */
export function formatStableDateLong(date: Date): string {
  const m = MONTHS_LONG[date.getUTCMonth()]
  const d = date.getUTCDate()
  const y = date.getUTCFullYear()
  return `${m} ${d}, ${y}`
}

/**
 * Relative time formatter that is timezone-independent (uses elapsed
 * milliseconds only). For periods > 7 days, returns a stable UTC date
 * string instead of `toLocaleDateString()`.
 */
export function formatStableRelative(date: Date, nowMs: number = Date.now()): string {
  const diffMs = nowMs - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  if (day < 365) return formatStableDate(date)
  return `${date.getUTCFullYear()}`
}

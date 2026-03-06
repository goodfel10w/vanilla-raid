import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CLS, CLASS_SPECS, SLOTS, ROLES } from '@/lib/constants'
import type { RoleName, DayName, AvailabilityMap } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** HTML escape for XSS protection */
export function h(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Get WoW class color */
export function cc(className: string): string {
  return CLS.find(c => c.name === className)?.color || '#ccc'
}

/** Infer roles from selected specs */
export function specsToRoles(className: string, specs: string[]): RoleName[] {
  const cspecs = CLASS_SPECS[className] || []
  const rs = new Set<RoleName>()
  ;(specs || []).forEach(s => {
    const sp = cspecs.find(c => c.name === s)
    if (sp) rs.add(sp.role)
  })
  return ROLES.filter(r => rs.has(r))
}

/** Add minutes to time string HH:MM */
export function addMins(t: string, m: number): string {
  const [hh, nn] = t.split(':').map(Number)
  const s = hh * 60 + nn + m
  return String(Math.floor(s / 60) % 24).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

/** Get 4 quarter-hour slots for an hour label */
export function hourQuarters(hLabel: string): string[] {
  return [0, 15, 30, 45].map(m => hLabel + ':' + String(m).padStart(2, '0'))
}

/** Collapse availability slots into ranges for display */
export function collapseRanges(avail: AvailabilityMap, day: string): { start: string; end: string; type: string }[] {
  const ds = SLOTS.filter(s => avail[day + '_' + s])
  if (!ds.length) return []
  const ranges: { start: string; end: string; type: string }[] = []
  let rs = ds[0], re = ds[0], rt = avail[day + '_' + ds[0]]
  for (let i = 1; i < ds.length; i++) {
    const s = ds[i], v = avail[day + '_' + s]
    if (SLOTS.indexOf(s) === SLOTS.indexOf(re) + 1 && v === rt) {
      re = s
    } else {
      ranges.push({ start: rs, end: addMins(re, 15), type: rt })
      rs = s; re = s; rt = v
    }
  }
  ranges.push({ start: rs, end: addMins(re, 15), type: rt })
  return ranges
}

/** Migrate legacy 2h-range availability to 15-min slots */
export function migrateLegacyAvail(av: Record<string, any>): AvailabilityMap {
  if (!av || typeof av !== 'object') return {}
  const out: AvailabilityMap = {}
  for (const [k, v] of Object.entries(av)) {
    const sep = k.indexOf('_')
    if (sep < 0) continue
    const day = k.substring(0, sep)
    const slot = k.substring(sep + 1)
    const val = v === true ? 'yes' : v as 'yes' | 'tentative'
    if (slot.includes('\u2013')) {
      const [st, en] = slot.split('\u2013')
      const [sh, sm] = st.split(':').map(Number)
      let [eh, em] = en.split(':').map(Number)
      if (eh === 0 && em === 0) eh = 24
      for (let t = sh * 60 + sm; t < eh * 60 + em; t += 15) {
        const tk = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0')
        out[day + '_' + tk] = val
      }
    } else {
      out[k] = val
    }
  }
  return out
}

/** Convert [Item Name] to Wowhead TBC search links */
export function linkItems(text: string): string {
  if (!text) return ''
  const escaped = h(text)
  return escaped.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    const q = encodeURIComponent(
      name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    )
    return `<a class="item-link" href="https://www.wowhead.com/tbc/search?q=${q}" target="_blank" rel="noopener">${name}</a>`
  })
}

/** Escape a value for CSV output */
export function csvVal(str: string | number): string {
  const s = String(str)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** Format ISO date to German format */
export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const DE_DAYS: DayName[] = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

/** Convert YYYY-MM-DD date string to German weekday name */
export function getGermanWeekday(dateStr: string): DayName {
  const d = new Date(dateStr + 'T12:00:00')
  return DE_DAYS[d.getDay()]
}

/** Get the current WoW weekly reset window (Wednesday → Tuesday) */
export function getWeeklyResetWindow(now?: Date): { start: Date; end: Date } {
  const n = now ? new Date(now) : new Date()
  const jsDay = n.getDay()
  const daysSinceWed = (jsDay + 4) % 7
  const start = new Date(n)
  start.setDate(start.getDate() - daysSinceWed)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

/** Relative time display */
export function timeAgo(iso: string): string {
  if (!iso) return ''
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'gerade eben'
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`
  return formatDate(iso)
}

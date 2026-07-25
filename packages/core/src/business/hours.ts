// Branch operating-hours logic — Africa/Cairo explicit, `now` always injected.
// Supports 24/7 ("00:00"–"24:00"), per-day ranges, the Friday-different pattern,
// and midnight-crossing ranges (open > close).

import { formatTimeShortAr } from './format'

export type DayKey = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

export interface BranchDayHours {
  open: string | null
  close: string | null
  closed: boolean
}

export type BranchHours = Record<DayKey, BranchDayHours>

const DAY_KEYS: DayKey[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']
const CAIRO_TIME_ZONE = 'Africa/Cairo'
const MINUTES_PER_DAY = 1440

const CAIRO_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO_TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Sat: 'sat',
  Sun: 'sun',
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
}

/** Narrows the branches.operating_hours JSONB to BranchHours. Unknown/missing days → closed. */
export function parseBranchHours(json: unknown): BranchHours | null {
  if (typeof json !== 'object' || json === null) return null
  const source = json as Record<string, unknown>
  const result = {} as BranchHours
  for (const key of DAY_KEYS) {
    const day = source[key]
    if (typeof day !== 'object' || day === null) {
      result[key] = { open: null, close: null, closed: true }
      continue
    }
    const candidate = day as Record<string, unknown>
    result[key] = {
      open: typeof candidate.open === 'string' ? candidate.open : null,
      close: typeof candidate.close === 'string' ? candidate.close : null,
      closed: candidate.closed === true,
    }
  }
  return result
}

function timeToMinutes(time: string): number {
  const [hourStr = '0', minuteStr = '0'] = time.split(':')
  return Number(hourStr) * 60 + Number(minuteStr)
}

function getCairoDayAndMinutes(now: Date): { dayKey: DayKey; minutes: number } {
  const parts = CAIRO_CLOCK.formatToParts(now)
  const weekday = parts.find((part) => part.type === 'weekday')?.value ?? 'Sat'
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0')
  return { dayKey: WEEKDAY_TO_KEY[weekday] ?? 'sat', minutes: hour * 60 + minute }
}

/** Is the branch open at `now` (Egypt wall clock)? */
export function isBranchOpenNow(hours: BranchHours, now: Date): boolean {
  const { dayKey, minutes } = getCairoDayAndMinutes(now)
  const day = hours[dayKey]
  if (day.closed || day.open === null || day.close === null) return false

  const openMinutes = timeToMinutes(day.open)
  const closeMinutes = timeToMinutes(day.close)
  if (openMinutes === 0 && closeMinutes === MINUTES_PER_DAY) return true // 24/7
  if (closeMinutes > openMinutes) return minutes >= openMinutes && minutes < closeMinutes
  // Midnight-crossing range (e.g. 20:00–02:00)
  return minutes >= openMinutes || minutes < closeMinutes
}

export interface OpenStatus {
  isOpen: boolean
  /** "١٠م" — today's closing time for the "مفتوح حتى …" chip; null for 24/7 branches. */
  closeLabelAr: string | null
}

export function getOpenStatus(hours: BranchHours, now: Date): OpenStatus {
  const isOpen = isBranchOpenNow(hours, now)
  const { dayKey } = getCairoDayAndMinutes(now)
  const day = hours[dayKey]
  if (!isOpen || day.close === null || day.open === null) return { isOpen, closeLabelAr: null }

  const isAlwaysOpen = timeToMinutes(day.open) === 0 && timeToMinutes(day.close) === MINUTES_PER_DAY
  if (isAlwaysOpen) return { isOpen, closeLabelAr: null }
  return { isOpen, closeLabelAr: formatTimeShortAr(day.close) }
}

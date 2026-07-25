// buildSlotDaySections() — the F05 slot-picker data shape: date strip + per-day
// period grouping (صباحاً / ظهراً / مساءً), Cairo wall-clock, data-driven from
// the actual slot rows. Display math only — the DB functions stay authoritative
// for whether a hold actually lands.

import { SLOT_WINDOW_DAYS } from '../constants'
import type { SlotStatus } from '../types/domain.types'
import { toArabicDigits } from './format'
import { getSlotStatus } from './slots'

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }) // YYYY-MM-DD
const CAIRO_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const CAIRO_WEEKDAY_AR = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  weekday: 'long',
})
const DAY_MS = 24 * 60 * 60 * 1000

/** Period boundaries (Egypt wall-clock hours). */
const AFTERNOON_START_HOUR = 12
const EVENING_START_HOUR = 17

export type SlotPeriodKey = 'morning' | 'afternoon' | 'evening'

const PERIOD_LABELS_AR: Record<SlotPeriodKey, string> = {
  morning: 'صباحاً',
  afternoon: 'ظهراً',
  evening: 'مساءً',
}

/** The raw availability row as queried — snake_case mapped by the app. */
export interface SlotSectionInput {
  id: string
  slotDate: string // YYYY-MM-DD
  slotTime: string // HH:MM[:SS]
  capacity: number | null
  bookedCount: number | null
  isBlocked: boolean | null
}

export interface SlotPickerSlot {
  id: string
  slotDate: string
  slotTime: string
  status: SlotStatus
}

export interface SlotPeriod {
  key: SlotPeriodKey
  labelAr: string
  slots: SlotPickerSlot[]
}

export interface SlotDaySection {
  date: string // YYYY-MM-DD (Egypt wall-clock)
  /** "اليوم" / "غداً" / weekday name — the date-strip label. */
  dayLabelAr: string
  /** "٢٢" — the big day-of-month figure. */
  dayNumberAr: string
  /** False when every slot that day is full/blocked — strip renders it disabled. */
  hasAvailability: boolean
  periods: SlotPeriod[]
}

function getPeriodKey(slotTime: string): SlotPeriodKey {
  const hour = Number(slotTime.split(':')[0] ?? '0')
  if (hour < AFTERNOON_START_HOUR) return 'morning'
  if (hour < EVENING_START_HOUR) return 'afternoon'
  return 'evening'
}

function getDayLabelAr(date: string, today: string, tomorrow: string): string {
  if (date === today) return 'اليوم'
  if (date === tomorrow) return 'غداً'
  return CAIRO_WEEKDAY_AR.format(new Date(`${date}T12:00:00Z`))
}

/**
 * Groups slot rows into ascending day sections with period sub-groups.
 * - Past slots (today, time already gone in Cairo) are dropped.
 * - Days beyond SLOT_WINDOW_DAYS are dropped (the generation ceiling).
 * - Sections exist only for days that actually have slot rows — data-driven.
 * - Slot status comes from getSlotStatus with holds=0: other patients' holds
 *   are invisible under RLS, so the RPC rejection is the real availability gate.
 */
export function buildSlotDaySections(slots: SlotSectionInput[], now: Date): SlotDaySection[] {
  const today = CAIRO_DATE.format(now)
  const tomorrow = CAIRO_DATE.format(new Date(now.getTime() + DAY_MS))
  const windowEnd = CAIRO_DATE.format(new Date(now.getTime() + SLOT_WINDOW_DAYS * DAY_MS))
  const nowTime = CAIRO_TIME.format(now)

  const sectionsByDate = new Map<string, SlotDaySection>()

  const inWindow = slots
    .filter((slot) => {
      if (slot.slotDate < today || slot.slotDate > windowEnd) return false
      const isPastToday = slot.slotDate === today && slot.slotTime.slice(0, 5) <= nowTime
      return !isPastToday
    })
    .sort((a, b) =>
      a.slotDate === b.slotDate
        ? a.slotTime.localeCompare(b.slotTime)
        : a.slotDate.localeCompare(b.slotDate),
    )

  for (const slot of inWindow) {
    const status = getSlotStatus({
      capacity: slot.capacity ?? Number.MAX_SAFE_INTEGER,
      bookedCount: slot.bookedCount ?? 0,
      activeHoldCount: 0,
      isBlocked: slot.isBlocked ?? false,
    })
    const pickerSlot: SlotPickerSlot = {
      id: slot.id,
      slotDate: slot.slotDate,
      slotTime: slot.slotTime,
      status,
    }

    let section = sectionsByDate.get(slot.slotDate)
    if (!section) {
      section = {
        date: slot.slotDate,
        dayLabelAr: getDayLabelAr(slot.slotDate, today, tomorrow),
        dayNumberAr: toArabicDigits(String(Number(slot.slotDate.slice(8, 10)))),
        hasAvailability: false,
        periods: [],
      }
      sectionsByDate.set(slot.slotDate, section)
    }

    const periodKey = getPeriodKey(slot.slotTime)
    let period = section.periods.find((candidate) => candidate.key === periodKey)
    if (!period) {
      period = { key: periodKey, labelAr: PERIOD_LABELS_AR[periodKey], slots: [] }
      section.periods.push(period)
    }
    period.slots.push(pickerSlot)
    if (status === 'available') section.hasAvailability = true
  }

  return [...sectionsByDate.values()]
}

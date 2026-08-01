// Slot display/selection math — RENDERING AND OPTIMISTIC UX ONLY.
//
// The Postgres functions are AUTHORITATIVE: `create_slot_hold()` decides whether
// a hold exists, `confirm_booking()` decides whether a booking lands, and the
// `cleanup-holds` cron releases expired holds. These helpers only interpret rows
// already returned by a query so the UI can render statuses and countdowns.
// A hold that looks valid client-side can still be rejected by `confirm_booking()`
// — the apps must handle that RPC error path.

import { HOLD_WARNING_SECONDS, SLOT_HOLD_MINUTES } from '../constants'
import type { SlotStatus } from '../types/domain.types'

const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/** Availability inputs as returned by the slot query — core interprets, it never counts holds itself. */
export interface SlotAvailability {
  capacity: number
  bookedCount: number
  activeHoldCount: number
  isBlocked: boolean
}

/** 'full' when blocked, or when booked + active holds have consumed capacity.
 * THE shared availability definition: the same predicate `create_slot_hold`
 * and the `trg_slot_holds_capacity` trigger enforce server-side
 * (booked_count + active unexpired holds < capacity). Display must always be
 * fed real hold counts (get_branch_slots RPC) so UI state and DB enforcement
 * can never disagree. */
export function getSlotStatus(slot: SlotAvailability): SlotStatus {
  if (slot.isBlocked) return 'full'
  if (slot.bookedCount + slot.activeHoldCount >= slot.capacity) return 'full'
  return 'available'
}

/** Client-side mirror of the DB hold expiry: created_at + SLOT_HOLD_MINUTES. */
export function holdExpiresAt(createdAt: Date): Date {
  return new Date(
    createdAt.getTime() + SLOT_HOLD_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
  )
}

/** Whole seconds remaining on a hold, clamped at 0. `now` is a parameter — no hidden Date.now(). */
export function getRemainingHoldSeconds(expiresAt: Date, now: Date): number {
  const remainingMs = expiresAt.getTime() - now.getTime()
  if (remainingMs <= 0) return 0
  return Math.floor(remainingMs / MILLISECONDS_PER_SECOND)
}

/** True under HOLD_WARNING_SECONDS — drives the calm→amber countdown state. */
export function isHoldExpiringSoon(remainingSeconds: number): boolean {
  return remainingSeconds < HOLD_WARNING_SECONDS
}

export type HoldChipState = 'calm' | 'warning' | 'expired'

/** Single source for the hold-chip UI state (approved calm→amber design):
 * calm while comfortable, warning under HOLD_WARNING_SECONDS, expired at 0. */
export function getHoldChipState(remainingSeconds: number): HoldChipState {
  if (remainingSeconds <= 0) return 'expired'
  if (isHoldExpiringSoon(remainingSeconds)) return 'warning'
  return 'calm'
}

/** "٠٩:٢٣" — the MM:SS countdown figure (Arabic-Indic, zero-padded). */
export function formatHoldCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, remainingSeconds)
  const minutes = String(Math.floor(clamped / SECONDS_PER_MINUTE)).padStart(2, '0')
  const seconds = String(clamped % SECONDS_PER_MINUTE).padStart(2, '0')
  return toArabicDigits(`${minutes}:${seconds}`)
}

// ── First-available-slot label (Home provider cards) ─────────────────────────

import { formatTimeShortAr, toArabicDigits, type SupportedLocale } from './format'

export interface FirstAvailableSlot {
  slotDate: string // YYYY-MM-DD (Egypt wall-clock date)
  slotTime: string // HH:MM[:SS]
}

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }) // YYYY-MM-DD
const CAIRO_WEEKDAY_AR = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  weekday: 'long',
})
const CAIRO_WEEKDAY_EN = new Intl.DateTimeFormat('en-EG', {
  timeZone: 'Africa/Cairo',
  weekday: 'long',
})
const DAY_MS = 24 * 60 * 60 * 1000

function slotDateAtNoonUtc(slotDate: string): Date {
  return new Date(`${slotDate}T12:00:00Z`)
}

function formatTimeShortEn(time: string): string {
  const [hourStr = '0', minuteStr = '00'] = time.split(':')
  const hour = Number(hourStr) % 24
  const minute = Number(minuteStr)
  const suffix = hour < 12 ? 'AM' : 'PM'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`
}

/** "اليوم ٣:٣٠م" / "غداً ٩ص" / "الأحد ٩ص" — the Home-card first-slot line. */
export function getFirstAvailableSlotLabel(
  slot: FirstAvailableSlot,
  now: Date,
  locale: SupportedLocale = 'ar',
): string {
  const today = CAIRO_DATE.format(now)
  const tomorrow = CAIRO_DATE.format(new Date(now.getTime() + DAY_MS))
  const timeLabel =
    locale === 'ar' ? formatTimeShortAr(slot.slotTime) : formatTimeShortEn(slot.slotTime)

  if (slot.slotDate === today) return locale === 'ar' ? `اليوم ${timeLabel}` : `Today ${timeLabel}`
  if (slot.slotDate === tomorrow)
    return locale === 'ar' ? `غداً ${timeLabel}` : `Tomorrow ${timeLabel}`

  const weekdayFormatter = locale === 'ar' ? CAIRO_WEEKDAY_AR : CAIRO_WEEKDAY_EN
  return `${weekdayFormatter.format(slotDateAtNoonUtc(slot.slotDate))} ${timeLabel}`
}

// ── Slot allocation view (P04) ───────────────────────────────────────────────

/** What a single slot looks like on the branch's daily allocation grid.
 *
 * Deliberately DERIVED from `getSlotStatus` rather than re-deciding fullness:
 * the picker, `create_slot_hold` and the capacity trigger all mean the same
 * thing by "full" (booked + active holds >= capacity), and SPEC-P04 requires
 * the dashboard to show that same predicate rather than invent a second one.
 * This function only splits the reasons apart for display.
 */
export type SlotAllocationState = 'blocked' | 'booked' | 'held' | 'past' | 'available'

export interface AllocationSlot extends SlotAvailability {
  /** YYYY-MM-DD, Egypt wall clock. */
  slotDate: string
  /** HH:MM[:SS], Egypt wall clock. */
  slotTime: string
}

/**
 * Precedence — blocked → booked → held → past → available.
 *
 * `booked` outranks `past` on purpose: a slot that already happened AND has a
 * patient must keep reading as that patient's appointment, not as dead time.
 * The design makes the same call (a booked cell keeps its colour once the hour
 * has gone by); an empty past slot is the one that greys out.
 *
 * `now` is INJECTED — no hidden `Date.now()` (core discipline §7), and Cairo
 * wall clock throughout because slots are Egyptian local times.
 */
export function getSlotAllocationState(
  slot: AllocationSlot,
  now: { cairoTodayIso: string; cairoNowHHMM: string },
): SlotAllocationState {
  if (slot.isBlocked) return 'blocked'
  if (slot.bookedCount >= slot.capacity) return 'booked'
  // Full without being fully booked ⇒ live holds are consuming the remainder.
  // This is the F05 lesson: a slot the picker refuses must not read "متاح" here.
  if (getSlotStatus(slot) === 'full') return 'held'
  if (isSlotInThePast(slot, now)) return 'past'
  return 'available'
}

/** A slot is past once its own start time has gone by, on today only —
 * a future DATE is never past regardless of the clock. */
export function isSlotInThePast(
  slot: Pick<AllocationSlot, 'slotDate' | 'slotTime'>,
  now: { cairoTodayIso: string; cairoNowHHMM: string },
): boolean {
  if (slot.slotDate < now.cairoTodayIso) return true
  if (slot.slotDate > now.cairoTodayIso) return false
  return slot.slotTime.slice(0, 5) <= now.cairoNowHHMM
}

/** Booked-vs-capacity for the day, from the SAME rows the grid renders — so the
 * summary can never disagree with the cells beneath it. */
export function summarizeDayAllocation(slots: AllocationSlot[]): {
  booked: number
  capacity: number
  fillPercent: number
} {
  const booked = slots.reduce((total, slot) => total + Math.min(slot.bookedCount, slot.capacity), 0)
  const capacity = slots.reduce((total, slot) => total + slot.capacity, 0)
  const fillPercent = capacity === 0 ? 0 : Math.round((booked / capacity) * 100)
  return { booked, capacity, fillPercent }
}

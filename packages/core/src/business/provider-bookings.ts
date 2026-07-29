// P01 — the receptionist's view of a booking. Pure functions with `now`
// injected, shared so the dashboard and any future admin surface derive the
// same row state from the same rules.

import { getBookingPaymentLabelAr, type BookingStatus, type BookingStatusChip } from './bookings'
import { toArabicDigits } from './format'
import type { ConfirmedBookingService } from './payment'

/** One row of `get_branch_bookings_for_date()`, in domain shape. That function
 * is SECURITY DEFINER because `users` has no provider SELECT policy — a
 * receptionist cannot read patient name/phone from a table query. */
export interface BranchBooking {
  id: string
  bookingRef: string | null
  status: BookingStatus
  paymentStatus: 'pending' | 'paid' | 'cash' | 'refunded' | 'failed'
  method: string | null
  totalEgp: number
  patientNotes: string | null
  slotId: string
  /** Egypt wall-clock calendar date, "YYYY-MM-DD". Compare against
   * `formatCairoIsoDate(now)`, never against a UTC-derived date. */
  slotDate: string
  /** Egypt wall clock, "HH:MM:SS". */
  slotTime: string
  createdAt: string
  confirmedAt: string | null
  arrivedAt: string | null
  completedAt: string | null
  noShowAt: string | null
  cancelledAt: string | null
  /** Who cancelled. VERIFIED server-side against the caller's real capacity
   * since migration 20260729021321 — before that the client named itself and
   * the database believed it. */
  cancelledBy: 'patient' | 'provider' | 'admin' | null
  cancellationReason: string | null
  /** Who closed the booking out. `'system'` means the nightly auto-close
   * GUESSED rather than anyone at the desk deciding — see
   * DECISION-booking-outcome-lifecycle. Never collapse it into the status. */
  closedBy: 'provider' | 'admin' | 'system' | null
  patientNameAr: string | null
  patientPhone: string | null
  services: ConfirmedBookingService[]
}

/** The outcomes a receptionist can record. Mirrors `mark_booking_outcome`. */
export const BOOKING_OUTCOMES = ['arrived', 'completed', 'no_show'] as const
export type BookingOutcome = (typeof BOOKING_OUTCOMES)[number]

/**
 * The legal transition table, mirroring `mark_booking_outcome` exactly.
 * DISPLAY PREDICATE = ENFORCEMENT PREDICATE (ENGINEERING-WORKFLOW §1.4): the
 * button the desk sees must be one the server will accept. Change one, change
 * both, in the same PR.
 */
const LEGAL_TRANSITIONS: Record<BookingOutcome, readonly BookingStatus[]> = {
  arrived: ['confirmed', 'pending_payment'],
  completed: ['arrived'],
  no_show: ['confirmed', 'pending_payment', 'arrived'],
}

/** The transition table ALONE, with no regard to which day it is. Exported for
 * the tests that pin it against `mark_booking_outcome`; UI code wants the
 * date-aware {@link canMarkOutcomeOn} instead. */
export function canMarkOutcome(booking: BranchBooking, outcome: BookingOutcome): boolean {
  return LEGAL_TRANSITIONS[outcome].includes(booking.status)
}

/**
 * You cannot mark tomorrow's patient arrived.
 *
 * P02 renders the SAME rows on Today and on Upcoming Days, so "no outcome
 * actions on a future day" needs a predicate rather than a screen convention —
 * otherwise the two views drift the first time someone reuses the row. Both
 * sides are bare Egypt wall-clock dates, so this is a plain string compare and
 * no timezone maths is involved.
 *
 * `mark_booking_outcome` enforces the same rule server-side and returns
 * `slot_in_future` (migration 20260729021321). Display predicate = enforcement
 * predicate (ENGINEERING-WORKFLOW §1.4). Change one, change both.
 */
export function isFutureSlotDate(booking: BranchBooking, cairoTodayIso: string): boolean {
  return booking.slotDate > cairoTodayIso
}

export function canMarkOutcomeOn(
  booking: BranchBooking,
  outcome: BookingOutcome,
  cairoTodayIso: string,
): boolean {
  if (isFutureSlotDate(booking, cairoTodayIso)) return false
  return canMarkOutcome(booking, outcome)
}

export interface OutcomeAction {
  outcome: BookingOutcome
  labelAr: string
}

/**
 * The ONE primary action per row, per the approved design:
 *   confirmed | pending_payment → [وصل]
 *   arrived                     → [تمت الخدمة]
 * Anything terminal — or anything not yet due — has no primary action.
 *
 * `cairoTodayIso` is REQUIRED rather than optional on purpose: an optional
 * parameter is one a caller forgets, and forgetting it here would silently
 * offer وصل on tomorrow's rows.
 */
export function getPrimaryOutcomeAction(
  booking: BranchBooking,
  cairoTodayIso: string,
): OutcomeAction | null {
  if (canMarkOutcomeOn(booking, 'arrived', cairoTodayIso)) {
    return { outcome: 'arrived', labelAr: 'وصل' }
  }
  if (canMarkOutcomeOn(booking, 'completed', cairoTodayIso)) {
    return { outcome: 'completed', labelAr: 'تمت الخدمة' }
  }
  return null
}

/** Whether to offer [لم يحضر] alongside the primary action. */
export function canMarkNoShow(booking: BranchBooking, cairoTodayIso: string): boolean {
  return canMarkOutcomeOn(booking, 'no_show', cairoTodayIso)
}

/**
 * Whether the desk may cancel this booking on the patient's behalf.
 *
 * Mirrors `cancel_booking` for a STAFF caller: terminal states refuse, and
 * staff are deliberately exempt from the slot-start boundary that binds the
 * patient — reception has to be able to close out a booking whose time has
 * already passed, and a phone cancellation often arrives late.
 */
export function canCancelOnBehalf(booking: BranchBooking): boolean {
  return booking.status !== 'completed' && booking.status !== 'cancelled'
}

/** The nightly job closed this one, not a person. The drawer says so out loud
 * so the desk never reads a machine's guess as a colleague's judgement. */
export function isAutoClosed(booking: BranchBooking): boolean {
  return booking.closedBy === 'system'
}

/**
 * Cash the desk still has to collect. This is the number that decides whether
 * the receptionist asks for money, so it keys off the SAME fields the DB uses:
 * `payment_status = 'cash'` is what confirm_booking writes for a cash booking,
 * and `mark_booking_outcome` flips it to 'paid' on completion.
 */
export function isAwaitingCashCollection(booking: BranchBooking): boolean {
  return booking.paymentStatus === 'cash'
}

/** The design's payment column: "💵 يدفع هنا" vs "✓ تم الدفع". Reuses the
 * patient-side wording so both sides of the loop say the same thing. */
export function getBranchPaymentLabelAr(booking: BranchBooking): string {
  if (isAwaitingCashCollection(booking)) return 'يدفع هنا'
  return getBookingPaymentLabelAr(booking)
}

/** A row whose slot time has already passed — the design greys these. */
export function hasSlotPassed(booking: BranchBooking, now: Date, cairoNowHHMM: string): boolean {
  void now
  return booking.slotTime.slice(0, 5) < cairoNowHHMM
}

/**
 * The fill indicator: "٣/٥ محجوز اليوم". Counts bookings that CONSUME capacity
 * — which is the DB's own definition: `confirm_booking` increments
 * `booked_count` and `cancel_booking` decrements it, so a cancelled booking
 * does not occupy a slot even though the desk still sees its row.
 */
export function countBookedToday(bookings: readonly BranchBooking[]): number {
  return bookings.filter((booking) => booking.status !== 'cancelled').length
}

/** Chips carry the same tone vocabulary as the patient app; `arrived` is the
 * provider-only addition (F07 already added it to the shared map). */
export type ProviderStatusChip = BookingStatusChip

/**
 * "متوقع تحصيله نقداً" on the Upcoming Days summary — what the desk should
 * expect to physically collect that day.
 *
 * Counts only bookings still awaiting cash. A cancelled row is excluded because
 * nobody will pay it, and a completed cash booking is excluded because
 * `mark_booking_outcome` already flipped it to 'paid' — so this number falls as
 * the day is worked, which is the behaviour a desk expects from a "to collect"
 * figure.
 */
export function sumExpectedCashEgp(bookings: readonly BranchBooking[]): number {
  return bookings
    .filter((booking) => booking.status !== 'cancelled' && isAwaitingCashCollection(booking))
    .reduce((total, booking) => total + booking.totalEgp, 0)
}

/**
 * The drawer's "مدة الخدمة المتوقعة X دقيقة" line, from
 * `branches.slot_duration_minutes`.
 *
 * Returns null when the branch has no meaningful value, and the caller renders
 * NOTHING — empty means absent, never a fallback number. Inventing "١٥ دقيقة"
 * for a branch that never declared one would be telling the desk something we
 * do not know.
 *
 * ⚠ The seeded value is a uniform 30 across all 24 branches and no longer
 * describes the slot GRID: since the capacity-model rewrite (20260726151039)
 * spacing is `opening window ÷ allocation` — 150 min at Saridar, 120 at Town.
 * It remains a fair statement of how long a visit TAKES, which is what this
 * line claims, but treat it as a placeholder like the seeded prices until a
 * partner confirms it.
 */
export function formatServiceDurationAr(minutes: number | null | undefined): string | null {
  if (minutes === null || minutes === undefined) return null
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return `مدة الخدمة المتوقعة ${toArabicDigits(String(Math.round(minutes)))} دقيقة`
}

/** One entry in the drawer's «سجل الإجراءات» timeline. */
export interface BookingHistoryEntry {
  key: string
  labelAr: string
  /** Who or what did it — the design's second line. */
  byAr: string
  /** ISO timestamp, for the caller to format. */
  at: string
  tone: 'primary' | 'accent' | 'neutral' | 'error'
}

/**
 * The action history, derived ENTIRELY from the timestamps P01 started
 * stamping. Nothing here is invented: an entry exists only if its column is
 * populated, so a booking that was never marked shows no arrival line.
 *
 * The design's mock also draws an "أُرسل تنبيه التجهيزات — رسالة نصية" row.
 * That is NOT derivable: `notifications` is not exposed to the dashboard and
 * the read function does not return it, so rendering it would be decoration
 * claiming to be a record. Left out deliberately — see the P02 hand-off.
 */
export function getBookingHistory(booking: BranchBooking): BookingHistoryEntry[] {
  const entries: BookingHistoryEntry[] = []

  entries.push({
    key: 'created',
    labelAr: 'أنشأ المريض الحجز',
    byAr: 'تطبيق InstaHealth',
    at: booking.createdAt,
    tone: 'primary',
  })

  if (booking.confirmedAt !== null) {
    entries.push({
      key: 'confirmed',
      labelAr: 'تم تأكيد الموعد',
      byAr: 'تلقائي',
      at: booking.confirmedAt,
      tone: 'primary',
    })
  }
  if (booking.arrivedAt !== null) {
    entries.push({
      key: 'arrived',
      labelAr: 'وصل المريض',
      byAr: 'مكتب الاستقبال',
      at: booking.arrivedAt,
      tone: 'accent',
    })
  }
  if (booking.completedAt !== null) {
    entries.push({
      key: 'completed',
      labelAr: 'تمت الخدمة',
      byAr: 'مكتب الاستقبال',
      at: booking.completedAt,
      tone: 'accent',
    })
  }
  if (booking.noShowAt !== null) {
    entries.push({
      key: 'no_show',
      labelAr: 'لم يحضر المريض',
      // The whole reason closed_by exists: a system guess must never read as a
      // colleague's judgement.
      byAr: isAutoClosed(booking) ? 'أُغلق تلقائياً' : 'مكتب الاستقبال',
      at: booking.noShowAt,
      tone: 'neutral',
    })
  }
  if (booking.cancelledAt !== null) {
    entries.push({
      key: 'cancelled',
      labelAr: 'أُلغي الحجز',
      byAr: CANCELLED_BY_LABELS_AR[booking.cancelledBy ?? 'patient'],
      at: booking.cancelledAt,
      tone: 'error',
    })
  }

  return entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

const CANCELLED_BY_LABELS_AR: Record<'patient' | 'provider' | 'admin', string> = {
  patient: 'ألغاه المريض',
  provider: 'ألغاه مكتب الاستقبال',
  admin: 'ألغته إدارة InstaHealth',
}

/** The cancel-on-behalf reason chips, per the approved design. Stored verbatim
 * in `bookings.cancellation_reason`, so they are stable strings, not labels. */
export const CANCEL_ON_BEHALF_REASONS_AR = [
  'اتصل المريض للإلغاء',
  'لم يستطع الحضور',
  'خطأ في الحجز',
] as const
export type CancelOnBehalfReason = (typeof CANCEL_ON_BEHALF_REASONS_AR)[number]

/** Any preparation the patient was told about — the desk needs to know a
 * fasting patient is coming. Empty means absent (no note → no indicator). */
export function requiresPreparation(booking: BranchBooking): boolean {
  return booking.services.some((service) => {
    const note = service.preparationNotesAr
    if (note === null) return false
    const normalized = note.replace(/\s+/g, ' ').trim().toLowerCase()
    if (normalized.length === 0) return false
    return !['لا يشترط', 'no fasting required'].some((prefix) => normalized.startsWith(prefix))
  })
}

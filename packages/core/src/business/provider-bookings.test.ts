import { describe, expect, test } from 'vitest'

import {
  BOOKING_OUTCOMES,
  CANCEL_ON_BEHALF_REASONS_AR,
  canCancelOnBehalf,
  canMarkNoShow,
  canMarkOutcome,
  canMarkOutcomeOn,
  countBookedToday,
  formatServiceDurationAr,
  getBookingHistory,
  getBranchPaymentLabelAr,
  getPrimaryOutcomeAction,
  hasSlotPassed,
  isAutoClosed,
  isAwaitingCashCollection,
  isFutureSlotDate,
  requiresPreparation,
  sumExpectedCashEgp,
  type BranchBooking,
} from './provider-bookings'
import type { BookingStatus } from './bookings'

// January: Cairo is a stable UTC+2 with no DST ambiguity (core convention).
const TODAY = '2026-01-20'
const TOMORROW = '2026-01-21'
const YESTERDAY = '2026-01-19'

function makeBooking(overrides: Partial<BranchBooking> = {}): BranchBooking {
  return {
    id: 'bk-1',
    bookingRef: 'IH-2026-00001',
    status: 'confirmed',
    paymentStatus: 'paid',
    method: 'card',
    totalEgp: 165,
    patientNotes: null,
    slotId: 'slot-1',
    slotDate: TODAY,
    slotTime: '14:00:00',
    createdAt: '2026-01-20T08:00:00Z',
    confirmedAt: null,
    arrivedAt: null,
    completedAt: null,
    noShowAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    closedBy: null,
    patientNameAr: 'أحمد محمود',
    patientPhone: '+201012345678',
    services: [],
    ...overrides,
  }
}

const service = (nameAr: string, prep: string | null) => ({
  id: `svc-${nameAr}`,
  nameAr,
  nameEn: nameAr,
  priceEgp: 100,
  preparationNotesAr: prep,
  preparationNotesEn: null,
})

// These mirror mark_booking_outcome's CASE block exactly. If the migration
// changes, this table is the thing that must change with it.
describe('canMarkOutcome — the legal transition table', () => {
  const cases: [BookingStatus, Record<string, boolean>][] = [
    ['confirmed', { arrived: true, completed: false, no_show: true }],
    ['pending_payment', { arrived: true, completed: false, no_show: true }],
    ['arrived', { arrived: false, completed: true, no_show: true }],
    ['completed', { arrived: false, completed: false, no_show: false }],
    ['no_show', { arrived: false, completed: false, no_show: false }],
    ['cancelled', { arrived: false, completed: false, no_show: false }],
  ]

  for (const [status, expected] of cases) {
    test(`from "${status}"`, () => {
      for (const outcome of BOOKING_OUTCOMES) {
        expect(canMarkOutcome(makeBooking({ status }), outcome)).toBe(expected[outcome])
      }
    })
  }

  test('completed and cancelled are terminal — nothing is legal from them', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as BookingStatus[]) {
      for (const outcome of BOOKING_OUTCOMES) {
        expect(canMarkOutcome(makeBooking({ status }), outcome)).toBe(false)
      }
    }
  })
})

describe('getPrimaryOutcomeAction — the ONE action per row', () => {
  test('confirmed offers وصل', () => {
    expect(getPrimaryOutcomeAction(makeBooking(), TODAY)).toEqual({
      outcome: 'arrived',
      labelAr: 'وصل',
    })
  })

  test('pending_payment also offers وصل — the patient turned up regardless', () => {
    expect(
      getPrimaryOutcomeAction(makeBooking({ status: 'pending_payment' }), TODAY)?.outcome,
    ).toBe('arrived')
  })

  test('arrived offers تمت الخدمة', () => {
    expect(getPrimaryOutcomeAction(makeBooking({ status: 'arrived' }), TODAY)).toEqual({
      outcome: 'completed',
      labelAr: 'تمت الخدمة',
    })
  })

  test('terminal statuses offer nothing', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as BookingStatus[]) {
      expect(getPrimaryOutcomeAction(makeBooking({ status }), TODAY)).toBeNull()
    }
  })

  test('the primary action is always one the server would accept', () => {
    for (const status of ['confirmed', 'pending_payment', 'arrived'] as BookingStatus[]) {
      const booking = makeBooking({ status })
      const action = getPrimaryOutcomeAction(booking, TODAY)
      expect(action).not.toBeNull()
      expect(canMarkOutcome(booking, action!.outcome)).toBe(true)
    }
  })

  test("a FUTURE day offers nothing — you cannot mark tomorrow's patient arrived", () => {
    for (const status of ['confirmed', 'pending_payment', 'arrived'] as BookingStatus[]) {
      expect(getPrimaryOutcomeAction(makeBooking({ status, slotDate: TOMORROW }), TODAY)).toBeNull()
    }
  })

  test('a PAST day still offers its action — the desk closes yesterday out', () => {
    expect(getPrimaryOutcomeAction(makeBooking({ slotDate: YESTERDAY }), TODAY)?.outcome).toBe(
      'arrived',
    )
  })
})

describe('canMarkNoShow', () => {
  test('offered while the patient could still fail to turn up', () => {
    for (const status of ['confirmed', 'pending_payment', 'arrived'] as BookingStatus[]) {
      expect(canMarkNoShow(makeBooking({ status }), TODAY)).toBe(true)
    }
  })

  test('never offered once the booking is closed', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as BookingStatus[]) {
      expect(canMarkNoShow(makeBooking({ status }), TODAY)).toBe(false)
    }
  })

  test('never offered on a future day', () => {
    expect(canMarkNoShow(makeBooking({ slotDate: TOMORROW }), TODAY)).toBe(false)
  })
})

// Mirrors the `slot_in_future` guard added to mark_booking_outcome in
// migration 20260729021321. Display predicate = enforcement predicate.
describe('the future-day rule', () => {
  test('tomorrow is future, today and yesterday are not', () => {
    expect(isFutureSlotDate(makeBooking({ slotDate: TOMORROW }), TODAY)).toBe(true)
    expect(isFutureSlotDate(makeBooking({ slotDate: TODAY }), TODAY)).toBe(false)
    expect(isFutureSlotDate(makeBooking({ slotDate: YESTERDAY }), TODAY)).toBe(false)
  })

  test('it beats an otherwise-legal transition', () => {
    const booking = makeBooking({ status: 'confirmed', slotDate: TOMORROW })
    expect(canMarkOutcome(booking, 'arrived')).toBe(true) // the table alone allows it
    expect(canMarkOutcomeOn(booking, 'arrived', TODAY)).toBe(false) // the day does not
  })

  test('it compares wall-clock date strings, so a year boundary is not special', () => {
    expect(isFutureSlotDate(makeBooking({ slotDate: '2027-01-01' }), '2026-12-31')).toBe(true)
    expect(isFutureSlotDate(makeBooking({ slotDate: '2026-12-31' }), '2027-01-01')).toBe(false)
  })
})

describe('canCancelOnBehalf — the desk-side predicate', () => {
  test('offered on anything still live', () => {
    for (const status of ['confirmed', 'pending_payment', 'arrived'] as BookingStatus[]) {
      expect(canCancelOnBehalf(makeBooking({ status }))).toBe(true)
    }
  })

  test('refused on the two terminal states cancel_booking itself refuses', () => {
    expect(canCancelOnBehalf(makeBooking({ status: 'completed' }))).toBe(false)
    expect(canCancelOnBehalf(makeBooking({ status: 'cancelled' }))).toBe(false)
  })

  test('a no_show is still cancellable, exactly as the RPC allows', () => {
    expect(canCancelOnBehalf(makeBooking({ status: 'no_show' }))).toBe(true)
  })

  test('staff are NOT bound by the slot-start boundary — a past booking still cancels', () => {
    expect(canCancelOnBehalf(makeBooking({ slotDate: YESTERDAY }))).toBe(true)
  })
})

describe('cash collection — the money the desk handles', () => {
  test('a cash booking is awaiting collection', () => {
    expect(isAwaitingCashCollection(makeBooking({ paymentStatus: 'cash' }))).toBe(true)
  })

  test('a prepaid booking is not', () => {
    expect(isAwaitingCashCollection(makeBooking({ paymentStatus: 'paid' }))).toBe(false)
  })

  test('completion clears it — payment_status becomes paid server-side', () => {
    const collected = makeBooking({ status: 'completed', paymentStatus: 'paid', method: 'cash' })
    expect(isAwaitingCashCollection(collected)).toBe(false)
  })

  test('the label is unmissable for cash and quiet for prepaid', () => {
    expect(getBranchPaymentLabelAr(makeBooking({ paymentStatus: 'cash', method: 'cash' }))).toBe(
      'يدفع هنا',
    )
    expect(getBranchPaymentLabelAr(makeBooking({ paymentStatus: 'paid' }))).toBe('تم الدفع')
  })
})

describe('countBookedToday — the fill indicator', () => {
  test('counts everything that consumes capacity', () => {
    const bookings = [
      makeBooking({ id: 'a', status: 'confirmed' }),
      makeBooking({ id: 'b', status: 'arrived' }),
      makeBooking({ id: 'c', status: 'completed' }),
      makeBooking({ id: 'd', status: 'no_show' }),
    ]
    expect(countBookedToday(bookings)).toBe(4)
  })

  test('a cancelled booking does NOT — matching cancel_booking decrementing booked_count', () => {
    const bookings = [
      makeBooking({ id: 'a', status: 'confirmed' }),
      makeBooking({ id: 'b', status: 'cancelled' }),
    ]
    expect(countBookedToday(bookings)).toBe(1)
  })

  test('an empty day is zero, not NaN', () => {
    expect(countBookedToday([])).toBe(0)
  })
})

describe('hasSlotPassed', () => {
  const now = new Date('2026-01-20T12:00:00Z')

  test('an earlier slot has passed', () => {
    expect(hasSlotPassed(makeBooking({ slotTime: '09:00:00' }), now, '14:00')).toBe(true)
  })

  test('a later slot has not', () => {
    expect(hasSlotPassed(makeBooking({ slotTime: '16:00:00' }), now, '14:00')).toBe(false)
  })
})

describe('sumExpectedCashEgp — what the desk should expect to collect', () => {
  test('adds up only the bookings still awaiting cash', () => {
    const bookings = [
      makeBooking({ id: 'a', paymentStatus: 'cash', totalEgp: 165 }),
      makeBooking({ id: 'b', paymentStatus: 'cash', totalEgp: 45 }),
      makeBooking({ id: 'c', paymentStatus: 'paid', totalEgp: 999 }),
    ]
    expect(sumExpectedCashEgp(bookings)).toBe(210)
  })

  test('a cancelled cash booking is excluded — nobody will pay it', () => {
    const bookings = [
      makeBooking({ id: 'a', paymentStatus: 'cash', totalEgp: 165 }),
      makeBooking({ id: 'b', paymentStatus: 'cash', totalEgp: 500, status: 'cancelled' }),
    ]
    expect(sumExpectedCashEgp(bookings)).toBe(165)
  })

  test('a collected cash booking drops out, because completion flips it to paid', () => {
    const collected = makeBooking({ status: 'completed', paymentStatus: 'paid', method: 'cash' })
    expect(sumExpectedCashEgp([collected])).toBe(0)
  })

  test('an empty day is zero, not NaN', () => {
    expect(sumExpectedCashEgp([])).toBe(0)
  })
})

describe('formatServiceDurationAr — empty means absent, never a fallback', () => {
  test('renders the branch value in Arabic digits', () => {
    expect(formatServiceDurationAr(30)).toBe('مدة الخدمة المتوقعة ٣٠ دقيقة')
  })

  test('null, undefined, zero and negatives render NOTHING', () => {
    // Inventing "١٥ دقيقة" for a branch that never declared one would tell the
    // desk something we do not know.
    expect(formatServiceDurationAr(null)).toBeNull()
    expect(formatServiceDurationAr(undefined)).toBeNull()
    expect(formatServiceDurationAr(0)).toBeNull()
    expect(formatServiceDurationAr(-5)).toBeNull()
  })

  test('a non-finite value is absent rather than "NaN دقيقة"', () => {
    expect(formatServiceDurationAr(Number.NaN)).toBeNull()
    expect(formatServiceDurationAr(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('isAutoClosed — a machine guess is never a human judgement', () => {
  test('closed_by system is the nightly job', () => {
    expect(isAutoClosed(makeBooking({ status: 'no_show', closedBy: 'system' }))).toBe(true)
  })

  test('provider and admin are people', () => {
    expect(isAutoClosed(makeBooking({ closedBy: 'provider' }))).toBe(false)
    expect(isAutoClosed(makeBooking({ closedBy: 'admin' }))).toBe(false)
    expect(isAutoClosed(makeBooking({ closedBy: null }))).toBe(false)
  })
})

describe('getBookingHistory — derived from timestamps, never invented', () => {
  test('an untouched booking shows only its creation', () => {
    const history = getBookingHistory(makeBooking())
    expect(history.map((entry) => entry.key)).toEqual(['created'])
  })

  test('entries appear only when their column is populated, in time order', () => {
    const booking = makeBooking({
      createdAt: '2026-01-19T17:14:00Z',
      confirmedAt: '2026-01-19T17:15:00Z',
      arrivedAt: '2026-01-20T12:02:00Z',
      completedAt: '2026-01-20T12:31:00Z',
    })
    expect(getBookingHistory(booking).map((entry) => entry.key)).toEqual([
      'created',
      'confirmed',
      'arrived',
      'completed',
    ])
  })

  test('an auto-closed no_show says so, instead of crediting the desk', () => {
    const booking = makeBooking({
      status: 'no_show',
      noShowAt: '2026-01-21T00:30:00Z',
      closedBy: 'system',
    })
    const entry = getBookingHistory(booking).find((item) => item.key === 'no_show')
    expect(entry?.byAr).toBe('أُغلق تلقائياً')
  })

  test('a desk-marked no_show credits the desk', () => {
    const booking = makeBooking({
      status: 'no_show',
      noShowAt: '2026-01-20T15:30:00Z',
      closedBy: 'provider',
    })
    expect(getBookingHistory(booking).find((item) => item.key === 'no_show')?.byAr).toBe(
      'مكتب الاستقبال',
    )
  })

  test('a cancellation names WHO cancelled — the discriminator the dashboard reads', () => {
    const byPatient = makeBooking({
      status: 'cancelled',
      cancelledAt: '2026-01-20T09:00:00Z',
      cancelledBy: 'patient',
    })
    const byDesk = makeBooking({
      status: 'cancelled',
      cancelledAt: '2026-01-20T09:00:00Z',
      cancelledBy: 'provider',
    })
    expect(getBookingHistory(byPatient).find((e) => e.key === 'cancelled')?.byAr).toBe(
      'ألغاه المريض',
    )
    expect(getBookingHistory(byDesk).find((e) => e.key === 'cancelled')?.byAr).toBe(
      'ألغاه مكتب الاستقبال',
    )
  })

  test('an admin cancellation is distinguishable from both', () => {
    const byAdmin = makeBooking({
      status: 'cancelled',
      cancelledAt: '2026-01-20T09:00:00Z',
      cancelledBy: 'admin',
    })
    expect(getBookingHistory(byAdmin).find((e) => e.key === 'cancelled')?.byAr).toBe(
      'ألغته إدارة InstaHealth',
    )
  })

  test('a cancellation with no discriminator falls back to the patient, not to a blank', () => {
    const legacy = makeBooking({
      status: 'cancelled',
      cancelledAt: '2026-01-20T09:00:00Z',
      cancelledBy: null,
    })
    expect(getBookingHistory(legacy).find((e) => e.key === 'cancelled')?.byAr).toBe('ألغاه المريض')
  })

  test('every entry carries a parseable timestamp — the drawer formats them', () => {
    const booking = makeBooking({ confirmedAt: '2026-01-19T17:15:00Z' })
    for (const entry of getBookingHistory(booking)) {
      expect(Number.isNaN(Date.parse(entry.at))).toBe(false)
    }
  })
})

describe('CANCEL_ON_BEHALF_REASONS_AR', () => {
  test('the three reasons from the approved design, in order', () => {
    expect(CANCEL_ON_BEHALF_REASONS_AR).toEqual([
      'اتصل المريض للإلغاء',
      'لم يستطع الحضور',
      'خطأ في الحجز',
    ])
  })
})

describe('requiresPreparation — empty means absent', () => {
  test('a real fasting note flags the row', () => {
    const booking = makeBooking({ services: [service('سكر صائم', 'صيام ٨ ساعات قبل التحليل')] })
    expect(requiresPreparation(booking)).toBe(true)
  })

  test('a reassurance-only note is NOT preparation', () => {
    const booking = makeBooking({ services: [service('صورة دم', 'لا يشترط الصيام')] })
    expect(requiresPreparation(booking)).toBe(false)
  })

  test('no note, no indicator', () => {
    expect(requiresPreparation(makeBooking({ services: [service('صورة دم', null)] }))).toBe(false)
  })

  test('an empty-string note is absent, not present', () => {
    expect(requiresPreparation(makeBooking({ services: [service('صورة دم', '   ')] }))).toBe(false)
  })

  test('one prepping service among many flags the row', () => {
    const booking = makeBooking({
      services: [service('صورة دم', null), service('سكر صائم', 'صيام ١٢ ساعة')],
    })
    expect(requiresPreparation(booking)).toBe(true)
  })
})

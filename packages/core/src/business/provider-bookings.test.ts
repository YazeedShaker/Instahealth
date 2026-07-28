import { describe, expect, test } from 'vitest'

import {
  BOOKING_OUTCOMES,
  canMarkNoShow,
  canMarkOutcome,
  countBookedToday,
  getBranchPaymentLabelAr,
  getPrimaryOutcomeAction,
  hasSlotPassed,
  isAwaitingCashCollection,
  requiresPreparation,
  type BranchBooking,
} from './provider-bookings'
import type { BookingStatus } from './bookings'

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
    slotTime: '14:00:00',
    createdAt: '2026-01-20T08:00:00Z',
    arrivedAt: null,
    completedAt: null,
    noShowAt: null,
    cancelledAt: null,
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
    expect(getPrimaryOutcomeAction(makeBooking())).toEqual({ outcome: 'arrived', labelAr: 'وصل' })
  })

  test('pending_payment also offers وصل — the patient turned up regardless', () => {
    expect(getPrimaryOutcomeAction(makeBooking({ status: 'pending_payment' }))?.outcome).toBe(
      'arrived',
    )
  })

  test('arrived offers تمت الخدمة', () => {
    expect(getPrimaryOutcomeAction(makeBooking({ status: 'arrived' }))).toEqual({
      outcome: 'completed',
      labelAr: 'تمت الخدمة',
    })
  })

  test('terminal statuses offer nothing', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as BookingStatus[]) {
      expect(getPrimaryOutcomeAction(makeBooking({ status }))).toBeNull()
    }
  })

  test('the primary action is always one the server would accept', () => {
    for (const status of ['confirmed', 'pending_payment', 'arrived'] as BookingStatus[]) {
      const booking = makeBooking({ status })
      const action = getPrimaryOutcomeAction(booking)
      expect(action).not.toBeNull()
      expect(canMarkOutcome(booking, action!.outcome)).toBe(true)
    }
  })
})

describe('canMarkNoShow', () => {
  test('offered while the patient could still fail to turn up', () => {
    for (const status of ['confirmed', 'pending_payment', 'arrived'] as BookingStatus[]) {
      expect(canMarkNoShow(makeBooking({ status }))).toBe(true)
    }
  })

  test('never offered once the booking is closed', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as BookingStatus[]) {
      expect(canMarkNoShow(makeBooking({ status }))).toBe(false)
    }
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

import { describe, expect, test } from 'vitest'

import {
  BOOKING_STATUSES,
  getBookingPaymentLabelAr,
  getBookingStartsAt,
  getBookingStatusChip,
  getBookingTab,
  isCancellable,
  partitionBookings,
  summarizeBookingServicesAr,
  type BookingStatus,
  type PatientBooking,
} from './bookings'

// January keeps Cairo firmly at UTC+2 — no DST ambiguity in the assertions.
// 2026-01-20 12:00 Cairo == 10:00 UTC.
const NOW = new Date(Date.UTC(2026, 0, 20, 10, 0))

function makeBooking(overrides: Partial<PatientBooking> = {}): PatientBooking {
  return {
    id: 'bk-1',
    bookingRef: 'IH-2026-00001',
    status: 'confirmed',
    paymentStatus: 'paid',
    method: 'card',
    totalEgp: 165,
    patientNotes: null,
    createdAt: '2026-01-19T10:00:00Z',
    cancelledAt: null,
    slotDate: '2026-01-21',
    slotTime: '14:00:00',
    branchId: 'branch-1',
    branchNameAr: 'ساريدار — الدقي',
    branchAddressAr: '٩٢ شارع التحرير',
    branchPhone: '+20223456789',
    branchLat: 30.03,
    branchLng: 31.21,
    isHospital: false,
    services: [],
    ...overrides,
  }
}

function makeService(nameAr: string, priceEgp = 100) {
  return {
    id: `svc-${nameAr}`,
    nameAr,
    nameEn: nameAr,
    priceEgp,
    preparationNotesAr: null,
    preparationNotesEn: null,
  }
}

describe('getBookingStatusChip', () => {
  test('every status the CHECK constraint allows has a label and a tone', () => {
    for (const status of BOOKING_STATUSES) {
      const chip = getBookingStatusChip(makeBooking({ status }))
      expect(chip.labelAr.length).toBeGreaterThan(0)
      expect(chip.tone).toBeTruthy()
    }
  })

  test('the four statuses the design badges render map to its tones', () => {
    expect(getBookingStatusChip(makeBooking({ status: 'confirmed' }))).toEqual({
      labelAr: 'مؤكد',
      tone: 'success',
    })
    expect(getBookingStatusChip(makeBooking({ status: 'pending' }))).toEqual({
      labelAr: 'قيد التأكيد',
      tone: 'warning',
    })
    expect(getBookingStatusChip(makeBooking({ status: 'completed' }))).toEqual({
      labelAr: 'مكتمل',
      tone: 'neutral',
    })
    expect(getBookingStatusChip(makeBooking({ status: 'cancelled' }))).toEqual({
      labelAr: 'ملغي',
      tone: 'error',
    })
  })

  test('a CASH booking is still "مؤكد" — payment state does not weaken the status', () => {
    const cash = makeBooking({ status: 'confirmed', paymentStatus: 'cash', method: 'cash' })
    expect(getBookingStatusChip(cash).labelAr).toBe('مؤكد')
  })
})

describe('getBookingPaymentLabelAr', () => {
  test('prepaid reads تم الدفع', () => {
    expect(getBookingPaymentLabelAr(makeBooking({ paymentStatus: 'paid' }))).toBe('تم الدفع')
  })

  test('cash reads الدفع عند الوصول — the patient still owes money', () => {
    expect(getBookingPaymentLabelAr(makeBooking({ paymentStatus: 'cash', method: 'cash' }))).toBe(
      'الدفع عند الوصول',
    )
  })

  test('a cash METHOD counts even while payment_status is still pending', () => {
    expect(
      getBookingPaymentLabelAr(makeBooking({ paymentStatus: 'pending', method: 'cash' })),
    ).toBe('الدفع عند الوصول')
  })

  test('nothing paid and no method yet', () => {
    expect(getBookingPaymentLabelAr(makeBooking({ paymentStatus: 'pending', method: null }))).toBe(
      'لم يتم الدفع بعد',
    )
  })

  test('refunded is named explicitly rather than falling through to unpaid', () => {
    expect(getBookingPaymentLabelAr(makeBooking({ paymentStatus: 'refunded' }))).toBe(
      'تم رد المبلغ',
    )
  })
})

describe('getBookingStartsAt', () => {
  test('reads the slot as Egypt wall clock, not the host timezone', () => {
    // 14:00 Cairo in January is 12:00 UTC.
    expect(getBookingStartsAt(makeBooking()).toISOString()).toBe('2026-01-21T12:00:00.000Z')
  })

  test('midnight does not roll into the previous day', () => {
    const midnight = makeBooking({ slotDate: '2026-01-21', slotTime: '00:00:00' })
    expect(getBookingStartsAt(midnight).toISOString()).toBe('2026-01-20T22:00:00.000Z')
  })
})

describe('getBookingTab', () => {
  test('a live booking in the future is upcoming', () => {
    expect(getBookingTab(makeBooking(), NOW)).toBe('upcoming')
  })

  test("today's already-passed slot goes to past", () => {
    expect(getBookingTab(makeBooking({ slotDate: '2026-01-20', slotTime: '09:00:00' }), NOW)).toBe(
      'past',
    )
  })

  test('a CANCELLED future booking is past regardless of date', () => {
    expect(getBookingTab(makeBooking({ status: 'cancelled' }), NOW)).toBe('past')
  })

  test('completed and no_show are always past', () => {
    for (const status of ['completed', 'no_show'] as BookingStatus[]) {
      expect(getBookingTab(makeBooking({ status }), NOW)).toBe('past')
    }
  })

  test('pending and pending_payment are still live', () => {
    for (const status of ['pending', 'pending_payment'] as BookingStatus[]) {
      expect(getBookingTab(makeBooking({ status }), NOW)).toBe('upcoming')
    }
  })

  test('a slot exactly at `now` has started — past, not upcoming', () => {
    expect(getBookingTab(makeBooking({ slotDate: '2026-01-20', slotTime: '12:00:00' }), NOW)).toBe(
      'past',
    )
  })
})

describe('partitionBookings', () => {
  const soon = makeBooking({ id: 'soon', slotDate: '2026-01-21', slotTime: '09:00:00' })
  const later = makeBooking({ id: 'later', slotDate: '2026-01-25', slotTime: '09:00:00' })
  const recent = makeBooking({ id: 'recent', status: 'completed', slotDate: '2026-01-18' })
  const older = makeBooking({ id: 'older', status: 'completed', slotDate: '2026-01-05' })

  test('upcoming reads SOONEST first', () => {
    expect(partitionBookings([later, soon], NOW).upcoming.map((b) => b.id)).toEqual([
      'soon',
      'later',
    ])
  })

  test('past reads MOST RECENT first', () => {
    expect(partitionBookings([older, recent], NOW).past.map((b) => b.id)).toEqual([
      'recent',
      'older',
    ])
  })

  test('every booking lands in exactly one tab', () => {
    const all = [soon, later, recent, older]
    const { upcoming, past } = partitionBookings(all, NOW)
    expect(upcoming.length + past.length).toBe(all.length)
  })

  test('an empty list yields two empty tabs', () => {
    expect(partitionBookings([], NOW)).toEqual({ upcoming: [], past: [] })
  })
})

// SPEC-F07 supersedes the design bundle: cancellable ANY TIME before the slot
// starts, free, all payment methods. No cutoff window, no fee logic.
describe('isCancellable', () => {
  test('a confirmed future booking can be cancelled', () => {
    expect(isCancellable(makeBooking(), NOW)).toBe(true)
  })

  test('a CASH booking cancels on the same terms as a prepaid one', () => {
    const cash = makeBooking({ paymentStatus: 'cash', method: 'cash' })
    expect(isCancellable(cash, NOW)).toBe(isCancellable(makeBooking(), NOW))
  })

  test('there is NO cutoff — minutes before the slot is still cancellable', () => {
    // NOW is 12:00 Cairo; this slot starts at 12:01.
    const imminent = makeBooking({ slotDate: '2026-01-20', slotTime: '12:01:00' })
    expect(isCancellable(imminent, NOW)).toBe(true)
  })

  test('the boundary is the slot START, exactly', () => {
    const atStart = makeBooking({ slotDate: '2026-01-20', slotTime: '12:00:00' })
    expect(isCancellable(atStart, NOW)).toBe(false)
  })

  test('a past appointment is not cancellable even while confirmed', () => {
    expect(isCancellable(makeBooking({ slotDate: '2026-01-19' }), NOW)).toBe(false)
  })

  test('already cancelled or completed cannot — the server refuses these too', () => {
    for (const status of ['cancelled', 'completed', 'no_show'] as BookingStatus[]) {
      expect(isCancellable(makeBooking({ status }), NOW)).toBe(false)
    }
  })
})

describe('summarizeBookingServicesAr', () => {
  test('joins service names with the design separator', () => {
    expect(
      summarizeBookingServicesAr([makeService('صورة دم كاملة'), makeService('سكر صائم')]),
    ).toBe('صورة دم كاملة · سكر صائم')
  })

  test('a single service needs no separator', () => {
    expect(summarizeBookingServicesAr([makeService('فيتامين د')])).toBe('فيتامين د')
  })

  test('no services yields an empty string, not "undefined"', () => {
    expect(summarizeBookingServicesAr([])).toBe('')
  })
})

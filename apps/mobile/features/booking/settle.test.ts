import type { BookingConfirmation } from '@instahealth/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))

const { settlePayment } = await import('./settle')

const CONFIRMATION: BookingConfirmation = {
  bookingId: 'booking-1',
  bookingRef: 'IH-2026-48291',
  branchNameAr: 'ساريدار — الدقي',
  branchAddressAr: '٩٢ شارع التحرير',
  isHospital: false,
  slotDate: '2026-08-01',
  slotTime: '09:00:00',
  services: [],
  totalEgp: 400,
  method: 'card',
  confirmedAt: '2026-07-27T11:35:50Z',
}

const INPUT = {
  bookingId: 'booking-1',
  method: 'card' as const,
  providerRef: 'MOCK-1',
  outcome: 'success' as const,
  providerPayload: null,
}

/** supabase-js wraps a non-2xx in a FunctionsHttpError carrying the Response. */
function httpError(body: unknown) {
  return {
    data: null,
    error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: new Response(JSON.stringify(body), { status: 409 }),
    }),
  }
}

describe('settlePayment', () => {
  // Block body, NOT `() => invoke.mockReset()`: mockReset returns the mock,
  // and vitest treats a function returned from beforeEach as the teardown —
  // it would then CALL the mock after each test (and a throwing mock fails it).
  beforeEach(() => {
    invoke.mockReset()
  })

  it('returns the confirmation on success', async () => {
    invoke.mockResolvedValue({
      data: { success: true, alreadyConfirmed: false, confirmation: CONFIRMATION, sms: 'sent' },
      error: null,
    })
    const result = await settlePayment(INPUT)
    expect(result).toEqual({ kind: 'confirmed', confirmation: CONFIRMATION })
  })

  // PayTabs retries webhooks; a repeated settle is a normal success, not an error.
  it('treats an already-confirmed booking as confirmed', async () => {
    invoke.mockResolvedValue({
      data: { success: true, alreadyConfirmed: true, confirmation: CONFIRMATION, sms: 'skipped' },
      error: null,
    })
    const result = await settlePayment(INPUT)
    expect(result.kind).toBe('confirmed')
  })

  it('maps a declined payment to the retryable failure state', async () => {
    invoke.mockResolvedValue(httpError({ success: false, error: 'payment_failed' }))
    expect(await settlePayment(INPUT)).toEqual({ kind: 'paymentFailed' })
  })

  it('maps an expired hold to the repick path', async () => {
    invoke.mockResolvedValue(httpError({ success: false, error: 'hold_expired' }))
    expect(await settlePayment(INPUT)).toEqual({ kind: 'holdExpired' })
  })

  // The slot filling under us is the same patient experience: the moment is gone.
  it('maps an unavailable slot to the repick path too', async () => {
    invoke.mockResolvedValue(httpError({ success: false, error: 'slot_unavailable' }))
    expect(await settlePayment(INPUT)).toEqual({ kind: 'holdExpired' })
  })

  it.each([
    'booking_not_found',
    'not_your_booking',
    'booking_not_payable',
    'invalid_request',
    'server_error',
  ])('maps %s to a generic error, never a raw string for the patient', async (error) => {
    invoke.mockResolvedValue(httpError({ success: false, error }))
    expect(await settlePayment(INPUT)).toEqual({ kind: 'error' })
  })

  it('errors when the error body cannot be read', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('network down') })
    expect(await settlePayment(INPUT)).toEqual({ kind: 'error' })
  })

  it('errors when invoke throws outright', async () => {
    // A synchronous throw, not a rejected promise: vitest's spy tracking
    // reports a mock-returned rejection as an unhandled rejection even when the
    // code under test catches it. Same code path through settlePayment's catch.
    invoke.mockImplementation(() => {
      throw new Error('offline')
    })
    expect(await settlePayment(INPUT)).toEqual({ kind: 'error' })
  })

  it('errors on an empty body rather than pretending success', async () => {
    invoke.mockResolvedValue({ data: null, error: null })
    expect(await settlePayment(INPUT)).toEqual({ kind: 'error' })
  })

  it('forwards the settlement request verbatim to the Edge Function', async () => {
    invoke.mockResolvedValue({
      data: { success: true, alreadyConfirmed: false, confirmation: CONFIRMATION, sms: 'sent' },
      error: null,
    })
    await settlePayment(INPUT)
    expect(invoke).toHaveBeenCalledWith('settle-payment', { body: INPUT })
  })
})

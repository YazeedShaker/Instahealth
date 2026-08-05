import { describe, expect, it } from 'vitest'

import {
  MOCK_FAILURE_REASON,
  MOCK_PAYMENT_PROVIDER_ID,
  OFFERED_PAYMENT_METHODS,
  OFFERED_PAYMENT_METHOD_OPTIONS,
  V1_PAYMENT_METHOD,
  formatTotalLabelAr,
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  createMockPaymentProvider,
  formatPayCtaLabelAr,
  formatPaymentMethodStatusAr,
  getPaymentStatusForMethod,
  isPaymentMethod,
  isPrepaidMethod,
  toSelectedServices,
  type ConfirmedBookingService,
  type PaymentIntent,
  type PaymentMethod,
} from './payment'
import { PaytabsNotConfiguredError, createPaytabsProvider } from './payment-paytabs'

function intent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    bookingId: '3f8b1c2d-0000-4000-8000-000000000001',
    bookingRef: 'IH-2026-48291',
    amountEgp: 245,
    method: 'card',
    attempt: 1,
    ...overrides,
  }
}

describe('payment method catalogue', () => {
  // ⚠ V1 IS CASH ONLY (partner-trust decision 2026-08-04). This assertion is
  // the guard: putting a method back in the lineup is a PRODUCT decision, and
  // it must not happen as a side effect of some other change.
  it('offers CASH ONLY in v1', () => {
    expect(OFFERED_PAYMENT_METHODS).toEqual(['cash'])
    expect(OFFERED_PAYMENT_METHOD_OPTIONS.map((option) => option.method)).toEqual(['cash'])
    expect(V1_PAYMENT_METHOD).toBe('cash')
  })

  it('keeps the FULL label catalogue so historical prepaid bookings still read correctly', () => {
    expect(PAYMENT_METHOD_OPTIONS.map((option) => option.method)).toEqual(['card', 'fawry', 'cash'])
  })

  it('offers no method the app tells the patient nothing is charged for', () => {
    // The cash-only promise: every OFFERED method must be non-prepaid, or the
    // «لا نطلب أي دفع داخل التطبيق» copy becomes a lie.
    for (const method of OFFERED_PAYMENT_METHODS) {
      expect(isPrepaidMethod(method)).toBe(false)
    }
  })

  it('only offers methods the bookings.payment_method constraint accepts', () => {
    for (const method of OFFERED_PAYMENT_METHODS) {
      expect(PAYMENT_METHODS).toContain(method)
    }
  })

  it('narrows arbitrary strings to payment methods', () => {
    expect(isPaymentMethod('card')).toBe(true)
    expect(isPaymentMethod('bitcoin')).toBe(false)
  })

  it('treats every method except cash as prepaid', () => {
    expect(isPrepaidMethod('card')).toBe(true)
    expect(isPrepaidMethod('fawry')).toBe(true)
    expect(isPrepaidMethod('cash')).toBe(false)
  })

  it('mirrors what confirm_booking() writes for each method', () => {
    expect(getPaymentStatusForMethod('card')).toEqual({
      bookingPaymentStatus: 'paid',
      paymentRowStatus: 'completed',
    })
    expect(getPaymentStatusForMethod('cash')).toEqual({
      bookingPaymentStatus: 'cash',
      paymentRowStatus: 'pending',
    })
  })

  it('labels a prepaid method as paid and cash as pay-on-arrival', () => {
    expect(formatPaymentMethodStatusAr('card')).toBe('بطاقة · تم الدفع')
    expect(formatPaymentMethodStatusAr('fawry')).toBe('فوري · تم الدفع')
    expect(formatPaymentMethodStatusAr('cash')).toBe('نقداً · الدفع عند الوصول')
  })

  it('falls back to the raw method when it has no design row', () => {
    expect(formatPaymentMethodStatusAr('orange_cash')).toBe('orange_cash · تم الدفع')
  })

  it('asks for money on the CTA only when money actually moves', () => {
    expect(formatPayCtaLabelAr('card', 245)).toBe('ادفع ٢٤٥ EGP')
    expect(formatPayCtaLabelAr('cash', 245)).toBe('تأكيد الحجز')
  })

  it('never labels a cash total as already paid', () => {
    expect(formatTotalLabelAr('card')).toBe('الإجمالي المدفوع')
    expect(formatTotalLabelAr('cash')).toBe('الإجمالي — يُدفع عند الوصول')
    expect(formatTotalLabelAr('cash')).not.toContain('المدفوع')
  })
})

describe('createMockPaymentProvider', () => {
  it('conforms to the provider interface and flags itself as simulated', () => {
    const provider = createMockPaymentProvider()
    expect(provider.id).toBe(MOCK_PAYMENT_PROVIDER_ID)
    expect(provider.isSimulated).toBe(true)
    expect(typeof provider.supportsMethod).toBe('function')
    expect(typeof provider.initiatePayment).toBe('function')
  })

  it('supports every offered method and nothing else', () => {
    const provider = createMockPaymentProvider()
    for (const method of OFFERED_PAYMENT_METHODS) {
      expect(provider.supportsMethod(method)).toBe(true)
    }
    expect(provider.supportsMethod('vodafone_cash')).toBe(false)
  })

  it('settles successfully with an inline result and a provider reference', async () => {
    const provider = createMockPaymentProvider()
    const result = await provider.initiatePayment(intent())
    expect(result).toEqual({
      kind: 'inline',
      providerRef: 'MOCK-3F8B1C2D-1',
      outcome: 'success',
      failureReason: null,
    })
  })

  it('gives each retry attempt a distinct provider reference', async () => {
    const provider = createMockPaymentProvider()
    const first = await provider.initiatePayment(intent({ attempt: 1 }))
    const second = await provider.initiatePayment(intent({ attempt: 2 }))
    expect(first.providerRef).not.toBe(second.providerRef)
  })

  it('fails prepaid payments when the DEV failure toggle is on', async () => {
    const provider = createMockPaymentProvider({ simulateFailure: true })
    const result = await provider.initiatePayment(intent({ method: 'card' }))
    expect(result).toMatchObject({
      kind: 'inline',
      outcome: 'failure',
      failureReason: MOCK_FAILURE_REASON,
    })
  })

  it('never fails cash — there is no gateway to fail', async () => {
    const provider = createMockPaymentProvider({ simulateFailure: true })
    const result = await provider.initiatePayment(intent({ method: 'cash' }))
    expect(result).toMatchObject({ outcome: 'success', failureReason: null })
  })

  it('uses an injected reference generator when given one', async () => {
    const provider = createMockPaymentProvider({ generateReference: () => 'FIXED-REF' })
    const result = await provider.initiatePayment(intent())
    expect(result.providerRef).toBe('FIXED-REF')
  })
})

describe('createPaytabsProvider', () => {
  const config = {
    profileId: 'profile',
    serverKey: 'server',
    clientKey: 'client',
    baseUrl: 'https://secure-egypt.paytabs.com',
  }

  it('declares itself NOT simulated so no caller mistakes it for the mock', () => {
    const provider = createPaytabsProvider(config)
    expect(provider.isSimulated).toBe(false)
    expect(provider.id).toBe('paytabs')
  })

  it('supports only cards today (Fawry/Vodafone Cash are not PayTabs methods)', () => {
    const provider = createPaytabsProvider(config)
    expect(provider.supportsMethod('card')).toBe(true)
    expect(provider.supportsMethod('fawry')).toBe(false)
  })

  it('rejects rather than silently succeeding while unimplemented', async () => {
    const provider = createPaytabsProvider(config)
    await expect(provider.initiatePayment(intent())).rejects.toBeInstanceOf(
      PaytabsNotConfiguredError,
    )
  })
})

describe('toSelectedServices', () => {
  const services: ConfirmedBookingService[] = [
    {
      id: 'svc-1',
      nameAr: 'سكر صائم',
      nameEn: 'Fasting glucose',
      priceEgp: 45,
      preparationNotesAr: 'صيام ٨ ساعات على الأقل',
      preparationNotesEn: 'Fast for at least 8 hours',
    },
    {
      id: 'svc-2',
      nameAr: 'صورة دم كاملة',
      nameEn: 'CBC',
      priceEgp: 200,
      preparationNotesAr: 'لا يشترط صيام',
      preparationNotesEn: 'No fasting required',
    },
  ]

  it('parses fasting hours once so confirmation shows the SAME notes as selection', () => {
    const selected = toSelectedServices(services)
    expect(selected[0]?.fastingHours).toBe(8)
    expect(selected[1]?.fastingHours).toBeNull()
  })

  it('carries every field through unchanged', () => {
    const selected = toSelectedServices(services)
    expect(selected[0]).toMatchObject({
      id: 'svc-1',
      nameAr: 'سكر صائم',
      nameEn: 'Fasting glucose',
      priceEgp: 45,
      preparationNotesAr: 'صيام ٨ ساعات على الأقل',
    })
  })

  it('returns an empty list for an empty confirmation', () => {
    expect(toSelectedServices([])).toEqual([])
  })
})

describe('payment method exhaustiveness', () => {
  it('has a label path for every DB-allowed method', () => {
    for (const method of PAYMENT_METHODS satisfies readonly PaymentMethod[]) {
      expect(formatPaymentMethodStatusAr(method).length).toBeGreaterThan(0)
    }
  })
})

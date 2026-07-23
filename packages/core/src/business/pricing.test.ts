import { describe, expect, test } from 'vitest'

import type { SelectedService } from '../types/domain.types'
import { calculateBookingTotal, calculateCommission, calculateProviderPayout } from './pricing'

function makeService(priceEgp: number): SelectedService {
  return {
    id: `svc-${priceEgp}`,
    nameAr: 'خدمة',
    nameEn: 'Service',
    priceEgp,
    preparationNotesAr: null,
    preparationNotesEn: null,
    fastingHours: null,
  }
}

describe('calculateBookingTotal', () => {
  test('sums selected service prices', () => {
    expect(calculateBookingTotal([makeService(150), makeService(320), makeService(85)])).toBe(555)
  })

  test('empty selection → 0', () => {
    expect(calculateBookingTotal([])).toBe(0)
  })

  test('decimal prices sum without floating point drift', () => {
    expect(calculateBookingTotal([makeService(0.1), makeService(0.2)])).toBe(0.3)
  })
})

describe('calculateCommission', () => {
  test.each([
    [333, 12, 39.96],
    [333, 10, 33.3],
    [333, 15, 49.95],
    [199.99, 12, 24.0],
    [100, 12.5, 12.5],
  ])('total %d EGP at %d%% → %d EGP with no drift', (total, percent, expected) => {
    expect(calculateCommission(total, percent)).toBe(expected)
  })

  test.each([
    ['zero', 0],
    ['negative', -5],
    ['over 100', 101],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('%s rate throws — never a silent default', (_label, rate) => {
    expect(() => calculateCommission(333, rate)).toThrow(/Invalid commission percent/)
  })
})

describe('calculateProviderPayout', () => {
  test.each([
    [333, 12],
    [333, 10],
    [333, 15],
    [199.99, 12],
    [1, 15],
  ])('payout + commission === total for %d EGP at %d%%', (total, percent) => {
    const commission = calculateCommission(total, percent)
    const payout = calculateProviderPayout(total, percent)
    expect(Math.round((payout + commission) * 100) / 100).toBe(total)
  })

  test('invalid rate throws', () => {
    expect(() => calculateProviderPayout(333, 0)).toThrow(/Invalid commission percent/)
  })
})

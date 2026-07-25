import { describe, expect, it } from 'vitest'

import type { BranchServiceItem } from '../types/domain.types'
import {
  formatEgpDigitsAr,
  formatServiceCountAr,
  groupServicesByCategory,
  summarizeSelection,
} from './selection'

function makeService(overrides: Partial<BranchServiceItem> = {}): BranchServiceItem {
  return {
    id: 'svc-1',
    branchServiceId: 'bs-1',
    nameAr: 'صورة دم كاملة',
    nameEn: 'CBC',
    priceEgp: 150,
    preparationNotesAr: null,
    preparationNotesEn: null,
    fastingHours: null,
    categorySlug: 'labs',
    categoryNameAr: 'تحاليل',
    categoryNameEn: 'Labs',
    categoryIcon: '🧪',
    categorySortOrder: 1,
    ...overrides,
  }
}

describe('groupServicesByCategory', () => {
  it('groups services under their category with one section per category', () => {
    const groups = groupServicesByCategory([
      makeService({ id: 'a' }),
      makeService({ id: 'b', nameAr: 'سكر صائم' }),
      makeService({
        id: 'c',
        categorySlug: 'scans',
        categoryNameAr: 'أشعة',
        categoryNameEn: 'Scans',
        categorySortOrder: 2,
      }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.services.map((service) => service.id)).toEqual(['a', 'b'])
    expect(groups[1]?.services.map((service) => service.id)).toEqual(['c'])
  })

  it('orders labs before scans regardless of input order', () => {
    const groups = groupServicesByCategory([
      makeService({
        id: 'scan',
        categorySlug: 'scans',
        categoryNameAr: 'أشعة',
        categoryNameEn: 'Scans',
      }),
      makeService({ id: 'lab' }),
    ])
    expect(groups.map((group) => group.slug)).toEqual(['labs', 'scans'])
  })

  it('orders doctors after scans and unknown categories last by sort_order', () => {
    const groups = groupServicesByCategory([
      makeService({
        id: 'home',
        categorySlug: 'home-visits',
        categoryNameAr: 'زيارات منزلية',
        categoryNameEn: 'Home Visits',
        categorySortOrder: 5,
      }),
      makeService({
        id: 'doc',
        categorySlug: 'doctors',
        categoryNameAr: 'كشف طبيب',
        categoryNameEn: 'Doctors',
        categorySortOrder: 3,
      }),
      makeService({ id: 'lab' }),
      makeService({
        id: 'scan',
        categorySlug: 'scans',
        categoryNameAr: 'أشعة',
        categoryNameEn: 'Scans',
      }),
    ])
    expect(groups.map((group) => group.slug)).toEqual(['labs', 'scans', 'doctors', 'home-visits'])
  })

  it('preserves service order within a group', () => {
    const groups = groupServicesByCategory([
      makeService({ id: 'first' }),
      makeService({ id: 'second' }),
      makeService({ id: 'third' }),
    ])
    expect(groups[0]?.services.map((service) => service.id)).toEqual(['first', 'second', 'third'])
  })

  it('carries the category display names onto the group header', () => {
    const groups = groupServicesByCategory([makeService()])
    expect(groups[0]).toMatchObject({ slug: 'labs', nameAr: 'تحاليل', nameEn: 'Labs' })
  })

  it('returns an empty array for no services', () => {
    expect(groupServicesByCategory([])).toEqual([])
  })

  it('does not mutate the input array or its items', () => {
    const input = [makeService({ id: 'a' }), makeService({ id: 'b', categorySlug: 'scans' })]
    const snapshot = JSON.parse(JSON.stringify(input)) as BranchServiceItem[]
    groupServicesByCategory(input)
    expect(input).toEqual(snapshot)
  })
})

describe('formatServiceCountAr', () => {
  it.each([
    [0, 'لم تختر بعد'],
    [1, 'خدمة واحدة'],
    [2, 'خدمتان'],
    [3, '٣ خدمات'],
    [10, '١٠ خدمات'],
    [11, '١١ خدمة'],
    [25, '٢٥ خدمة'],
  ])('renders %i as "%s"', (count, expected) => {
    expect(formatServiceCountAr(count)).toBe(expected)
  })
})

describe('formatEgpDigitsAr', () => {
  it('whole amounts render without decimals', () => {
    expect(formatEgpDigitsAr(350)).toBe('٣٥٠')
    expect(formatEgpDigitsAr(0)).toBe('٠')
  })

  it('fractional amounts keep two decimals with the Arabic mark', () => {
    expect(formatEgpDigitsAr(99.5)).toBe('٩٩٫٥٠')
  })
})

describe('summarizeSelection', () => {
  it('returns the empty-selection summary for no services', () => {
    expect(summarizeSelection([])).toEqual({
      count: 0,
      totalEgp: 0,
      countLabelAr: 'لم تختر بعد',
      label: 'لم تختر بعد',
    })
  })

  it('builds the dual-form CTA line for two services', () => {
    const summary = summarizeSelection([
      makeService({ priceEgp: 150 }),
      makeService({ id: 'svc-2', priceEgp: 200 }),
    ])
    expect(summary.count).toBe(2)
    expect(summary.totalEgp).toBe(350)
    expect(summary.label).toBe('خدمتان · ٣٥٠ ج.م')
  })

  it('uses the singular form for one service', () => {
    expect(summarizeSelection([makeService({ priceEgp: 400 })]).label).toBe('خدمة واحدة · ٤٠٠ ج.م')
  })

  it('uses the 3–10 plural form', () => {
    const summary = summarizeSelection([
      makeService({ id: 'a', priceEgp: 100 }),
      makeService({ id: 'b', priceEgp: 100 }),
      makeService({ id: 'c', priceEgp: 100 }),
    ])
    expect(summary.label).toBe('٣ خدمات · ٣٠٠ ج.م')
  })

  it('keeps two decimals with the Arabic mark for fractional totals', () => {
    const summary = summarizeSelection([makeService({ priceEgp: 99.5 })])
    expect(summary.totalEgp).toBe(99.5)
    expect(summary.label).toBe('خدمة واحدة · ٩٩٫٥٠ ج.م')
  })

  it('totals through core pricing (piaster-safe, no float drift)', () => {
    const summary = summarizeSelection([
      makeService({ id: 'a', priceEgp: 0.1 }),
      makeService({ id: 'b', priceEgp: 0.2 }),
    ])
    expect(summary.totalEgp).toBe(0.3)
  })
})

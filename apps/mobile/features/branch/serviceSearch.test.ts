import type { BranchServiceItem, CategoryGroup } from '@instahealth/core'
import { describe, expect, it } from 'vitest'

import { filterGroupsByQuery, matchesServiceQuery } from './serviceSearch'

function makeService(overrides: Partial<BranchServiceItem> = {}): BranchServiceItem {
  return {
    id: 'svc-1',
    branchServiceId: 'bs-1',
    nameAr: 'صورة دم كاملة (CBC)',
    nameEn: 'Complete Blood Count (CBC)',
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

function makeGroups(): CategoryGroup[] {
  return [
    {
      slug: 'labs',
      nameAr: 'تحاليل',
      nameEn: 'Labs',
      icon: '🧪',
      services: [
        makeService({ id: 'cbc' }),
        makeService({ id: 'fbs', nameAr: 'سكر صائم', nameEn: 'Fasting Blood Sugar (FBS)' }),
      ],
    },
    {
      slug: 'scans',
      nameAr: 'أشعة',
      nameEn: 'Scans',
      icon: '🩻',
      services: [
        makeService({
          id: 'xray',
          nameAr: 'أشعة عادية على الصدر',
          nameEn: 'Chest X-ray',
          categorySlug: 'scans',
        }),
      ],
    },
  ]
}

describe('matchesServiceQuery', () => {
  it('matches Arabic substrings', () => {
    expect(matchesServiceQuery(makeService(), 'صورة دم')).toBe(true)
    expect(matchesServiceQuery(makeService(), 'سكر')).toBe(false)
  })

  it('matches English substrings case-insensitively', () => {
    expect(matchesServiceQuery(makeService(), 'cbc')).toBe(true)
    expect(matchesServiceQuery(makeService(), 'BLOOD count')).toBe(true)
  })

  it('empty or whitespace query matches everything', () => {
    expect(matchesServiceQuery(makeService(), '')).toBe(true)
    expect(matchesServiceQuery(makeService(), '   ')).toBe(true)
  })

  it('normalizes Arabic-Indic digits in the query', () => {
    const b12 = makeService({ nameAr: 'فيتامين ب ١٢', nameEn: 'Vitamin B12' })
    expect(matchesServiceQuery(b12, '12')).toBe(true)
    expect(matchesServiceQuery(b12, '١٢')).toBe(true)
  })
})

describe('filterGroupsByQuery', () => {
  it('returns groups untouched for an empty query', () => {
    const groups = makeGroups()
    expect(filterGroupsByQuery(groups, '')).toBe(groups)
  })

  it('filters services within groups and drops emptied groups', () => {
    const filtered = filterGroupsByQuery(makeGroups(), 'سكر')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.slug).toBe('labs')
    expect(filtered[0]?.services.map((service) => service.id)).toEqual(['fbs'])
  })

  it('keeps multiple groups when both match', () => {
    const filtered = filterGroupsByQuery(makeGroups(), 'أشعة')
    expect(filtered.map((group) => group.slug)).toEqual(['scans'])
  })

  it('no matches → empty array (UI shows the no-results state)', () => {
    expect(filterGroupsByQuery(makeGroups(), 'رنين مغناطيسي')).toEqual([])
  })
})

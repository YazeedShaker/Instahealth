import { describe, expect, it } from 'vitest'

import {
  addRecentSearch,
  isSearchableQuery,
  normalizeArabicQuery,
  POPULAR_SEARCHES_AR,
  RECENT_SEARCHES_MAX,
  removeRecentSearch,
} from './search'

describe('normalizeArabicQuery', () => {
  it('folds hamza seats to bare alif — "اشعه" matches "أشعة"', () => {
    expect(normalizeArabicQuery('أشعة')).toBe(normalizeArabicQuery('اشعه'))
    expect(normalizeArabicQuery('إشعة')).toBe(normalizeArabicQuery('اشعه'))
    expect(normalizeArabicQuery('آشعة')).toBe(normalizeArabicQuery('اشعه'))
  })

  it('folds taa marbuta to haa', () => {
    expect(normalizeArabicQuery('صورة')).toBe('صوره')
  })

  it('folds alif maqsura to yaa', () => {
    expect(normalizeArabicQuery('مستشفى')).toBe('مستشفي')
  })

  it('strips diacritics and tatweel', () => {
    expect(normalizeArabicQuery('سُكَّر')).toBe('سكر')
    expect(normalizeArabicQuery('ســـكر')).toBe('سكر')
  })

  it('lowercases latin and folds Arabic-Indic digits', () => {
    expect(normalizeArabicQuery('HbA1c')).toBe('hba1c')
    expect(normalizeArabicQuery('فيتامين ب ١٢')).toBe('فيتامين ب 12')
  })

  it('collapses whitespace and trims', () => {
    expect(normalizeArabicQuery('  سكر   صائم ')).toBe('سكر صائم')
  })

  it('a real catalog case end-to-end: keyboard spelling finds the stored name', () => {
    const stored = normalizeArabicQuery('أشعة عادية على الصدر')
    expect(stored).toContain(normalizeArabicQuery('اشعه'))
  })
})

describe('isSearchableQuery', () => {
  it('needs two normalized characters', () => {
    expect(isSearchableQuery('س')).toBe(false)
    expect(isSearchableQuery('سك')).toBe(true)
  })

  it('diacritics alone are not a query', () => {
    expect(isSearchableQuery('ًّ')).toBe(false)
  })
})

describe('recent searches', () => {
  it('adds newest first and caps the list', () => {
    let recents: string[] = []
    for (let index = 0; index < RECENT_SEARCHES_MAX + 3; index += 1) {
      recents = addRecentSearch(recents, `بحث ${index}`)
    }
    expect(recents).toHaveLength(RECENT_SEARCHES_MAX)
    expect(recents[0]).toBe(`بحث ${RECENT_SEARCHES_MAX + 2}`)
  })

  it('dedupes hamza/case variants, keeping the newest spelling', () => {
    const recents = addRecentSearch(addRecentSearch([], 'أشعة'), 'اشعه')
    expect(recents).toEqual(['اشعه'])
  })

  it('ignores empty input', () => {
    expect(addRecentSearch(['سكر'], '   ')).toEqual(['سكر'])
  })

  it('removes by normalized identity', () => {
    expect(removeRecentSearch(['أشعة', 'سكر'], 'اشعه')).toEqual(['سكر'])
  })
})

describe('POPULAR_SEARCHES_AR', () => {
  it('is non-empty and each entry is searchable', () => {
    expect(POPULAR_SEARCHES_AR.length).toBeGreaterThan(0)
    for (const entry of POPULAR_SEARCHES_AR) {
      expect(isSearchableQuery(entry)).toBe(true)
    }
  })
})

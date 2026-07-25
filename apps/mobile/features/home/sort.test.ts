import { describe, expect, test } from 'vitest'

import { sortBranchesForDisplay } from './sort'

const CAIRO_CENTER = { lat: 30.0444, lng: 31.2357 }

const BRANCHES = [
  { nameAr: 'ساريدار — حلوان', lat: 29.849652, lng: 31.335471 },
  { nameAr: 'ساريدار — الدقي', lat: 30.038426, lng: 31.210027 },
  { nameAr: 'ساريدار — الجيزة', lat: null, lng: null }, // future data: no coords yet
  { nameAr: 'مستشفى تاون — التجمع الخامس', lat: 30.014288, lng: 31.4379333 },
]

describe('sortBranchesForDisplay', () => {
  test('with location: sorted by distance, null-coord branches at the end without a distance', () => {
    const sorted = sortBranchesForDisplay(BRANCHES, CAIRO_CENTER)
    expect(sorted[0]?.nameAr).toBe('ساريدار — الدقي') // ~2.5km, nearest
    expect(sorted[sorted.length - 1]?.nameAr).toBe('ساريدار — الجيزة')
    expect(sorted[sorted.length - 1]?.distanceKm).toBeNull()
    expect(
      sorted.every((branch) => branch.distanceKm === null || Number.isFinite(branch.distanceKm)),
    ).toBe(true)
  })

  test('without location: everything sorted by Arabic name, no distances', () => {
    const sorted = sortBranchesForDisplay(BRANCHES, null)
    expect(sorted.every((branch) => branch.distanceKm === null)).toBe(true)
    const names = sorted.map((branch) => branch.nameAr)
    expect([...names].sort((a, b) => a.localeCompare(b, 'ar'))).toEqual(names)
  })

  test('empty input → empty output, no crash', () => {
    expect(sortBranchesForDisplay([], CAIRO_CENTER)).toEqual([])
    expect(sortBranchesForDisplay([], null)).toEqual([])
  })
})

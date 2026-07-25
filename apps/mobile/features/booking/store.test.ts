import type { BranchServiceItem } from '@instahealth/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { useBookingStore } from './store'

function makeService(overrides: Partial<BranchServiceItem> = {}): BranchServiceItem {
  return {
    id: 'svc-1',
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

describe('booking store', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
  })

  it('starts with no branch and no selection', () => {
    const state = useBookingStore.getState()
    expect(state.branchId).toBeNull()
    expect(state.selectedServices).toEqual([])
  })

  it('toggleService adds then removes the same service', () => {
    const service = makeService()
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(service)
    expect(useBookingStore.getState().selectedServices).toEqual([service])

    useBookingStore.getState().toggleService(service)
    expect(useBookingStore.getState().selectedServices).toEqual([])
  })

  it('keeps selection order as services are added', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService({ id: 'a' }))
    useBookingStore.getState().toggleService(makeService({ id: 'b' }))
    expect(useBookingStore.getState().selectedServices.map((service) => service.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('removing one service leaves the others selected', () => {
    const first = makeService({ id: 'a' })
    const second = makeService({ id: 'b' })
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(first)
    useBookingStore.getState().toggleService(second)
    useBookingStore.getState().toggleService(first)
    expect(useBookingStore.getState().selectedServices).toEqual([second])
  })

  it('opening a DIFFERENT branch resets the selection', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService())
    useBookingStore.getState().openBranch('branch-2', 'مستشفى تاون')

    const state = useBookingStore.getState()
    expect(state.branchId).toBe('branch-2')
    expect(state.branchNameAr).toBe('مستشفى تاون')
    expect(state.selectedServices).toEqual([])
  })

  it('re-opening the SAME branch keeps the selection (return within session)', () => {
    const service = makeService()
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(service)
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    expect(useBookingStore.getState().selectedServices).toEqual([service])
  })

  it('clearSelection empties services but keeps the branch', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService())
    useBookingStore.getState().clearSelection()

    const state = useBookingStore.getState()
    expect(state.branchId).toBe('branch-1')
    expect(state.selectedServices).toEqual([])
  })
})

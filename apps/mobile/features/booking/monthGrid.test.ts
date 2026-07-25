import type { SlotDaySection } from '@instahealth/core'
import { describe, expect, it } from 'vitest'

import { buildMonthGrid } from './monthGrid'

function makeSection(date: string, hasAvailability: boolean): SlotDaySection {
  return { date, dayLabelAr: 'اليوم', dayNumberAr: '١', hasAvailability, periods: [] }
}

// 2026-01-17 is a Saturday; January 2026 starts on a Thursday (UTC day 4).
const NOW = new Date('2026-01-17T08:00:00+02:00')

describe('buildMonthGrid', () => {
  it('renders the current Cairo month with lead cells and Arabic title', () => {
    const grid = buildMonthGrid([], NOW)
    expect(grid.titleAr).toBe('يناير ٢٠٢٦')
    expect(grid.weekdayHeadsAr).toHaveLength(7)

    const leadCells = grid.cells.filter((cell) => cell.date === null)
    expect(leadCells).toHaveLength(4) // Jan 1 2026 is a Thursday, Sunday-first grid
    expect(grid.cells).toHaveLength(4 + 31)
  })

  it('marks only dates with available sections selectable', () => {
    const grid = buildMonthGrid(
      [makeSection('2026-01-20', true), makeSection('2026-01-21', false)],
      NOW,
    )
    const day20 = grid.cells.find((cell) => cell.date === '2026-01-20')
    const day21 = grid.cells.find((cell) => cell.date === '2026-01-21')
    const day25 = grid.cells.find((cell) => cell.date === '2026-01-25')

    expect(day20?.isSelectable).toBe(true)
    expect(day21?.isSelectable).toBe(false)
    expect(day21?.isFull).toBe(true) // has data, nothing available → ممتلئ
    expect(day25?.isSelectable).toBe(false)
    expect(day25?.isFull).toBe(false) // no data at all → plain disabled
  })

  it('flags today', () => {
    const grid = buildMonthGrid([], NOW)
    const today = grid.cells.find((cell) => cell.isToday)
    expect(today?.date).toBe('2026-01-17')
  })

  it('past days in the month are not selectable (no sections exist for them)', () => {
    const grid = buildMonthGrid([makeSection('2026-01-20', true)], NOW)
    const day5 = grid.cells.find((cell) => cell.date === '2026-01-05')
    expect(day5?.isSelectable).toBe(false)
  })

  it('uses Arabic-Indic day labels', () => {
    const grid = buildMonthGrid([], NOW)
    expect(grid.cells.find((cell) => cell.date === '2026-01-17')?.labelAr).toBe('١٧')
  })
})

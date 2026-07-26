import { describe, expect, test } from 'vitest'

import { buildSlotDaySections, type SlotSectionInput } from './slot-sections'

// January dates keep Cairo at a stable UTC+2 (no DST ambiguity).
// 2026-01-17 is a Saturday.
function cairo(dateTime: string): Date {
  return new Date(`${dateTime}+02:00`)
}

let slotSeq = 0
function makeSlot(overrides: Partial<SlotSectionInput> = {}): SlotSectionInput {
  slotSeq += 1
  return {
    id: `slot-${slotSeq}`,
    slotDate: '2026-01-17',
    slotTime: '09:00:00',
    capacity: 5,
    bookedCount: 0,
    isBlocked: false,
    activeHoldCount: 0,
    ...overrides,
  }
}

describe('buildSlotDaySections', () => {
  test('groups by day ascending with اليوم/غداً/weekday labels', () => {
    const sections = buildSlotDaySections(
      [
        makeSlot({ slotDate: '2026-01-19', slotTime: '10:00' }),
        makeSlot({ slotDate: '2026-01-17', slotTime: '10:00' }),
        makeSlot({ slotDate: '2026-01-18', slotTime: '10:00' }),
      ],
      cairo('2026-01-17T08:00:00'),
    )
    expect(sections.map((section) => section.date)).toEqual([
      '2026-01-17',
      '2026-01-18',
      '2026-01-19',
    ])
    expect(sections[0]?.dayLabelAr).toBe('اليوم')
    expect(sections[1]?.dayLabelAr).toBe('غداً')
    expect(sections[2]?.dayLabelAr).toBe('الاثنين')
    expect(sections[0]?.dayNumberAr).toBe('١٧')
  })

  test('drops past slots today but keeps later ones (Cairo wall clock)', () => {
    const sections = buildSlotDaySections(
      [
        makeSlot({ slotTime: '08:00:00' }),
        makeSlot({ slotTime: '13:00:00' }),
        makeSlot({ slotTime: '13:30:00' }),
      ],
      cairo('2026-01-17T13:00:00'),
    )
    expect(sections).toHaveLength(1)
    expect(
      sections[0]?.periods.flatMap((period) => period.slots.map((slot) => slot.slotTime)),
    ).toEqual(['13:30:00'])
  })

  test('groups a day into صباحاً / ظهراً / مساءً at the 12:00 and 17:00 boundaries', () => {
    const sections = buildSlotDaySections(
      [
        makeSlot({ slotTime: '11:30' }),
        makeSlot({ slotTime: '12:00' }),
        makeSlot({ slotTime: '16:30' }),
        makeSlot({ slotTime: '17:00' }),
        makeSlot({ slotTime: '08:00' }),
      ],
      cairo('2026-01-17T06:00:00'),
    )
    const periods = sections[0]?.periods
    expect(periods?.map((period) => period.labelAr)).toEqual(['صباحاً', 'ظهراً', 'مساءً'])
    expect(periods?.[0]?.slots.map((slot) => slot.slotTime)).toEqual(['08:00', '11:30'])
    expect(periods?.[1]?.slots.map((slot) => slot.slotTime)).toEqual(['12:00', '16:30'])
    expect(periods?.[2]?.slots.map((slot) => slot.slotTime)).toEqual(['17:00'])
  })

  test('marks full and blocked slots and flags fully-booked days', () => {
    const sections = buildSlotDaySections(
      [
        makeSlot({ slotDate: '2026-01-18', slotTime: '09:00', capacity: 5, bookedCount: 5 }),
        makeSlot({ slotDate: '2026-01-18', slotTime: '09:30', isBlocked: true }),
        makeSlot({ slotDate: '2026-01-19', slotTime: '09:00', capacity: 5, bookedCount: 4 }),
      ],
      cairo('2026-01-17T08:00:00'),
    )
    const fullDay = sections.find((section) => section.date === '2026-01-18')
    const openDay = sections.find((section) => section.date === '2026-01-19')
    expect(fullDay?.hasAvailability).toBe(false)
    expect(fullDay?.periods[0]?.slots.map((slot) => slot.status)).toEqual(['full', 'full'])
    expect(openDay?.hasAvailability).toBe(true)
  })

  test('spans a month boundary keeping ascending order', () => {
    const sections = buildSlotDaySections(
      [
        makeSlot({ slotDate: '2026-02-01', slotTime: '09:00' }),
        makeSlot({ slotDate: '2026-01-31', slotTime: '09:00' }),
      ],
      cairo('2026-01-30T08:00:00'),
    )
    expect(sections.map((section) => section.date)).toEqual(['2026-01-31', '2026-02-01'])
    expect(sections[1]?.dayNumberAr).toBe('١')
  })

  test('midnight crossing: a 23:30 slot belongs to its own date, evening period', () => {
    const sections = buildSlotDaySections(
      [makeSlot({ slotTime: '23:30' })],
      cairo('2026-01-17T22:00:00'),
    )
    expect(sections[0]?.date).toBe('2026-01-17')
    expect(sections[0]?.periods[0]?.key).toBe('evening')
  })

  test('drops days beyond SLOT_WINDOW_DAYS and before today', () => {
    const sections = buildSlotDaySections(
      [
        makeSlot({ slotDate: '2026-01-16', slotTime: '09:00' }),
        makeSlot({ slotDate: '2026-03-17', slotTime: '09:00' }),
        makeSlot({ slotDate: '2026-01-20', slotTime: '09:00' }),
      ],
      cairo('2026-01-17T08:00:00'),
    )
    expect(sections.map((section) => section.date)).toEqual(['2026-01-20'])
  })

  test('REGRESSION: a fully-HELD slot renders unavailable — display uses the same predicate the DB enforces', () => {
    const sections = buildSlotDaySections(
      [
        // capacity-1 slot, no bookings, but another patient's active hold
        makeSlot({ slotTime: '09:00', capacity: 1, bookedCount: 0, activeHoldCount: 1 }),
        makeSlot({ slotTime: '11:00', capacity: 1, bookedCount: 0, activeHoldCount: 0 }),
      ],
      cairo('2026-01-17T06:00:00'),
    )
    const [held, free] = sections[0]?.periods[0]?.slots ?? []
    expect(held?.status).toBe('full')
    expect(free?.status).toBe('available')
    expect(sections[0]?.hasAvailability).toBe(true)
  })

  test('REGRESSION: a day where every slot is held has no availability (strip disables it)', () => {
    const sections = buildSlotDaySections(
      [makeSlot({ slotDate: '2026-01-18', capacity: 1, activeHoldCount: 1 })],
      cairo('2026-01-17T06:00:00'),
    )
    expect(sections[0]?.hasAvailability).toBe(false)
  })

  test('null activeHoldCount is treated as zero holds', () => {
    const sections = buildSlotDaySections(
      [makeSlot({ capacity: 1, activeHoldCount: null })],
      cairo('2026-01-17T06:00:00'),
    )
    expect(sections[0]?.periods[0]?.slots[0]?.status).toBe('available')
  })

  test('null capacity is treated as unbounded (available)', () => {
    const sections = buildSlotDaySections(
      [makeSlot({ capacity: null, bookedCount: 3 })],
      cairo('2026-01-17T06:00:00'),
    )
    expect(sections[0]?.periods[0]?.slots[0]?.status).toBe('available')
  })

  test('empty input → empty sections', () => {
    expect(buildSlotDaySections([], cairo('2026-01-17T08:00:00'))).toEqual([])
  })
})

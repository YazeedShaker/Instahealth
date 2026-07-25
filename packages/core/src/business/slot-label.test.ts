import { describe, expect, test } from 'vitest'

import { getFirstAvailableSlotLabel } from './slots'

// Cairo is UTC+2 in January. "Now" = Thursday 2026-01-15, 10:00 Cairo.
const NOW = new Date('2026-01-15T10:00:00+02:00')

describe('getFirstAvailableSlotLabel', () => {
  test('slot later today → اليوم + time', () => {
    expect(getFirstAvailableSlotLabel({ slotDate: '2026-01-15', slotTime: '15:30:00' }, NOW)).toBe(
      'اليوم ٣:٣٠م',
    )
  })

  test('slot tomorrow → غداً + time', () => {
    expect(getFirstAvailableSlotLabel({ slotDate: '2026-01-16', slotTime: '09:00:00' }, NOW)).toBe(
      'غداً ٩ص',
    )
  })

  test('slot beyond tomorrow → Arabic weekday + time', () => {
    // 2026-01-18 is a Sunday (الأحد)
    const label = getFirstAvailableSlotLabel({ slotDate: '2026-01-18', slotTime: '13:00:00' }, NOW)
    expect(label).toBe('الأحد ١م')
  })

  test('english locale variant — today, tomorrow, and weekday', () => {
    expect(
      getFirstAvailableSlotLabel({ slotDate: '2026-01-15', slotTime: '15:30:00' }, NOW, 'en'),
    ).toBe('Today 3:30 PM')
    expect(
      getFirstAvailableSlotLabel({ slotDate: '2026-01-16', slotTime: '09:00:00' }, NOW, 'en'),
    ).toBe('Tomorrow 9:00 AM')
    expect(
      getFirstAvailableSlotLabel({ slotDate: '2026-01-18', slotTime: '00:30:00' }, NOW, 'en'),
    ).toBe('Sunday 12:30 AM')
  })

  test('late-night boundary: 23:30 Cairo tonight is still اليوم', () => {
    const lateNow = new Date('2026-01-15T23:30:00+02:00')
    expect(
      getFirstAvailableSlotLabel({ slotDate: '2026-01-15', slotTime: '23:30:00' }, lateNow),
    ).toBe('اليوم ١١:٣٠م')
  })
})

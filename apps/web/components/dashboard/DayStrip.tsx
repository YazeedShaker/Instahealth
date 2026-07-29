'use client'

import { toArabicDigits } from '@instahealth/core'

import type { BranchDay } from '../../lib/bookings/branch-days'

// The date switcher from `Provider Dashboard - Upcoming Days.dc.html`.
// Days come from the slot window, so the strip cannot offer a day the branch
// has no slots for.

const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** Read the weekday/day-number from the ISO date directly. Parsing
 * "YYYY-MM-DD" as UTC noon avoids the off-by-one a local-midnight parse gives
 * for viewers west of Greenwich. */
function readDateParts(isoDate: string): { weekdayAr: string; dayNumber: string } {
  const at = new Date(`${isoDate}T12:00:00Z`)
  return {
    weekdayAr: DAY_NAMES_AR[at.getUTCDay()] as string,
    dayNumber: toArabicDigits(String(at.getUTCDate())),
  }
}

export function DayStrip({
  days,
  selectedIso,
  tomorrowIso,
  onSelect,
}: {
  days: BranchDay[]
  selectedIso: string
  tomorrowIso: string
  onSelect: (isoDate: string) => void
}) {
  return (
    <div
      data-print="hide"
      style={{
        flexShrink: 0,
        background: 'var(--ih-neutral-0)',
        borderBottom: '1px solid var(--ih-neutral-200)',
        padding: '12px 24px',
      }}
    >
      <div
        data-testid="day-strip"
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {days.map((day) => {
          const isSelected = day.isoDate === selectedIso
          const { weekdayAr, dayNumber } = readDateParts(day.isoDate)
          const fillPct =
            day.capacity > 0 ? Math.min(100, Math.round((day.booked / day.capacity) * 100)) : 0

          return (
            <button
              key={day.isoDate}
              type="button"
              data-testid={`day-${day.isoDate}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(day.isoDate)}
              style={{
                flexShrink: 0,
                minWidth: 92,
                padding: '9px 12px',
                borderRadius: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'start',
                background: isSelected ? 'var(--ih-primary-50)' : 'var(--ih-neutral-0)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: isSelected ? 'var(--ih-primary-400)' : 'var(--ih-neutral-200)',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                transition: 'all 180ms',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isSelected ? 'var(--ih-primary-700)' : 'var(--ih-neutral-500)',
                  }}
                >
                  {day.isoDate === tomorrowIso ? 'غداً' : weekdayAr}
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: isSelected ? 'var(--ih-primary-800)' : 'var(--ih-neutral-800)',
                  }}
                >
                  {dayNumber}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 999,
                    background: isSelected ? 'rgba(2,128,144,0.18)' : 'var(--ih-neutral-100)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${fillPct}%`,
                      height: '100%',
                      background: isSelected ? 'var(--ih-primary-500)' : 'var(--ih-primary-400)',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    unicodeBidi: 'isolate',
                    color: isSelected ? 'var(--ih-primary-700)' : 'var(--ih-neutral-500)',
                  }}
                >
                  {toArabicDigits(String(day.booked))}/{toArabicDigits(String(day.capacity))}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

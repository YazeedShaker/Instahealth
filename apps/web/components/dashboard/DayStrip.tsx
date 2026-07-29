'use client'

import { toArabicDigits } from '@instahealth/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { BranchDay } from '../../lib/bookings/branch-days'

// The date switcher from `Provider Dashboard - Upcoming Days.dc.html`.
// Days come from the slot window, so the strip cannot offer a day the branch
// has no slots for.
//
// ⚠ SCROLLING ON A DESKTOP IS NOT FREE. The design hides the scrollbar
// (`.ih-daystrip::-webkit-scrollbar { display: none }`) and the prototype is
// only ever dragged by hand. On a real desk with a mouse that left NO way to
// reach the later days: a vertical wheel over a horizontally-overflowing box
// scrolls the PAGE, and with the scrollbar hidden there is nothing to drag.
// It looked like a mobile-only feature because touch emulation could drag it.
// So: wheel is translated to horizontal, arrows appear when (and only when)
// the strip actually overflows, and the whole thing is keyboard-reachable.

const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

/** One "page" of the strip — roughly four cards, so a click moves a useful
 * distance without losing the reader's place entirely. */
const SCROLL_STEP_PX = 380

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
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [overflow, setOverflow] = useState({ start: false, end: false })

  // Which arrows are live. `scrollLeft` is NEGATIVE in an RTL container in
  // Chrome/Firefox, so compare on absolute distance rather than sign — reading
  // it as a positive offset is the classic RTL scrolling bug.
  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (el === null) return
    const distance = Math.abs(el.scrollLeft)
    const max = el.scrollWidth - el.clientWidth
    setOverflow({
      start: distance > 1,
      end: max > 1 && distance < max - 1,
    })
  }, [])

  useEffect(() => {
    measure()
    const el = scrollerRef.current
    if (el === null) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, days])

  // Keep the SELECTED day in view — after a day switch re-renders the strip,
  // and on first paint when the chosen day sits past the fold.
  useEffect(() => {
    const el = scrollerRef.current
    if (el === null) return
    const selected = el.querySelector<HTMLElement>(`[data-iso="${selectedIso}"]`)
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    measure()
  }, [selectedIso, measure])

  /** Translate a vertical wheel into horizontal movement. Without this the
   * page scrolls and the strip never moves. */
  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (el === null) return
    // A trackpad sending a real horizontal delta is left alone — the browser
    // already does the right thing with it.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    if (event.deltaY === 0) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 1) return
    event.preventDefault()
    el.scrollLeft += event.deltaY
  }, [])

  const scrollBy = useCallback((direction: 'start' | 'end') => {
    const el = scrollerRef.current
    if (el === null) return
    // In RTL, moving toward the row's END means DECREASING scrollLeft.
    el.scrollBy({
      left: direction === 'end' ? -SCROLL_STEP_PX : SCROLL_STEP_PX,
      behavior: 'smooth',
    })
  }, [])

  return (
    <div
      data-print="hide"
      style={{
        flexShrink: 0,
        background: 'var(--ih-neutral-0)',
        borderBottom: '1px solid var(--ih-neutral-200)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <StripArrow direction="start" disabled={!overflow.start} onClick={() => scrollBy('start')} />

      <div
        ref={scrollerRef}
        data-testid="day-strip"
        onScroll={measure}
        onWheel={onWheel}
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          flex: 1,
          minWidth: 0,
          scrollBehavior: 'smooth',
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
              data-iso={day.isoDate}
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

      <StripArrow direction="end" disabled={!overflow.end} onClick={() => scrollBy('end')} />
    </div>
  )
}

/** Hidden from assistive tech: every day is already a focusable button in the
 * strip, so these are a pointer convenience, not a second way to navigate. */
function StripArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: 'start' | 'end'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-hidden="true"
      tabIndex={-1}
      data-testid={`day-strip-${direction}`}
      disabled={disabled}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: 999,
        border: '1px solid var(--ih-neutral-200)',
        background: 'var(--ih-neutral-0)',
        color: 'var(--ih-neutral-600)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontFamily: 'inherit',
        transition: 'opacity 150ms',
      }}
    >
      {direction === 'start' ? '›' : '‹'}
    </button>
  )
}

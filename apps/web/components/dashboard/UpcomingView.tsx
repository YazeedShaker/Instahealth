'use client'

import {
  countBookedToday,
  formatArabicDate,
  sumExpectedCashEgp,
  toArabicDigits,
  type BranchBooking,
} from '@instahealth/core'
import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

import { useBranchBookings } from '../../hooks/useBranchBookings'
import type { BranchDay } from '../../lib/bookings/branch-days'
import { Alert } from '../ui/Alert'
import { BookingsLoadError, BookingsPanel } from './BookingsPanel'
import { DayStrip } from './DayStrip'

// The Upcoming Days screen. Everything below the header is the SAME list,
// row, drawer and cancel flow Today uses — only the date differs, which is the
// whole point of parameterising by date rather than writing a second screen.

export function UpcomingView({
  branchId,
  branchNameAr,
  displayName,
  slotDurationMinutes,
  isoDate,
  tomorrowIso,
  cairoTodayIso,
  days,
  initialBookings,
  initialLoadFailed,
}: {
  branchId: string
  branchNameAr: string
  displayName: string
  slotDurationMinutes: number | null
  isoDate: string
  tomorrowIso: string
  cairoTodayIso: string
  days: BranchDay[]
  initialBookings: BranchBooking[]
  initialLoadFailed: boolean
}) {
  const router = useRouter()
  const [isSwitching, startTransition] = useTransition()

  const {
    bookings,
    loadFailed,
    newIds,
    pendingIds,
    toastAr,
    refresh,
    markOutcome,
    cancelOnBehalf,
  } = useBranchBookings({
    branchId,
    isoDate,
    initialBookings,
    initialLoadFailed,
    // A future day has no "new since you last looked" — every booking on it is
    // pending. The highlight would be noise rather than a signal.
    trackArrivals: false,
  })

  // The selected day lives in the URL so the desk can leave the tab on
  // tomorrow, refresh, and still be on tomorrow. Branch scope is NOT in the URL
  // — that stays server-derived from provider_users (never derive scope from a
  // URL), so the only thing a tampered query string can change is which of this
  // branch's own days is shown.
  const selectDay = useCallback(
    (nextIso: string) => {
      startTransition(() => router.push(`/dashboard/upcoming?date=${nextIso}`))
    },
    [router],
  )

  const selected = days.find((day) => day.isoDate === isoDate) ?? null
  const booked = selected?.booked ?? countBookedToday(bookings)
  const capacity = Math.max(selected?.capacity ?? 0, booked)
  const expectedCash = sumExpectedCashEgp(bookings)
  const dateLabel = formatArabicDate(new Date(`${isoDate}T12:00:00Z`))

  return (
    <>
      <header
        data-print="hide"
        style={{
          flexShrink: 0,
          background: 'var(--ih-neutral-0)',
          borderBottom: '1px solid var(--ih-neutral-200)',
          boxShadow: 'var(--ih-shadow-sm)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          minHeight: 56,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ih-neutral-800)' }}>
            الأيام القادمة
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ih-neutral-500)' }}>{branchNameAr}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ih-neutral-600)',
            background: 'var(--ih-neutral-50)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 999,
            padding: '6px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          👁 للعرض فقط — التعديل من إدارة الفرع
        </span>
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingInlineEnd: 16,
            borderInlineEnd: '1px solid var(--ih-neutral-200)',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--ih-primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ih-primary-700)',
            }}
          >
            {displayName.trim().charAt(0)}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ih-neutral-700)' }}>
            {displayName}
          </span>
        </div>
      </header>

      <DayStrip days={days} selectedIso={isoDate} tomorrowIso={tomorrowIso} onSelect={selectDay} />

      {toastAr !== null ? (
        <div data-print="hide" style={{ flexShrink: 0, padding: '10px 24px 0' }}>
          <Alert type="error" testId="error-toast">
            {toastAr}
          </Alert>
        </div>
      ) : null}

      <main
        data-print="scroll"
        className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4"
        style={{ opacity: isSwitching ? 0.6 : 1, transition: 'opacity 120ms' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
            paddingBottom: 12,
          }}
        >
          <div
            data-testid="upcoming-day-label"
            style={{ fontSize: 15, fontWeight: 700, color: 'var(--ih-neutral-800)' }}
          >
            {dateLabel}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--ih-neutral-200)' }} />
          <div style={{ fontSize: 12.5, color: 'var(--ih-neutral-600)' }}>
            <span style={{ fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
              {toArabicDigits(String(booked))}/{toArabicDigits(String(capacity))}
            </span>{' '}
            محجوز
          </div>
          {/* Absent when there is nothing to collect — a "٠ EGP to collect"
              line is noise on a fully prepaid day. */}
          {expectedCash > 0 ? (
            <div
              style={{ fontSize: 12.5, color: 'var(--ih-neutral-600)' }}
              data-testid="expected-cash"
            >
              متوقع تحصيله نقداً{' '}
              <span
                dir="ltr"
                style={{
                  fontWeight: 700,
                  color: 'var(--ih-primary-700)',
                  unicodeBidi: 'isolate',
                }}
              >
                {toArabicDigits(String(expectedCash))} EGP
              </span>
            </div>
          ) : null}
        </div>

        {loadFailed && bookings.length === 0 ? (
          <BookingsLoadError onRetry={() => void refresh()} />
        ) : (
          <BookingsPanel
            bookings={bookings}
            cairoTodayIso={cairoTodayIso}
            isoDate={isoDate}
            serviceDurationMinutes={slotDurationMinutes}
            newIds={newIds}
            pendingIds={pendingIds}
            nowHHMM="00:00"
            onMark={(id, outcome) => void markOutcome(id, outcome)}
            onCancel={cancelOnBehalf}
            emptyState={
              <div
                data-testid="upcoming-empty"
                style={{
                  background: 'var(--ih-neutral-0)',
                  border: '1px solid var(--ih-neutral-200)',
                  borderRadius: 12,
                  boxShadow: 'var(--ih-shadow-sm)',
                  padding: '56px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'center',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    background: 'var(--ih-primary-50)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26,
                  }}
                >
                  📅
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
                  لا توجد حجوزات في هذا اليوم بعد
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: 'var(--ih-neutral-600)',
                    maxWidth: 400,
                  }}
                >
                  كل المواعيد متاحة للحجز — ستظهر هنا بمجرد أن يحجز المرضى.
                </p>
              </div>
            }
          />
        )}
      </main>
    </>
  )
}

'use client'

import {
  countBookedToday,
  formatArabicDate,
  toArabicDigits,
  type BranchBooking,
} from '@instahealth/core'
import { useEffect, useState } from 'react'

import { useBranchBookings } from '../../hooks/useBranchBookings'
import { Alert } from '../ui/Alert'
import { BookingsLoadError, BookingsPanel } from './BookingsPanel'
import { TodayHeader } from './TodayHeader'

/** Cairo wall clock "HH:MM" — used to grey out rows whose slot has passed. */
function cairoNowHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

export function TodayView({
  branchId,
  branchNameAr,
  displayName,
  slotAllocation,
  slotDurationMinutes,
  isoDate,
  initialBookings,
  initialLoadFailed,
}: {
  branchId: string
  branchNameAr: string
  displayName: string
  slotAllocation: number
  slotDurationMinutes: number | null
  isoDate: string
  initialBookings: BranchBooking[]
  initialLoadFailed: boolean
}) {
  const [nowHHMM, setNowHHMM] = useState(cairoNowHHMM)
  const [soundOn, setSoundOn] = useState(false) // default OFF, per spec

  const {
    bookings,
    loadFailed,
    isConnected,
    newIds,
    pendingIds,
    toastAr,
    dismissNew,
    refresh,
    markOutcome,
    cancelOnBehalf,
  } = useBranchBookings({
    branchId,
    isoDate,
    initialBookings,
    initialLoadFailed,
    trackArrivals: true,
  })

  useEffect(() => {
    const clock = setInterval(() => setNowHHMM(cairoNowHHMM()), 30_000)
    return () => clearInterval(clock)
  }, [])

  const booked = countBookedToday(bookings)
  const capacity = Math.max(slotAllocation, booked)
  const dateLabel = formatArabicDate(new Date(`${isoDate}T12:00:00Z`))

  return (
    <>
      <TodayHeader
        branchNameAr={branchNameAr}
        dateLabel={dateLabel}
        booked={booked}
        capacity={capacity}
        displayName={displayName}
        isConnected={isConnected}
        soundOn={soundOn}
        onToggleSound={() => setSoundOn((on) => !on)}
      />

      {/* New-arrival banner from the design — the desk's cue that something
          landed while they were looking elsewhere. */}
      {newIds.size > 0 ? (
        <div
          data-testid="new-arrival-banner"
          data-print="hide"
          style={{
            flexShrink: 0,
            background: 'var(--ih-accent-200)',
            borderBottom: '1px solid var(--ih-accent-400)',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--ih-primary-400)',
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ih-primary-800)' }}>
            {newIds.size === 1
              ? 'وصل حجز جديد الآن'
              : `وصلت ${toArabicDigits(String(newIds.size))} حجوزات جديدة`}
          </span>
          <button
            type="button"
            data-testid="dismiss-new"
            onClick={dismissNew}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--ih-primary-700)',
              textDecoration: 'underline',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              font: 'inherit',
            }}
          >
            تم
          </button>
        </div>
      ) : null}

      {toastAr !== null ? (
        <div data-print="hide" style={{ flexShrink: 0, padding: '10px 24px 0' }}>
          <Alert type="error" testId="error-toast">
            {toastAr}
          </Alert>
        </div>
      ) : null}

      <div data-print="title" style={{ padding: '0 4px' }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{branchNameAr}</div>
        <div style={{ fontSize: 12 }}>
          {dateLabel} — {toArabicDigits(String(booked))}/{toArabicDigits(String(capacity))} محجوز
        </div>
      </div>

      {/* `position: relative` anchors the drawer and its scrim to the content
          column, so the sidebar stays reachable behind them. */}
      <main data-print="scroll" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {loadFailed && bookings.length === 0 ? (
          <BookingsLoadError onRetry={() => void refresh()} />
        ) : (
          <>
            <BookingsPanel
              bookings={bookings}
              cairoTodayIso={isoDate}
              isoDate={isoDate}
              serviceDurationMinutes={slotDurationMinutes}
              newIds={newIds}
              pendingIds={pendingIds}
              nowHHMM={nowHHMM}
              onMark={(id, outcome) => void markOutcome(id, outcome)}
              onCancel={cancelOnBehalf}
              emptyState={
                <div
                  data-testid="today-empty"
                  className="flex flex-col items-center justify-center gap-3.5 py-24 text-center"
                >
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ih-primary-50 text-3xl">
                    📋
                  </div>
                  <div className="text-[17px] font-bold text-ih-neutral-800">
                    لا توجد حجوزات اليوم
                  </div>
                  <p className="max-w-[420px] text-[13.5px] leading-[1.7] text-ih-neutral-600">
                    ستظهر الحجوزات الجديدة هنا تلقائياً بمجرد وصولها — لا حاجة لتحديث الصفحة.
                  </p>
                </div>
              }
            />

            {bookings.length > 0 ? (
              <div
                data-print="hide"
                className="flex gap-5 px-1 pt-3 text-[11.5px] text-ih-neutral-500"
              >
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border"
                    style={{
                      background: 'var(--ih-accent-200)',
                      borderColor: 'var(--ih-accent-400)',
                    }}
                  />
                  يحتاج تحصيل نقدي
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-3 w-[3px]"
                    style={{ background: 'var(--ih-primary-400)' }}
                  />
                  حجز جديد لم تُراجعه بعد
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm border"
                    style={{
                      background: 'var(--ih-neutral-100)',
                      borderColor: 'var(--ih-neutral-200)',
                    }}
                  />
                  مضى موعده
                </span>
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  )
}

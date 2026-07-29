'use client'

import {
  countBookedToday,
  formatArabicDate,
  toArabicDigits,
  type BookingOutcome,
  type BranchBooking,
} from '@instahealth/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchBranchBookings, markBookingOutcome } from '../../lib/bookings/branch-bookings'
import { createClient } from '../../lib/supabase/client'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { BookingRow } from './BookingRow'
import { TodayHeader } from './TodayHeader'

const POLL_MS = 60_000

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
  isoDate,
  initialBookings,
  initialLoadFailed,
}: {
  branchId: string
  branchNameAr: string
  displayName: string
  slotAllocation: number
  isoDate: string
  initialBookings: BranchBooking[]
  initialLoadFailed: boolean
}) {
  const [bookings, setBookings] = useState<BranchBooking[]>(initialBookings)
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed)
  const [isConnected, setIsConnected] = useState(false)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())
  const [toastAr, setToastAr] = useState<string | null>(null)
  const [nowHHMM, setNowHHMM] = useState(cairoNowHHMM)
  const [soundOn, setSoundOn] = useState(false) // default OFF, per spec

  const supabase = useMemo(() => createClient(), [])
  // Kept in a ref so the realtime callback never closes over a stale list.
  const knownIds = useRef<Set<string>>(new Set(initialBookings.map((b) => b.id)))

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchBranchBookings(supabase, branchId, isoDate)
      // Anything we had not seen before is a NEW arrival — that is what earns
      // the highlight, not merely "the list changed".
      const arrivals = rows.filter((row) => !knownIds.current.has(row.id)).map((row) => row.id)
      for (const row of rows) knownIds.current.add(row.id)
      setBookings(rows)
      setLoadFailed(false)
      if (arrivals.length > 0) {
        setNewIds((prev) => new Set([...prev, ...arrivals]))
      }
    } catch {
      setLoadFailed(true)
    }
  }, [supabase, branchId, isoDate])

  // ── realtime ──────────────────────────────────────────────────────────────
  // Broadcast on a private per-branch topic (migration 20260728141703), NOT
  // postgres_changes — same decision as the mobile picker, for the same reason:
  // the payload is ids only, and the refetch goes back through the RLS-scoped
  // function so nothing can leak a row the desk should not see.
  useEffect(() => {
    let cancelled = false
    const channel = supabase.channel(`branch-bookings:${branchId}`, {
      config: { private: true },
    })

    const setup = async () => {
      await supabase.realtime.setAuth()
      channel
        .on('broadcast', { event: 'bookings_changed' }, () => {
          void refresh()
        })
        .subscribe((status) => {
          if (cancelled) return
          setIsConnected(status === 'SUBSCRIBED')
        })
    }
    void setup()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [supabase, branchId, refresh])

  // Fallbacks, per spec: refetch on focus and a slow poll for when the socket
  // drops. Neither is the primary path — they are the quiet safety net.
  useEffect(() => {
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    const interval = setInterval(() => void refresh(), POLL_MS)
    const clock = setInterval(() => setNowHHMM(cairoNowHHMM()), 30_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
      clearInterval(clock)
    }
  }, [refresh])

  useEffect(() => {
    if (toastAr === null) return
    const timer = setTimeout(() => setToastAr(null), 5000)
    return () => clearTimeout(timer)
  }, [toastAr])

  // ── outcome actions ───────────────────────────────────────────────────────
  const handleMark = useCallback(
    async (bookingId: string, outcome: BookingOutcome) => {
      if (pendingIds.has(bookingId)) return
      setPendingIds((prev) => new Set([...prev, bookingId]))

      // Optimistic: the desk is busy and a 300ms wait per click is felt.
      const previous = bookings
      setBookings((rows) =>
        rows.map((row) => (row.id === bookingId ? { ...row, status: outcome } : row)),
      )

      const result = await markBookingOutcome(supabase, bookingId, outcome)

      if (result.kind !== 'ok') {
        setBookings(previous) // rollback
        setToastAr(
          result.kind === 'illegalTransition'
            ? 'تغيّرت حالة هذا الحجز — حدّثنا القائمة.'
            : result.kind === 'notAllowed'
              ? 'لا تملك صلاحية تعديل هذا الحجز.'
              : 'تعذّر حفظ التغيير — تحقق من الاتصال وحاول مرة أخرى.',
        )
      }

      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(bookingId)
        return next
      })
      // Re-read either way: on success to pick up server-side effects (a cash
      // completion also flips the payment state), on failure to resync.
      void refresh()
    },
    [bookings, pendingIds, supabase, refresh],
  )

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
            onClick={() => setNewIds(new Set())}
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

      <main data-print="scroll" className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {loadFailed && bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-10 text-center">
            <div className="text-sm text-ih-neutral-700">
              تعذّر تحميل حجوزات اليوم — تحقق من الاتصال وحاول مرة أخرى.
            </div>
            <Button variant="outline" data-testid="today-retry" onClick={() => void refresh()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : bookings.length === 0 ? (
          <div
            data-testid="today-empty"
            className="flex flex-col items-center justify-center gap-3.5 py-24 text-center"
          >
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ih-primary-50 text-3xl">
              📋
            </div>
            <div className="text-[17px] font-bold text-ih-neutral-800">لا توجد حجوزات اليوم</div>
            <p className="max-w-[420px] text-[13.5px] leading-[1.7] text-ih-neutral-600">
              ستظهر الحجوزات الجديدة هنا تلقائياً بمجرد وصولها — لا حاجة لتحديث الصفحة.
            </p>
          </div>
        ) : (
          <>
            <Card padding={0} style={{ overflow: 'hidden' }} testId="today-card">
              <div
                data-print="head"
                className="grid grid-cols-[90px_200px_1fr_150px_118px_180px_44px] items-center gap-3 border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-500"
              >
                <div>الموعد</div>
                <div>المريض</div>
                <div>الخدمات</div>
                <div>الدفع</div>
                <div>الحالة</div>
                <div>الإجراء</div>
                <div />
              </div>
              <div data-testid="today-list">
                {bookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    isNew={newIds.has(booking.id)}
                    isPast={booking.slotTime.slice(0, 5) < nowHHMM}
                    isPending={pendingIds.has(booking.id)}
                    onMark={(id, outcome) => void handleMark(id, outcome)}
                  />
                ))}
              </div>
            </Card>

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
          </>
        )}
      </main>
    </>
  )
}

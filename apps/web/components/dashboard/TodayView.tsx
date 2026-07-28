'use client'

import {
  countBookedToday,
  formatArabicDate,
  toArabicDigits,
  type BookingOutcome,
  type BranchBooking,
} from '@instahealth/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { signOut } from '../../app/login/actions'
import { fetchBranchBookings, markBookingOutcome } from '../../lib/bookings/branch-bookings'
import { createClient } from '../../lib/supabase/client'
import { BookingRow } from './BookingRow'

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
      {/* sticky header */}
      <header className="flex min-h-14 shrink-0 items-center gap-5 border-b border-ih-neutral-200 bg-white px-6 py-3">
        <div className="flex flex-col gap-px">
          <div data-testid="branch-name" className="text-base font-extrabold text-ih-neutral-800">
            {branchNameAr}
          </div>
          <div className="text-[12.5px] text-ih-neutral-500">{dateLabel}</div>
        </div>
        <div className="h-8 w-px bg-ih-neutral-200" />
        <div className="flex items-center gap-2.5">
          <div className="flex gap-[3px]">
            {Array.from({ length: capacity }, (_, index) => (
              <div
                key={index}
                className="h-2 w-3.5 rounded-sm"
                style={{
                  background: index < booked ? 'var(--ih-primary-400)' : 'var(--ih-neutral-200)',
                }}
              />
            ))}
          </div>
          <div className="text-[12.5px] text-ih-neutral-600">
            <span data-testid="fill-indicator" className="font-bold text-ih-neutral-800">
              {toArabicDigits(String(booked))}/{toArabicDigits(String(capacity))}
            </span>{' '}
            محجوز اليوم
          </div>
        </div>

        <div className="flex-1" />

        <div
          data-testid="connection-dot"
          data-connected={isConnected ? 'yes' : 'no'}
          className="flex items-center gap-2 rounded-full border border-ih-neutral-200 px-3 py-1.5 text-[12px] text-ih-neutral-500"
          title={isConnected ? 'التحديث فوري' : 'سيتم التحديث تلقائياً كل دقيقة'}
        >
          <span
            className="inline-block h-[7px] w-[7px] rounded-full"
            style={{ background: isConnected ? 'var(--ih-success)' : 'var(--ih-neutral-400)' }}
          />
          {isConnected ? 'متصل' : 'غير متصل'}
        </div>

        <div className="flex items-center gap-2 border-r border-ih-neutral-200 pr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ih-primary-50 text-[13px] font-bold text-ih-primary-700">
            {displayName.slice(0, 1)}
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs font-semibold text-ih-neutral-700">{displayName}</span>
            <form action={signOut}>
              <button
                type="submit"
                data-testid="logout"
                className="text-[11px] text-ih-neutral-500 underline"
              >
                تسجيل خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      {toastAr !== null ? (
        <div
          role="alert"
          data-testid="error-toast"
          className="shrink-0 border-b px-6 py-2.5 text-[13px] font-semibold"
          style={{
            background: 'var(--ih-error-bg)',
            borderColor: 'var(--ih-error)',
            color: 'var(--ih-error-text)',
          }}
        >
          {toastAr}
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        {loadFailed && bookings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-10 text-center">
            <div className="text-sm text-ih-neutral-700">
              تعذّر تحميل حجوزات اليوم — تحقق من الاتصال وحاول مرة أخرى.
            </div>
            <button
              type="button"
              data-testid="today-retry"
              onClick={() => void refresh()}
              className="h-10 rounded-lg border border-ih-neutral-200 px-4 text-sm font-semibold text-ih-neutral-700"
            >
              إعادة المحاولة
            </button>
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
            <div className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white">
              <div className="grid grid-cols-[90px_200px_1fr_150px_118px_180px] items-center gap-3 border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-500">
                <div>الموعد</div>
                <div>المريض</div>
                <div>الخدمات</div>
                <div>الدفع</div>
                <div>الحالة</div>
                <div>الإجراء</div>
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
            </div>

            <div className="flex gap-5 px-1 pt-3 text-[11.5px] text-ih-neutral-500">
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

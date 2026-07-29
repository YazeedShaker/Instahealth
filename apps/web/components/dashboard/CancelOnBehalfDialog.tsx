'use client'

import {
  CANCEL_ON_BEHALF_REASONS_AR,
  formatArabicDate,
  formatTimeShortAr,
  type BranchBooking,
} from '@instahealth/core'
import { useEffect, useState } from 'react'

import { Button } from '../ui/Button'

// The destructive confirm from `Provider Dashboard - Booking Detail.dc.html`.
// A drawer/dialog is NOT a design-system component (the _ds bundle ships
// Button, Card, Alert, Chip, PreparationNote, StatusBadge, Input, Select,
// Textarea and the nav patterns — no modal), so this is a screen-level
// composition built FROM those primitives, per CLAUDE.md §3a.

export function CancelOnBehalfDialog({
  booking,
  isPending,
  onConfirm,
  onDismiss,
}: {
  booking: BranchBooking
  isPending: boolean
  onConfirm: (reasonAr: string) => void
  onDismiss: () => void
}) {
  const [reasonAr, setReasonAr] = useState<string>(CANCEL_ON_BEHALF_REASONS_AR[0])

  // Escape closes. The SAFE action is the one that needs no aim.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  const dateLabel = formatArabicDate(new Date(`${booking.slotDate}T12:00:00Z`))

  return (
    <div
      data-testid="cancel-dialog"
      data-print="hide"
      role="dialog"
      aria-modal="true"
      aria-label="تأكيد إلغاء الحجز"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        background: 'rgba(2,20,27,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div
        style={{
          width: 440,
          maxWidth: 'calc(100% - 32px)',
          background: 'var(--ih-neutral-0)',
          borderRadius: 24,
          padding: 24,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: '0 24px 64px rgba(2,20,27,0.28)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ih-neutral-800)' }}>
            إلغاء الحجز بالنيابة عن المريض؟
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.7,
              color: 'var(--ih-neutral-600)',
            }}
          >
            سيتم إلغاء حجز{' '}
            <span style={{ fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
              {booking.patientNameAr ?? 'المريض'}
            </span>{' '}
            —{' '}
            <span dir="ltr" style={{ unicodeBidi: 'isolate', fontWeight: 700 }}>
              {booking.bookingRef ?? '—'}
            </span>{' '}
            {dateLabel} {formatTimeShortAr(booking.slotTime)}. سيُفتح الموعد لمريض آخر فوراً.
          </p>
        </div>

        <div
          style={{
            background: 'var(--ih-neutral-50)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ih-neutral-600)' }}>
            سبب الإلغاء (يُسجَّل في السجل)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CANCEL_ON_BEHALF_REASONS_AR.map((reason) => {
              const isSelected = reason === reasonAr
              return (
                <button
                  key={reason}
                  type="button"
                  data-testid={`cancel-reason-${reason}`}
                  aria-pressed={isSelected}
                  onClick={() => setReasonAr(reason)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    borderRadius: 999,
                    padding: '6px 12px',
                    whiteSpace: 'nowrap',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    color: isSelected ? 'var(--ih-primary-700)' : 'var(--ih-neutral-600)',
                    background: isSelected ? 'var(--ih-primary-50)' : 'var(--ih-neutral-0)',
                    borderColor: isSelected ? 'var(--ih-primary-400)' : 'var(--ih-neutral-200)',
                  }}
                >
                  {reason}
                </button>
              )
            })}
          </div>
        </div>

        {/* تراجع comes FIRST so the safe action sits where the hand lands. */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Button
              size="lg"
              variant="outline"
              fullWidth
              data-testid="cancel-dialog-dismiss"
              disabled={isPending}
              onClick={onDismiss}
            >
              تراجع
            </Button>
          </div>
          <div style={{ flex: 1 }}>
            <Button
              size="lg"
              variant="destructive"
              fullWidth
              data-testid="cancel-dialog-confirm"
              loading={isPending}
              onClick={() => onConfirm(reasonAr)}
            >
              تأكيد الإلغاء
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

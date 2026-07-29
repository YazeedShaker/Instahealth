'use client'

import { getPriceChangePercent, toArabicDigits } from '@instahealth/core'
import { useEffect, useState } from 'react'

import { Button } from '../ui/Button'

// The type-to-confirm step from `Provider Dashboard - Prices Editor.dc.html`.
//
// Why retyping rather than a plain "are you sure": this runs on a shared front
// desk, and the failure it guards against is a fat finger, not a change of
// heart. A yes/no dialog is dismissed reflexively; retyping the number forces
// the eyes back onto the digits that are actually about to be saved.

export function PriceConfirmDialog({
  serviceNameAr,
  currentPrice,
  nextPrice,
  isPending,
  onConfirm,
  onDismiss,
}: {
  serviceNameAr: string
  currentPrice: number
  nextPrice: number
  isPending: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  const percent = getPriceChangePercent(currentPrice, nextPrice)
  const matches = typed === String(nextPrice)
  // Only complain once they have typed something — an empty box is not a
  // mistake, it is the starting state.
  const isWrong = typed.length > 0 && !matches

  return (
    <div
      data-testid="price-confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="تأكيد تغيير السعر"
      style={{
        position: 'fixed',
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
          width: 460,
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
            تغيير كبير في السعر — تأكيد مطلوب
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ih-neutral-600)' }}>
            أنت تغيّر سعر{' '}
            <span style={{ fontWeight: 700, color: 'var(--ih-neutral-800)' }}>{serviceNameAr}</span>{' '}
            بنسبة{' '}
            <span style={{ fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
              {percent > 0 ? '+' : ''}
              {toArabicDigits(String(percent))}%
            </span>
            . اكتب السعر الجديد للتأكيد.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--ih-neutral-50)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 12,
            padding: 14,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ih-neutral-500)' }}>
              السعر الحالي
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--ih-neutral-500)',
                textDecoration: 'line-through',
                unicodeBidi: 'isolate',
              }}
            >
              {toArabicDigits(String(currentPrice))} EGP
            </span>
          </div>
          <span style={{ fontSize: 16, color: 'var(--ih-neutral-400)' }} aria-hidden="true">
            ←
          </span>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ih-primary-700)' }}>
              السعر الجديد
            </span>
            <span
              dir="ltr"
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--ih-primary-700)',
                unicodeBidi: 'isolate',
              }}
            >
              {toArabicDigits(String(nextPrice))} EGP
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label
            htmlFor="price-confirm-input"
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ih-neutral-700)' }}
          >
            اكتب{' '}
            <span dir="ltr" style={{ fontWeight: 800, unicodeBidi: 'isolate' }}>
              {toArabicDigits(String(nextPrice))}
            </span>{' '}
            للتأكيد
          </label>
          <input
            id="price-confirm-input"
            data-testid="price-confirm-input"
            dir="ltr"
            inputMode="numeric"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={String(nextPrice)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              padding: '0 14px',
              border: `1.5px solid ${isWrong ? 'var(--ih-error)' : 'var(--ih-neutral-200)'}`,
              borderRadius: 8,
              fontFamily: 'inherit',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--ih-neutral-800)',
              textAlign: 'left',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Button
              size="lg"
              variant="outline"
              fullWidth
              data-testid="price-confirm-dismiss"
              disabled={isPending}
              onClick={onDismiss}
            >
              تراجع
            </Button>
          </div>
          <div style={{ flex: 1 }}>
            <Button
              size="lg"
              fullWidth
              data-testid="price-confirm-save"
              disabled={!matches}
              loading={isPending}
              onClick={onConfirm}
            >
              تأكيد السعر الجديد
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

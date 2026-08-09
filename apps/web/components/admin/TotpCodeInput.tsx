'use client'

import { toArabicDigits } from '@instahealth/core'
import {
  CODE_CELL,
  CODE_CELL_STATES,
  TOTP_VALIDITY_BAR,
  resolveTokenCss,
} from '@instahealth/design-tokens'
import { useEffect, useRef, useState } from 'react'

// The six TOTP boxes plus the 30-second validity bar, per
// `Admin - Login and TOTP.dc.html`.
//
// ⚠ ONE REAL INPUT, SIX PAINTED CELLS. Six separate <input>s is the obvious
// build and it is wrong: paste breaks, RTL focus order fights the LTR digit
// order, and screen readers announce six unlabelled fields. Instead a single
// visually-hidden input owns the value and the cells are presentation — which
// also makes `data-testid="admin-totp-input"` a single, fillable target for
// Playwright and for a password manager.
//
// ⚠ The cells FLEX (`flex-1 min-w-0`), never a fixed pixel width. VIEW-01: a
// width measured on this machine clips on CI, and an Arabic-adjacent layout at
// 150% zoom is exactly where that bites.
export function TotpCodeInput({
  name = 'code',
  errored = false,
  autoFocus = true,
  disabled = false,
  onComplete,
}: {
  name?: string
  errored?: boolean
  autoFocus?: boolean
  disabled?: boolean
  onComplete?: (code: string) => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const digits = value.padEnd(6, ' ').slice(0, 6).split('')

  return (
    <div className="flex flex-col gap-2.5">
      <div dir="ltr" className="relative flex" style={{ gap: CODE_CELL.gap }}>
        <input
          ref={inputRef}
          // `inputMode numeric` + `autoComplete one-time-code` is what lets iOS
          // and Android offer the code from the notification shade.
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          name={name}
          value={value}
          disabled={disabled}
          maxLength={6}
          data-testid="admin-totp-input"
          aria-label="رمز التحقق — ستة أرقام"
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, 6)
            setValue(next)
            if (next.length === 6) onComplete?.(next)
          }}
          className="absolute inset-0 h-full w-full cursor-default opacity-0"
        />
        {digits.map((digit, index) => {
          const filled = digit.trim() !== ''
          const isActive = !errored && index === value.length
          const state = errored ? 'errored' : filled ? 'filled' : isActive ? 'active' : 'empty'
          const spec = CODE_CELL_STATES[state]
          return (
            <span
              // Position IS the identity here — six cells, fixed order.
              key={index}
              aria-hidden="true"
              data-testid={`admin-totp-cell-${index}`}
              data-state={state}
              className="flex min-w-0 flex-1 items-center justify-center"
              style={{
                height: CODE_CELL.height,
                borderRadius: CODE_CELL.borderRadius,
                border: `${CODE_CELL.borderWidth}px solid ${resolveTokenCss(spec.borderColor)}`,
                background: resolveTokenCss(spec.background),
                fontFamily: 'var(--font-atkinson), sans-serif',
                fontSize: CODE_CELL.fontSize,
                fontWeight: CODE_CELL.fontWeight,
                color: resolveTokenCss(CODE_CELL.color),
              }}
            >
              {filled ? digit : ''}
            </span>
          )
        })}
      </div>
      {!errored ? <TotpValidityBar /> : null}
    </div>
  )
}

/** «صلاحية الرمز الحالي: ١٩ ثانية» + the track. The number and the fill are
 * the SAME fact, so one component owns both — they cannot disagree.
 *
 * ⚠ Mounted-only countdown, deliberately: the bar reads the real clock rather
 * than animating from a start time, so a backgrounded tab that wakes up shows
 * the truth instead of resuming a stale animation. */
function TotpValidityBar() {
  const period = TOTP_VALIDITY_BAR.periodSeconds
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    // Server and client would disagree on the first paint, so the bar starts
    // empty and fills in on mount — no hydration mismatch.
    const tick = () => setRemaining(period - Math.floor((Date.now() / 1000) % period))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [period])

  const seconds = remaining ?? period
  const pct = Math.round((seconds / period) * 100)

  return (
    <div className="flex items-center" style={{ gap: TOTP_VALIDITY_BAR.gap }}>
      <span
        data-testid="admin-totp-validity"
        style={{
          fontSize: TOTP_VALIDITY_BAR.labelFontSize,
          color: resolveTokenCss(TOTP_VALIDITY_BAR.labelColor),
          whiteSpace: 'nowrap',
        }}
      >
        {remaining === null
          ? 'صلاحية الرمز الحالي'
          : `صلاحية الرمز الحالي: ${toArabicDigits(String(seconds))} ثانية`}
      </span>
      <div
        className="flex-1 overflow-hidden"
        style={{
          height: TOTP_VALIDITY_BAR.height,
          borderRadius: TOTP_VALIDITY_BAR.borderRadius,
          background: resolveTokenCss(TOTP_VALIDITY_BAR.track),
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: TOTP_VALIDITY_BAR.borderRadius,
            background: resolveTokenCss(TOTP_VALIDITY_BAR.fill),
          }}
        />
      </div>
    </div>
  )
}

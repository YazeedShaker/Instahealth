'use client'

import { resolveTokenCss } from '@instahealth/design-tokens'
import { useId, useState, type ReactNode } from 'react'

import { Button } from '../ui/Button'

// THE CONSEQUENTIAL-CONFIRM ANATOMY, extracted.
//
// A03's rate editor drew it first; A04's publish, suspend and category flip and
// A05's two disable variants are the next five. Five copies of a dialog whose
// whole job is to state a consequence precisely is five chances for one of them
// to state it slightly differently — so it is a component, and the parts that
// vary are DATA (§3a: extend the contract, never the page).
//
// The anatomy, from the frames:
//   · optional warning band across the top   — only the escalated variants
//   · title stating the CONSEQUENCE, not the action
//   · a sentence of what does and does not happen
//   · a bordered panel of NUMBERS, each row toned info / warn / good
//   · a required acknowledgment checkbox naming what the founder is accepting
//   · optional secondary action (the escalated disable offers «أوقف الفرع»)
//   · cancel + a destructive CTA whose LABEL carries the number
//
// ⚠ THE CHECKBOX IS A UI GATE BY DESIGN. Every rule it stands in front of is
// also enforced server-side, because a modified client could skip it. What it
// buys is deliberation, not authorisation — the same division A03 documented.

export type ConfirmRowTone = 'good' | 'warn' | 'neutral'

export interface ConfirmRow {
  label: string
  value: string
  tone?: ConfirmRowTone
  /** Renders the value large and bold — for the one number that matters most. */
  emphasise?: boolean
}

const TONE_BG: Record<ConfirmRowTone, string> = {
  good: 'success.bg',
  warn: 'warning.bg',
  neutral: 'neutral.0',
}
const TONE_FG: Record<ConfirmRowTone, string> = {
  good: 'primary.700',
  warn: 'warning.text',
  neutral: 'neutral.700',
}

export function ConsequentialConfirm({
  testId,
  warningBanner,
  title,
  body,
  rows,
  acknowledgement,
  confirmLabel,
  confirmTestId,
  secondaryAction,
  pending = false,
  children,
  onCancel,
  onConfirm,
}: {
  testId: string
  warningBanner?: string
  title: string
  body: ReactNode
  rows: readonly ConfirmRow[]
  acknowledgement: string
  confirmLabel: string
  confirmTestId: string
  secondaryAction?: { label: string; onClick: () => void; testId: string }
  pending?: boolean
  /** Extra controls the decision itself needs — A06s cancel reason is part of
   *  the confirm, not a step before it. */
  children?: ReactNode
  onCancel: () => void
  onConfirm: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  const titleId = useId()

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-8"
      style={{ background: 'rgba(2,20,27,0.5)' }}
    >
      <div
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-full w-[580px] max-w-full overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        {warningBanner !== undefined ? (
          <div
            data-testid={`${testId}-banner`}
            className="flex items-center gap-2.5 border-b px-6 py-4"
            style={{
              background: resolveTokenCss('warning.bg'),
              borderColor: 'rgba(217,119,6,0.35)',
            }}
          >
            <span aria-hidden="true" className="shrink-0 text-[16px]">
              ⚠
            </span>
            <span
              className="text-[12.5px] font-bold leading-[1.6]"
              style={{ color: resolveTokenCss('warning.text') }}
            >
              {warningBanner}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 px-6 pt-5">
          <span id={titleId} className="text-[17px] font-extrabold text-ih-neutral-800">
            {title}
          </span>
          <span className="text-[13px] leading-[1.7] text-ih-neutral-600">{body}</span>
        </div>

        <div className="m-6 overflow-hidden rounded-xl border border-ih-neutral-200">
          {rows.map((row, index) => (
            <div
              key={row.label}
              data-testid={`${testId}-row`}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
              style={{
                background: resolveTokenCss(TONE_BG[row.tone ?? 'neutral']),
                borderBottom:
                  index === rows.length - 1
                    ? undefined
                    : `1px solid ${resolveTokenCss('neutral.100')}`,
              }}
            >
              <span
                className="text-[12.5px] font-bold"
                style={{ color: resolveTokenCss(TONE_FG[row.tone ?? 'neutral']) }}
              >
                {row.label}
              </span>
              <span
                className={`tabular-nums ${row.emphasise ? 'text-[15px] font-extrabold' : 'text-[12px] font-semibold'}`}
                style={{ color: resolveTokenCss(TONE_FG[row.tone ?? 'neutral']) }}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {children}

        <label className="mx-6 flex items-start gap-2.5 pb-4 text-[12.5px] leading-[1.6] text-ih-neutral-700">
          <input
            data-testid={`${testId}-ack`}
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 shrink-0"
          />
          {acknowledgement}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
          {secondaryAction === undefined ? (
            <span />
          ) : (
            <Button
              size="md"
              variant="outline"
              data-testid={secondaryAction.testId}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Button size="md" variant="ghost" onClick={onCancel} disabled={pending}>
              إلغاء
            </Button>
            <Button
              size="md"
              variant="destructive"
              data-testid={confirmTestId}
              disabled={!acknowledged || pending}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

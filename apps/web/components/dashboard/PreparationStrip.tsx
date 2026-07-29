'use client'

import type { PreparationResult } from '@instahealth/core'
import { PREPARATION_NOTE, resolveTokenCss } from '@instahealth/design-tokens'
import { useState } from 'react'

// The consolidated preparation callout — collapsed summary, click to reveal the
// per-service detail IN PLACE. The web twin of apps/mobile's PreparationStrip,
// built from the same `computePreparationNotes` result so the desk and the
// patient read identical instructions for the same visit.
//
// Why it exists: the drawer previously rendered only `summaryAr`, whose copy is
// "بعض الخدمات المختارة تتطلب تحضيراً — اضغط لعرض التفاصيل" — an instruction to
// press something that was not there. The summary is written to be a HANDLE for
// the detail, so rendering it alone is a dead end.
//
// DECISION-provider-data-model §3: expandable inline, no modal, no
// "go review elsewhere" dead end.

export function PreparationStrip({ prep }: { prep: PreparationResult }) {
  const [isOpen, setIsOpen] = useState(false)

  if (prep.summaryAr === null) return null

  const hasDetails = prep.details.length > 0

  return (
    <div
      data-testid="prep-strip"
      style={{
        overflow: 'hidden',
        borderRadius: PREPARATION_NOTE.borderRadius,
        borderWidth: PREPARATION_NOTE.borderWidth,
        borderStyle: 'solid',
        borderColor: resolveTokenCss(PREPARATION_NOTE.borderColor),
        background: resolveTokenCss(PREPARATION_NOTE.background),
      }}
    >
      <button
        type="button"
        data-testid="prep-strip-toggle"
        aria-expanded={isOpen}
        disabled={!hasDetails}
        onClick={() => setIsOpen((open) => !open)}
        style={{
          width: '100%',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'none',
          border: 'none',
          font: 'inherit',
          textAlign: 'start',
          cursor: hasDetails ? 'pointer' : 'default',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 15 }}>
          ⚠
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: 600,
            lineHeight: 1.5,
            color: resolveTokenCss(PREPARATION_NOTE.bodyColor),
          }}
        >
          {prep.summaryAr}
        </span>
        {hasDetails ? (
          <span
            aria-hidden="true"
            style={{
              fontSize: 12,
              color: resolveTokenCss(PREPARATION_NOTE.titleColor),
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
            }}
          >
            ▼
          </span>
        ) : null}
      </button>

      {isOpen && hasDetails ? (
        <div
          data-testid="prep-strip-details"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderTop: `1px solid ${resolveTokenCss(PREPARATION_NOTE.borderColor)}`,
            padding: '2px 14px 12px',
          }}
        >
          {prep.details.map((detail) => (
            <div key={detail.noteAr} style={{ display: 'flex', gap: 8, paddingTop: 10 }}>
              <span
                aria-hidden="true"
                style={{ fontSize: 13, color: resolveTokenCss(PREPARATION_NOTE.titleColor) }}
              >
                •
              </span>
              <p
                style={{
                  margin: 0,
                  flex: 1,
                  fontSize: 13.5,
                  lineHeight: 1.7,
                  color: resolveTokenCss(PREPARATION_NOTE.bodyColor),
                }}
              >
                <strong style={{ fontWeight: 700 }}>{detail.serviceNamesAr.join('، ')}: </strong>
                {detail.noteAr}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { toArabicDigits } from '@instahealth/core'

import { signOut } from '../../app/login/actions'

// The sticky header from the approved design: branch + date, the fill pips,
// sound toggle, print, connection state, and the account block.
export function TodayHeader({
  branchNameAr,
  dateLabel,
  booked,
  capacity,
  displayName,
  isConnected,
  soundOn,
  onToggleSound,
}: {
  branchNameAr: string
  dateLabel: string
  booked: number
  capacity: number
  displayName: string
  isConnected: boolean
  soundOn: boolean
  onToggleSound: () => void
}) {
  return (
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
        // WRAPS rather than clips. At 150% zoom on the 1366 floor the row of
        // fixed controls needed 35px more than it had, and the shell's
        // `overflow: hidden` cut the LAST item — the user block with its
        // logout. An action being silently unreachable is the one outcome this
        // header may not have, so it grows a second line instead.
        flexWrap: 'wrap',
        rowGap: 8,
        columnGap: 16,
        minHeight: 56,
        boxSizing: 'border-box',
      }}
    >
      {/* A flex item's default `min-width: auto` refuses to shrink below its
          text, which is what pushed this header 72px past its container at
          150% zoom (measured). The name now truncates instead — but with a
          FLOOR of 96px, not 0: unbounded shrinking left it at 37px, two glyphs
          and an ellipsis, which identifies no branch at all. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 96 }}>
        <div
          data-testid="branch-name"
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: 'var(--ih-neutral-800)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {branchNameAr}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: 'var(--ih-neutral-500)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {dateLabel}
        </div>
      </div>

      <div style={{ width: 1, height: 32, flexShrink: 0, background: 'var(--ih-neutral-200)' }} />

      {/* Fill indicator — the number the whole business watches, so it gets
          the pips as well as the digits, and it does NOT shrink: this is the
          one number the desk is here to read. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: capacity }, (_, index) => (
            <div
              key={index}
              style={{
                width: 14,
                height: 8,
                borderRadius: 2,
                background: index < booked ? 'var(--ih-primary-400)' : 'var(--ih-neutral-200)',
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ih-neutral-600)' }}>
          <span
            data-testid="fill-indicator"
            style={{ fontWeight: 700, color: 'var(--ih-neutral-800)' }}
          >
            {toArabicDigits(String(booked))}/{toArabicDigits(String(capacity))}
          </span>{' '}
          محجوز اليوم
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        data-testid="sound-toggle"
        aria-pressed={soundOn}
        onClick={onToggleSound}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
          padding: '0 12px',
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: soundOn ? 'var(--ih-primary-400)' : 'var(--ih-neutral-200)',
          background: soundOn ? 'var(--ih-primary-50)' : 'var(--ih-neutral-0)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          font: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>
          {soundOn ? '🔔' : '🔕'}
        </span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: soundOn ? 'var(--ih-primary-700)' : 'var(--ih-neutral-600)',
          }}
        >
          تنبيه صوتي
        </span>
      </button>

      {/* Desks print the day's list — the design asked for it, and window.print
          is the whole implementation. */}
      <button
        type="button"
        data-testid="print-list"
        onClick={() => window.print()}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
          padding: '0 12px',
          borderRadius: 8,
          border: '1px solid var(--ih-neutral-200)',
          background: 'var(--ih-neutral-0)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          font: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 14 }}>
          🖨
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ih-neutral-600)' }}>
          طباعة القائمة
        </span>
      </button>

      <div
        data-testid="connection-dot"
        data-connected={isConnected ? 'yes' : 'no'}
        title={isConnected ? 'التحديث فوري' : 'سيتم التحديث تلقائياً كل دقيقة'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--ih-neutral-500)',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: isConnected ? 'var(--ih-success)' : 'var(--ih-neutral-400)',
          }}
        />
        {isConnected ? 'متصل' : 'غير متصل'}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingInlineStart: 16,
          borderInlineStart: '1px solid var(--ih-neutral-200)',
        }}
      >
        <div
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
          {displayName.slice(0, 1)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ih-neutral-700)' }}>
            {displayName}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              data-testid="logout"
              style={{
                fontSize: 11,
                color: 'var(--ih-neutral-500)',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              تسجيل خروج
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}

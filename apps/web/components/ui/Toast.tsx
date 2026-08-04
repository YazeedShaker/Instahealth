'use client'

import { TOAST, resolveTokenCss } from '@instahealth/design-tokens'
import { useEffect } from 'react'

// Thin shell over the shared contract — the transient confirmation from the
// Branch Details handoff. Success auto-dismisses (PRODUCT §6); positioning is
// BOTTOM-center over the content area (founder decision 2026-08-04, overriding
// the handoff's top placement). ⚠ The parent must be a NON-SCROLLING
// position:relative wrapper AROUND the scroll area — anchored inside the
// scroller itself, a bottom toast scrolls away with the content the moment
// the user has scrolled (and they have: the save button sits at the foot).
export function Toast({
  children,
  onDismiss,
  testId,
}: {
  children: string
  onDismiss: () => void
  testId?: string
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST.autoDismissMs)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className="ih-toast"
      role="status"
      data-testid={testId}
      style={{
        position: 'absolute',
        bottom: TOAST.offsetBottom,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: TOAST.gap,
        background: resolveTokenCss(TOAST.background),
        borderRadius: TOAST.borderRadius,
        padding: `${TOAST.paddingY}px ${TOAST.paddingX}px`,
        boxShadow: TOAST.shadow,
        animation: `ih-toast-in ${TOAST.animationMs}ms cubic-bezier(0.22,1,0.36,1)`,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: TOAST.iconSize,
          height: TOAST.iconSize,
          borderRadius: 999,
          background: resolveTokenCss(TOAST.iconBackground),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        ✓
      </span>
      <span
        style={{
          fontSize: TOAST.fontSize,
          fontWeight: TOAST.fontWeight,
          color: TOAST.color,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </div>
  )
}

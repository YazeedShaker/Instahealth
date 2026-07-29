'use client'

import {
  BUTTON_BASE,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  resolveTokenCss,
  type ButtonSize,
  type ButtonVariant,
} from '@instahealth/design-tokens'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

// A THIN shell over the shared contract — every value comes from
// packages/design-tokens/src/components.ts, none from this file. If a button
// looks wrong, the contract is wrong; do not patch it here (CLAUDE.md §3a).

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  icon?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  children,
  style,
  ...rest
}: ButtonProps) {
  const sizeSpec = BUTTON_SIZES[size]
  const variantSpec = BUTTON_VARIANTS[variant]
  const isDisabled = disabled || loading

  return (
    <button
      {...rest}
      disabled={isDisabled}
      data-variant={variant}
      data-size={size}
      style={{
        padding: `${sizeSpec.paddingY}px ${sizeSpec.paddingX}px`,
        fontSize: sizeSpec.fontSize,
        background: resolveTokenCss(variantSpec.background),
        color: resolveTokenCss(variantSpec.color),
        borderWidth: variantSpec.borderWidth,
        borderStyle: variantSpec.borderWidth > 0 ? 'solid' : 'none',
        borderColor:
          variantSpec.borderColor === null ? undefined : resolveTokenCss(variantSpec.borderColor),
        fontWeight: variantSpec.fontWeight,
        borderRadius: BUTTON_BASE.borderRadius,
        minHeight: BUTTON_BASE.minHeight,
        gap: BUTTON_BASE.gap,
        lineHeight: BUTTON_BASE.lineHeight,
        opacity: disabled ? BUTTON_BASE.disabledOpacity : loading ? BUTTON_BASE.loadingOpacity : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : undefined,
        fontFamily: 'inherit',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        transition: 'all var(--ih-duration-fast) var(--ih-ease-sharp)',
        ...style,
      }}
    >
      {loading ? (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            border: '2px solid rgba(255,255,255,0.4)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'ih-spin 0.8s linear infinite',
          }}
        />
      ) : null}
      {!loading && icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  )
}

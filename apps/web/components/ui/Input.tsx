'use client'

import { INPUT_BASE, resolveTokenCss } from '@instahealth/design-tokens'
import { useState, type InputHTMLAttributes, type ReactNode } from 'react'

// Thin shell over the shared contract. Focus state is local because the
// contract stores a focus colour, not a `:focus` rule — the same spec drives
// React Native, which has no pseudo-classes.
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  /** Rendered opposite the label — e.g. a "forgot password?" link. */
  labelAside?: ReactNode
  /** Sits inside the field on the inline-end side, e.g. a reveal toggle. */
  trailing?: ReactNode
}

export function Input({ label, labelAside, trailing, id, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: INPUT_BASE.gap }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
        <label
          htmlFor={id}
          style={{
            fontSize: INPUT_BASE.labelFontSize,
            fontWeight: INPUT_BASE.labelFontWeight,
            color: resolveTokenCss(INPUT_BASE.labelColor),
          }}
        >
          {label}
        </label>
        {labelAside}
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          {...rest}
          id={id}
          onFocus={(event) => {
            setFocused(true)
            rest.onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            rest.onBlur?.(event)
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            minHeight: INPUT_BASE.minHeight,
            paddingInline: INPUT_BASE.paddingX,
            paddingInlineEnd: trailing ? 52 : INPUT_BASE.paddingX,
            borderWidth: INPUT_BASE.borderWidth,
            borderStyle: 'solid',
            borderColor: resolveTokenCss(
              focused ? INPUT_BASE.focusBorderColor : INPUT_BASE.borderColor,
            ),
            borderRadius: INPUT_BASE.borderRadius,
            background: resolveTokenCss(INPUT_BASE.background),
            color: resolveTokenCss(INPUT_BASE.color),
            fontSize: INPUT_BASE.fontSize,
            fontFamily: 'var(--font-atkinson), sans-serif',
            outline: 'none',
            transition: 'border-color var(--ih-duration-fast) var(--ih-ease-sharp)',
            ...style,
          }}
        />
        {trailing ? (
          <div style={{ position: 'absolute', insetInlineEnd: 6, display: 'flex' }}>{trailing}</div>
        ) : null}
      </div>
    </div>
  )
}

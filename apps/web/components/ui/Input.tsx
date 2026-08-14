'use client'

import { INPUT_BASE, INPUT_ERROR, INPUT_HELP, resolveTokenCss } from '@instahealth/design-tokens'
import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

// Thin shell over the shared contract. Focus state is local because the
// contract stores a focus colour, not a `:focus` rule — the same spec drives
// React Native, which has no pseudo-classes.
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string
  /** Rendered opposite the label — e.g. a "forgot password?" link. */
  labelAside?: ReactNode
  /** Sits inside the field on the inline-end side, e.g. a reveal toggle. */
  trailing?: ReactNode
  /**
   * Resolved Arabic copy, or null when the field is fine. The shell does not
   * validate — it renders a verdict someone else reached, so the SAME rule can
   * drive the field, the submit button and the server action.
   *
   * ⚠ NOT A NEW VISUAL. `INPUT_ERROR` (field border + tint) and `INPUT_HELP`
   * (⚠ + the AA `#991B1B` from the Alert spec) are contract entries the Branch
   * Details handoff introduced and `BranchProfileView` already renders; this
   * moves them into the shared shell so every field errors identically instead
   * of the fourth screen hand-copying the third.
   */
  error?: string | null
  /** Quiet guidance under the field, shown only while there is no error. */
  helper?: string
  /** Declared explicitly so the error message can derive `<testid>-error`. */
  'data-testid'?: string
}

export function Input({
  label,
  labelAside,
  trailing,
  error = null,
  helper,
  id,
  style,
  'data-testid': testId,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const messageId = useId()
  const invalid = error !== null

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
          data-testid={testId}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid || helper !== undefined ? messageId : undefined}
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
            // PHYSICAL left, not paddingInlineEnd. These fields are dir="ltr"
            // (email/password) inside an RTL page, so the logical properties
            // resolve against DIFFERENT directions on the input and on its
            // container — the reveal button landed left while the reserved
            // space went right, and the placeholder ran under the icon.
            ...(trailing ? { paddingLeft: 52 } : null),
            borderWidth: INPUT_BASE.borderWidth,
            borderStyle: 'solid',
            // ⚠ The error border OUTRANKS focus. A field the user is currently
            // fixing is exactly the one that must keep saying it is wrong.
            borderColor: resolveTokenCss(
              invalid
                ? INPUT_ERROR.borderColor
                : focused
                  ? INPUT_BASE.focusBorderColor
                  : INPUT_BASE.borderColor,
            ),
            borderRadius: INPUT_BASE.borderRadius,
            background: resolveTokenCss(invalid ? INPUT_ERROR.background : INPUT_BASE.background),
            color: resolveTokenCss(INPUT_BASE.color),
            fontSize: INPUT_BASE.fontSize,
            fontFamily: 'var(--font-atkinson), sans-serif',
            outline: 'none',
            transition: 'border-color var(--ih-duration-fast) var(--ih-ease-sharp)',
            ...style,
          }}
        />
        {/* Physical left too, so it always sits over the padding reserved above. */}
        {trailing ? (
          <div style={{ position: 'absolute', left: 6, display: 'flex' }}>{trailing}</div>
        ) : null}
      </div>
      {/* `role="alert"` so the message is ANNOUNCED, not merely drawn — the
          whole defect being fixed here is a form that failed silently. */}
      {invalid ? (
        <span
          id={messageId}
          role="alert"
          data-testid={testId === undefined ? undefined : `${testId}-error`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: INPUT_HELP.fontSize,
            fontWeight: INPUT_HELP.errorFontWeight,
            color: INPUT_HELP.errorColor,
          }}
        >
          <span aria-hidden="true">⚠</span> {error}
        </span>
      ) : helper !== undefined ? (
        <span
          id={messageId}
          style={{ fontSize: INPUT_HELP.fontSize, color: resolveTokenCss(INPUT_HELP.color) }}
        >
          {helper}
        </span>
      ) : null}
    </div>
  )
}

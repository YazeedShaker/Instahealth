'use client'

import { emailFieldErrorKey, getErrorMessage } from '@instahealth/core'
import { INPUT_ERROR, INPUT_HELP, resolveTokenCss } from '@instahealth/design-tokens'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { adminSignIn, type AdminAuthState } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

const INITIAL: AdminAuthState = { errorAr: null }

export function AdminLoginForm({
  rejected = false,
  afterReset = false,
}: {
  rejected?: boolean
  afterReset?: boolean
}) {
  const [state, formAction] = useActionState(adminSignIn, INITIAL)
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)

  // This form was the least broken of the three — it has no disabled-submit
  // predicate, so `type="email" required` DID surface a native bubble. But a
  // browser bubble is the one error message in the product that is neither
  // Arabic nor ours, and the server's answer to a malformed address is the
  // deliberately vague «بيانات الدخول غير صحيحة» (correct for a login form —
  // it must not confirm which half was wrong). So the field says it here.
  const emailErrorKey = emailFieldErrorKey(email, emailTouched)
  const emailErrorAr = emailErrorKey === null ? null : getErrorMessage(emailErrorKey, 'ar')

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      {afterReset ? (
        <Alert type="info" testId="admin-login-reset-notice">
          أُلغي ربط تطبيق المصادقة. سجّل الدخول الآن واربط تطبيقاً جديداً — سيُطلب منك ذلك مباشرة.
        </Alert>
      ) : null}

      {rejected ? (
        <Alert type="error" testId="admin-login-rejected">
          هذا الحساب لا يملك صلاحية الدخول إلى لوحة الإدارة.
        </Alert>
      ) : null}

      {state.errorAr ? (
        <Alert type="error" testId="admin-login-error">
          {state.errorAr}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="admin-email" className="text-[13px] font-semibold text-ih-neutral-700">
          البريد الإلكتروني
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          dir="ltr"
          required
          autoComplete="username"
          data-testid="admin-email"
          value={email}
          aria-invalid={emailErrorAr !== null || undefined}
          aria-describedby={emailErrorAr !== null ? 'admin-email-error' : undefined}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={() => setEmailTouched(true)}
          className="min-h-[48px] w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 text-left text-[15px] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          style={{
            fontFamily: 'var(--font-atkinson), sans-serif',
            ...(emailErrorAr === null
              ? null
              : {
                  borderColor: resolveTokenCss(INPUT_ERROR.borderColor),
                  background: resolveTokenCss(INPUT_ERROR.background),
                }),
          }}
        />
        {emailErrorAr !== null ? (
          <span
            id="admin-email-error"
            role="alert"
            data-testid="admin-email-error"
            className="flex items-center gap-1.5"
            style={{
              fontSize: INPUT_HELP.fontSize,
              fontWeight: INPUT_HELP.errorFontWeight,
              color: INPUT_HELP.errorColor,
            }}
          >
            <span aria-hidden="true">⚠</span> {emailErrorAr}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="admin-password" className="text-[13px] font-semibold text-ih-neutral-700">
          كلمة المرور
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          dir="ltr"
          required
          autoComplete="current-password"
          data-testid="admin-password"
          className="min-h-[48px] w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 text-left text-[15px] tracking-[0.18em] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          style={{ fontFamily: 'var(--font-atkinson), sans-serif' }}
        />
      </div>

      <SubmitButton />
    </form>
  )
}

// ⚠ Pending comes from useFormStatus, which spans the whole action INCLUDING
// its redirect — not from a local boolean that resolves early. The §9 rule
// about pending spanning the write and its confirming read, applied to a form.
function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} data-testid="admin-login-submit">
      {pending ? 'جارٍ الدخول…' : 'متابعة'}
    </Button>
  )
}

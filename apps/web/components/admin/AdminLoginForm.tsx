'use client'

import { useActionState } from 'react'
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
          className="min-h-[48px] w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 text-left text-[15px] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          style={{ fontFamily: 'var(--font-atkinson), sans-serif' }}
        />
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

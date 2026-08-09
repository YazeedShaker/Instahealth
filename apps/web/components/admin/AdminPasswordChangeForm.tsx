'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { adminChangePassword, type AdminAuthState } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

const INITIAL: AdminAuthState = { errorAr: null }

export function AdminPasswordChangeForm() {
  const [state, formAction] = useActionState(adminChangePassword, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      {state.errorAr ? (
        <Alert type="error" testId="admin-password-error">
          {state.errorAr}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="new-password" className="text-[13px] font-semibold text-ih-neutral-700">
          كلمة المرور الجديدة
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          dir="ltr"
          required
          minLength={12}
          autoFocus
          autoComplete="new-password"
          data-testid="admin-new-password"
          className="min-h-[48px] w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 text-left text-[15px] tracking-[0.18em] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          style={{ fontFamily: 'var(--font-atkinson), sans-serif' }}
        />
        <span className="text-[12px] text-ih-neutral-600">١٢ حرفاً على الأقل.</span>
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="confirm-password" className="text-[13px] font-semibold text-ih-neutral-700">
          تأكيد كلمة المرور
        </label>
        <input
          id="confirm-password"
          name="confirm"
          type="password"
          dir="ltr"
          required
          autoComplete="new-password"
          data-testid="admin-confirm-password"
          className="min-h-[48px] w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 text-left text-[15px] tracking-[0.18em] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          style={{ fontFamily: 'var(--font-atkinson), sans-serif' }}
        />
      </div>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} data-testid="admin-password-submit">
      {pending ? 'جارٍ الحفظ…' : 'احفظ وتابع'}
    </Button>
  )
}

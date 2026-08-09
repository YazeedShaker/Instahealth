'use client'

import { toArabicDigits } from '@instahealth/core'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { adminVerifyTotp, type AdminAuthState } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { TotpCodeInput } from './TotpCodeInput'

const INITIAL: AdminAuthState = { errorAr: null }

export function AdminVerifyForm({
  initialAttemptsRemaining,
  initialLockedUntil,
  recoveryCodesRemaining,
}: {
  initialAttemptsRemaining: number
  initialLockedUntil: string | null
  recoveryCodesRemaining: number
}) {
  const [state, formAction] = useActionState(adminVerifyTotp, INITIAL)

  // ⚠ DISPLAY = ENFORCEMENT (§1.4). Both numbers come from the SERVER — the
  // page's first render reads get_admin_auth_state(), and each failed attempt
  // returns the freshly-decremented counter from record_admin_totp_failure().
  // Nothing here counts locally, so the copy cannot claim attempts the server
  // will not honour.
  const attemptsRemaining = state.attemptsRemaining ?? initialAttemptsRemaining
  const lockedUntil = state.lockedUntil ?? initialLockedUntil
  const isLocked = Boolean(lockedUntil && new Date(lockedUntil) > new Date())
  const errored = Boolean(state.errorAr)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isLocked ? (
        <Alert type="error" testId="admin-verify-locked">
          تم قفل الدخول ١٥ دقيقة بعد ٥ محاولات خاطئة. سيُفتح وحده — لا شيء يُحذف، ولا حاجة لتدخّل
          أحد.
        </Alert>
      ) : state.errorAr ? (
        <Alert type="error" testId="admin-verify-error">
          {state.errorAr}
          {attemptsRemaining > 0
            ? ` بقيت لك ${toArabicDigits(String(attemptsRemaining))} محاولات قبل قفل الدخول ١٥ دقيقة.`
            : ''}
        </Alert>
      ) : null}

      <TotpCodeInput errored={errored} disabled={isLocked} />

      <SubmitButton locked={isLocked} errored={errored} />

      <div className="flex flex-col gap-2.5 border-t border-ih-neutral-200 pt-3">
        {/* The design shows this link only when unconsumed codes exist —
            offering a recovery route with nothing behind it is a dead end. */}
        {recoveryCodesRemaining > 0 ? (
          <Link
            href="/admin/login/recovery"
            data-testid="admin-recovery-link"
            className="text-[12.5px] font-bold text-ih-primary-600 underline"
          >
            استخدم رمز استعادة بدلاً من ذلك
          </Link>
        ) : null}
        <span className="text-[12px] leading-[1.7] text-ih-neutral-600">
          {errored
            ? 'تأخُّر ساعة هاتفك عن الوقت الحقيقي يُبطِل الرموز كلها — راجع مزامنة الوقت في إعدادات الهاتف.'
            : 'كل رمز استعادة يعمل مرة واحدة. إن استخدمت واحداً، ولّد مجموعة جديدة بعد الدخول.'}
        </span>
      </div>
    </form>
  )
}

function SubmitButton({ locked, errored }: { locked: boolean; errored: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="lg"
      fullWidth
      disabled={locked}
      loading={pending}
      data-testid="admin-verify-submit"
    >
      {pending ? 'جارٍ التحقق…' : errored ? 'حاول مرة أخرى' : 'دخول'}
    </Button>
  )
}

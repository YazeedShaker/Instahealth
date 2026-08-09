'use client'

import { toArabicDigits } from '@instahealth/core'
import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { adminUseRecoveryCode, type AdminAuthState } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

const INITIAL: AdminAuthState = { errorAr: null }

export function AdminRecoveryForm({ remaining }: { remaining: number }) {
  const [state, formAction] = useActionState(adminUseRecoveryCode, INITIAL)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* ⚠ The consequence is stated BEFORE the input, not after the click.
          This action ends every session and unbinds the authenticator — the
          founder should know that while deciding, not while recovering. */}
      <Alert type="warning" testId="admin-recovery-consequence">
        سيُلغى ربط تطبيق المصادقة الحالي وتُغلق كل الجلسات. ستحتاج إلى ربط تطبيق جديد فور دخولك.
      </Alert>

      {state.errorAr ? (
        <Alert type="error" testId="admin-recovery-error">
          {state.errorAr}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-[7px]">
        <label htmlFor="recovery-code" className="text-[13px] font-semibold text-ih-neutral-700">
          رمز الاستعادة
        </label>
        <input
          id="recovery-code"
          name="code"
          dir="ltr"
          required
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="ABCD-2345"
          maxLength={9}
          data-testid="admin-recovery-input"
          className="min-h-[48px] w-full rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5 text-left text-[17px] font-bold uppercase tracking-[0.14em] text-ih-neutral-800 outline-none focus:border-ih-primary-400"
          style={{ fontFamily: 'var(--font-atkinson), sans-serif' }}
        />
        <span className="text-[12px] text-ih-neutral-600">
          بقي لديك {toArabicDigits(String(remaining))} من ٨ رموز غير مستخدمة.
        </span>
      </div>

      <SubmitButton />

      <div className="border-t border-ih-neutral-200 pt-3">
        <Link
          href="/admin/login/verify"
          data-testid="admin-recovery-back"
          className="text-[12.5px] font-bold text-ih-primary-600 underline"
        >
          العودة إلى إدخال رمز التطبيق
        </Link>
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" fullWidth loading={pending} data-testid="admin-recovery-submit">
      {pending ? 'جارٍ التحقق…' : 'استخدم الرمز وألغِ الربط'}
    </Button>
  )
}

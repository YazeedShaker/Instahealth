'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '../../lib/supabase/client'
import { completeProviderPasswordChangeAction } from '../../app/login/change-password-action'
import { Button } from '../ui/Button'

// A05 — «سيُطلب تغيير كلمة المرور المؤقتة عند أول دخول».
//
// ⚠ THE ORDER IS LOAD-BEARING. `auth.updateUser({ password })` runs FIRST and
// its error is checked; only if it genuinely succeeded is the server told to
// clear the must-change flag. Postgres cannot see a GoTrue password change —
// `auth.users` has no `password_changed_at` — so the RPC trusts this sequence,
// and the sequence is the only thing that makes the trust warranted. Firing the
// RPC first, or ignoring the update's error, would clear the flag while the
// temp password stayed live.

const MIN_LENGTH = 10

export function ProviderPasswordChangeForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = confirmation.length > 0 && password !== confirmation
  const ready = password.length >= MIN_LENGTH && password === confirmation && !busy

  const submit = async () => {
    setBusy(true)
    setErrorAr(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        // ⚠ Return WITHOUT calling the RPC. The flag must not clear.
        setErrorAr('تعذّر تغيير كلمة المرور. جرّب كلمة أخرى أو أعد تسجيل الدخول.')
        return
      }
      const result = await completeProviderPasswordChangeAction()
      if (!result.ok) {
        setErrorAr(result.errorAr)
        return
      }
      router.replace('/dashboard/today')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      dir="rtl"
      data-testid="provider-change-password"
      className="flex min-h-screen items-center justify-center bg-ih-neutral-100 p-6"
    >
      <div className="flex w-[440px] max-w-full flex-col gap-4 rounded-2xl bg-white p-7 shadow-lg">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[19px] font-extrabold text-ih-neutral-800">اختر كلمة مرور جديدة</h1>
          <p className="text-[13px] leading-[1.7] text-ih-neutral-600">
            دخلتَ بكلمة مرور مؤقتة من الإدارة. اخترْ كلمة خاصة بك للمتابعة — لن تُطلب منك مرة أخرى.
          </p>
        </div>

        {errorAr !== null ? (
          <p
            role="alert"
            data-testid="provider-change-password-error"
            className="rounded-lg bg-ih-neutral-100 px-3.5 py-2.5 text-[12.5px] text-ih-neutral-800"
          >
            {errorAr}
          </p>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ih-neutral-700">
            كلمة المرور الجديدة
          </span>
          <input
            type="password"
            autoComplete="new-password"
            data-testid="provider-new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
          />
          <span className="text-[11.5px] text-ih-neutral-500">
            {tooShort ? 'عشرة أحرف على الأقل.' : 'عشرة أحرف على الأقل — استخدم مدير كلمات مرور.'}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ih-neutral-700">تأكيد كلمة المرور</span>
          <input
            type="password"
            autoComplete="new-password"
            data-testid="provider-confirm-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
          />
          {mismatch ? (
            <span className="text-[11.5px] text-ih-neutral-700">الكلمتان غير متطابقتين.</span>
          ) : null}
        </label>

        <Button
          size="md"
          fullWidth
          data-testid="provider-change-password-submit"
          disabled={!ready}
          loading={busy}
          onClick={() => void submit()}
        >
          حفظ ومتابعة
        </Button>
      </div>
    </main>
  )
}

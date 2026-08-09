'use client'

import { ADMIN_ACCENT } from '@instahealth/design-tokens'
import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

import { adminConfirmEnrollment, adminRegenerateRecoveryCodes } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'
import { TotpCodeInput } from './TotpCodeInput'

// Screen D — the whole enrollment interaction, in ONE client component.
//
// ⚠ THE ONE-COMPONENT SHAPE IS THE BUG FIX, not a tidying. Read this before
// splitting it up again.
//
// Confirming enrollment is a SERVER ACTION, and a server action revalidates its
// route — so the page re-renders with the post-action state. The gate then sees
// an enrolled admin whose codes are unacknowledged and wants to render a
// DIFFERENT screen. When the page swapped one component for another at that
// moment, React saw a different element type, unmounted the first, and
// **destroyed the `useActionState` state holding the eight one-time recovery
// codes** — which exist nowhere else, because the database stores only bcrypt
// hashes. The founder scanned a QR and was told the codes "were shown and not
// confirmed" without ever having seen them.
//
// Migration 20260808231917 made the acknowledgement server state, which was
// necessary but NOT sufficient: it stopped the redirect and left the component
// swap. The swap is the other half. The page now renders THIS component in both
// states and passes `codesPending` as a prop, so the element type and position
// never change and React keeps the instance — and the codes — alive across the
// revalidation.
//
// ⚠ My verification missed it because by the time I re-tested, the account was
// already in the codes-pending state, so I exercised the REGENERATE path and
// never re-ran a fresh enrollment. Re-test this from a genuinely reset account
// (`supabase/seeds/006_admin_e2e_reset.sql`), not from whatever state the last
// attempt left behind.
export function AdminEnrollFlow({
  qrSvg,
  factorId,
  secret,
  codesPending,
  enrollErrorAr,
}: {
  qrSvg: string | null
  factorId: string | null
  secret: string | null
  /** A batch was minted and never confirmed saved. The factor is fine. */
  codesPending: boolean
  enrollErrorAr: string | null
}) {
  const [state, formAction] = useActionState(adminConfirmEnrollment, {
    errorAr: null as string | null,
    codes: undefined as string[] | undefined,
  })
  const [regenerated, setRegenerated] = useState<string[] | undefined>(undefined)
  const [regenerateError, setRegenerateError] = useState<string | null>(null)
  const [regenerating, startRegenerate] = useTransition()

  const codes = state.codes ?? regenerated

  const regenerate = () => {
    setRegenerateError(null)
    startRegenerate(async () => {
      const result = await adminRegenerateRecoveryCodes()
      if (result.codes) setRegenerated(result.codes)
      else setRegenerateError(result.errorAr)
    })
  }

  const showingCodes = Boolean(codes)
  const heading = showingCodes
    ? 'احفظ رموز الاستعادة'
    : codesPending
      ? 'رموز الاستعادة لم تُحفظ بعد'
      : 'فعّل الخطوة الثانية قبل الدخول'
  const subheading = showingCodes
    ? 'تُعرض مرة واحدة — انسخها الآن'
    : codesPending
      ? 'تطبيق المصادقة مربوط — الناقص هو الرموز'
      : 'إجراء لمرة واحدة — لا يمكن تخطّيه'

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-ih-neutral-100 p-8 font-arabic"
    >
      <div className="w-full max-w-[760px] overflow-hidden rounded-2xl border border-ih-neutral-200 bg-white shadow-sm">
        <div
          className="flex items-center gap-3 px-[22px] py-[18px]"
          style={{ background: ADMIN_ACCENT.ink }}
        >
          <Logo variant="white" size={30} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-extrabold text-white">{heading}</span>
            <span className="text-[12px] text-white/80">{subheading}</span>
          </div>
        </div>

        {codes ? (
          <div className="p-[22px]">
            <RecoveryCodesPanel codes={codes} />
          </div>
        ) : codesPending ? (
          // The honest dead end. The old plaintext is gone — bcrypt hashes are
          // all that exist — so offering to "show them again" would be a lie.
          <div className="flex flex-col gap-4 p-[22px]">
            <Alert type="warning" testId="admin-codes-lost">
              المجموعة السابقة لم تُحفَظ، ولا يمكن عرضها مرة أخرى — الرموز محفوظة مُعمّاة في قاعدة
              البيانات، ولا يستطيع أحد استخراجها، ولا نحن.
            </Alert>
            <p className="text-[13.5px] leading-[1.8] text-ih-neutral-600">
              ولّد مجموعة جديدة الآن. المجموعة الجديدة تُلغي القديمة تماماً، فلن يعمل أي رمز من
              المجموعة السابقة بعدها. لا يمكنك متابعة الدخول قبل حفظ مجموعة صالحة — رموز الاستعادة
              هي طريقك الوحيد إن فقدت هاتفك.
            </p>
            {regenerateError ? (
              <Alert type="error" testId="admin-regenerate-error">
                {regenerateError}
              </Alert>
            ) : null}
            <div className="flex justify-end">
              <Button
                type="button"
                size="md"
                loading={regenerating}
                onClick={regenerate}
                data-testid="admin-regenerate-codes"
              >
                {regenerating ? 'جارٍ التوليد…' : 'ولّد مجموعة جديدة'}
              </Button>
            </div>
          </div>
        ) : enrollErrorAr || !qrSvg || !factorId || !secret ? (
          <div className="p-[22px]">
            <Alert type="error" testId="admin-enroll-error">
              {enrollErrorAr ?? 'تعذّر بدء الربط. حدّث الصفحة وحاول مرة أخرى.'}
            </Alert>
          </div>
        ) : (
          // ⚠ `220px minmax(0,1fr)` per the handoff. The 1fr is written as
          // minmax(0,1fr) deliberately — VIEW-01 showed a bare `1fr` cannot
          // shrink below its content's min-content width and overflows a
          // hidden container instead.
          <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-[22px] p-[22px] max-lg:grid-cols-1">
            <div className="flex flex-col items-center gap-2.5">
              <div
                className="flex h-[180px] w-[180px] items-center justify-center rounded-xl border-[1.5px] border-ih-neutral-200 bg-white p-3"
                data-testid="admin-enroll-qr"
                // Generated by `qrcode` server-side from a URI we constructed —
                // never from anything a request can influence.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <span className="text-center text-[11.5px] leading-[1.6] text-ih-neutral-600">
                امسحه بتطبيق المصادقة
                <br />
                (Google Authenticator أو Authy)
              </span>
              <span
                dir="ltr"
                data-testid="admin-enroll-secret"
                className="rounded-md bg-ih-neutral-100 px-2.5 py-1.5 text-[11.5px] font-bold tracking-[0.08em] text-ih-neutral-700"
                style={{ fontFamily: 'var(--font-atkinson), sans-serif' }}
              >
                {/* Grouped in fours, as the design shows the manual key — it is
                    going to be typed by hand on a phone. */}
                {secret.replace(/(.{4})/g, '$1 ').trim()}
              </span>
              <span className="text-center text-[11px] text-ih-neutral-500">
                أو أدخل هذا المفتاح يدوياً
              </span>
            </div>

            <form action={formAction} className="flex min-w-0 flex-col gap-4">
              <input type="hidden" name="factorId" value={factorId} />

              {state.errorAr ? (
                <Alert type="error" testId="admin-enroll-verify-error">
                  {state.errorAr}
                </Alert>
              ) : null}

              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-semibold text-ih-neutral-700">
                  أدخل الرمز الذي يظهر في التطبيق لتأكيد الربط
                </label>
                <TotpCodeInput errored={Boolean(state.errorAr)} />
              </div>

              <div className="flex items-center justify-end">
                <ConfirmButton />
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

function ConfirmButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="md" loading={pending} data-testid="admin-enroll-submit">
      {pending ? 'جارٍ الربط…' : 'تأكيد الربط والدخول'}
    </Button>
  )
}

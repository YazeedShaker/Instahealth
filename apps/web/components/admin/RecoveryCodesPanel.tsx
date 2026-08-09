'use client'

import { RECOVERY_CODE_CELL, resolveTokenCss } from '@instahealth/design-tokens'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { adminAcknowledgeRecoveryCodes } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'

// The one-time display of eight recovery codes, per the enrollment screen.
// Shared by the enrollment flow and the regenerate flow — the codes are the
// same artifact in both, so they get one component.
//
// ⚠ THE CHECKBOX IS NOT COSMETIC AND IT IS NOT CLIENT-ONLY. It calls
// `acknowledge_admin_recovery_codes()`, and until that returns the gate keeps
// routing back here. Migration 20260808231917 explains why: a purely local
// boolean was silently defeated by Next's post-action revalidation, which
// redirected past this panel and destroyed a batch of codes nobody ever saw.
export function RecoveryCodesPanel({ codes }: { codes: string[] }) {
  const [saved, setSaved] = useState(false)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const download = () => {
    // A blob built in the browser — the plaintext must not travel to a server
    // again, not even ours.
    const body = [
      'InstaHealth — رموز استعادة لوحة الإدارة',
      'كل رمز يعمل مرة واحدة فقط. احفظ هذا الملف خارج جهازك.',
      'الرمز لا يسجّل الدخول — يسمح بإلغاء ربط تطبيق المصادقة وربط تطبيق جديد.',
      '',
      ...codes,
    ].join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'instahealth-admin-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const confirm = () => {
    setErrorAr(null)
    startTransition(async () => {
      const result = await adminAcknowledgeRecoveryCodes()
      if (!result.ok) {
        setErrorAr(result.errorAr)
        return
      }
      router.replace('/admin/overview')
      router.refresh()
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-4" data-testid="admin-recovery-codes-panel">
      <div className="overflow-hidden rounded-xl border border-ih-neutral-200">
        <div className="flex items-center justify-between gap-2.5 border-b border-ih-neutral-200 bg-ih-neutral-50 px-3.5 py-[11px]">
          <span className="text-[12.5px] font-bold text-ih-neutral-700">
            رموز الاستعادة — ٨ رموز
          </span>
          <span
            className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ color: '#92400E', background: 'var(--ih-warning-bg)' }}
          >
            تُعرض مرة واحدة
          </span>
        </div>

        <div
          dir="ltr"
          className="grid px-3.5 py-3"
          style={{
            gridTemplateColumns: `repeat(${RECOVERY_CODE_CELL.columns}, minmax(0, 1fr))`,
            gap: RECOVERY_CODE_CELL.gap,
          }}
        >
          {codes.map((code) => (
            <span
              key={code}
              data-testid="admin-recovery-code"
              className="text-center"
              style={{
                fontFamily: 'var(--font-atkinson), sans-serif',
                padding: `${RECOVERY_CODE_CELL.paddingY}px 0`,
                borderRadius: RECOVERY_CODE_CELL.borderRadius,
                fontSize: RECOVERY_CODE_CELL.fontSize,
                fontWeight: RECOVERY_CODE_CELL.fontWeight,
                letterSpacing: `${RECOVERY_CODE_CELL.letterSpacing}em`,
                color: resolveTokenCss(RECOVERY_CODE_CELL.color),
                background: resolveTokenCss(RECOVERY_CODE_CELL.background),
                border: `${RECOVERY_CODE_CELL.borderWidth}px solid ${resolveTokenCss(RECOVERY_CODE_CELL.borderColor)}`,
              }}
            >
              {code}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-ih-neutral-200 bg-ih-neutral-50 px-3.5 py-[11px]">
          <span className="text-[11.5px] leading-[1.6] text-ih-neutral-600">
            إن فقدت هاتفك ورموزك معاً، لا طريق للدخول إلا من قاعدة البيانات مباشرة.
          </span>
          <div className="flex-1" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={download}
            data-testid="admin-download-codes"
          >
            تنزيل الرموز
          </Button>
        </div>
      </div>

      {/* ⚠ A recovery code UNBINDS the authenticator — it does not sign anyone
          in. The design's line implied a login; founder ruling ② changed the
          mechanism, so the copy changes with it rather than describing a flow
          that does not exist. Flagged for the bundle's next revision. */}
      <Alert type="info" testId="admin-recovery-semantics">
        رمز الاستعادة لا يسجّل دخولك — يسمح لك بإلغاء ربط التطبيق المفقود وربط تطبيق جديد. ستحتاج
        كلمة المرور معه.
      </Alert>

      {errorAr ? (
        <Alert type="error" testId="admin-acknowledge-error">
          {errorAr}
        </Alert>
      ) : null}

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          data-testid="admin-codes-saved"
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-[1.5px] border-ih-neutral-300"
        />
        <span className="text-[12.5px] leading-[1.6] text-ih-neutral-700">
          حفظتُ رموز الاستعادة في مكان آمن خارج هذا الجهاز.
        </span>
      </label>

      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="md"
          disabled={!saved}
          loading={pending}
          data-testid="admin-enroll-continue"
          onClick={confirm}
        >
          {pending ? 'جارٍ الحفظ…' : 'متابعة إلى اللوحة'}
        </Button>
      </div>
    </div>
  )
}

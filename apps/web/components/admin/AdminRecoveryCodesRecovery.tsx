'use client'

import { ADMIN_ACCENT } from '@instahealth/design-tokens'
import { useState, useTransition } from 'react'

import { adminRegenerateRecoveryCodes } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'

// The honest dead-end screen. Reached when a batch of one-time codes was
// generated but never confirmed as saved — a reload, a closed tab, or the
// revalidation redirect that migration 20260808231917 exists because of.
//
// ⚠ It does NOT pretend the old codes can be recovered. They are bcrypt hashes;
// the plaintext is gone. Offering to "show them again" would be a lie, so the
// screen states the situation and offers the only real remedy — a new set,
// which supersedes the old one. That is «ولّد مجموعة جديدة بعد الدخول» from the
// design doing actual work.
export function AdminRecoveryCodesRecovery() {
  const [codes, setCodes] = useState<string[] | undefined>(undefined)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const regenerate = () => {
    setErrorAr(null)
    startTransition(async () => {
      const result = await adminRegenerateRecoveryCodes()
      if (result.codes) setCodes(result.codes)
      else setErrorAr(result.errorAr)
    })
  }

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
            <span className="text-[15px] font-extrabold text-white">
              رموز الاستعادة لم تُحفظ بعد
            </span>
            <span className="text-[12px] text-white/80">
              تطبيق المصادقة مربوط — الناقص هو الرموز
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-[22px]">
          {codes ? (
            <RecoveryCodesPanel codes={codes} />
          ) : (
            <>
              <Alert type="warning" testId="admin-codes-lost">
                المجموعة السابقة عُرضت ولم تُؤكَّد، ولا يمكن عرضها مرة أخرى — الرموز محفوظة مُعمّاة
                في قاعدة البيانات، ولا يستطيع أحد استخراجها، ولا نحن.
              </Alert>

              <p className="text-[13.5px] leading-[1.8] text-ih-neutral-600">
                ولّد مجموعة جديدة الآن. المجموعة الجديدة تُلغي القديمة تماماً، فلن يعمل أي رمز من
                المجموعة السابقة بعدها. لا يمكنك متابعة الدخول قبل حفظ مجموعة صالحة — رموز الاستعادة
                هي طريقك الوحيد إن فقدت هاتفك.
              </p>

              {errorAr ? (
                <Alert type="error" testId="admin-regenerate-error">
                  {errorAr}
                </Alert>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  size="md"
                  loading={pending}
                  onClick={regenerate}
                  data-testid="admin-regenerate-codes"
                >
                  {pending ? 'جارٍ التوليد…' : 'ولّد مجموعة جديدة'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

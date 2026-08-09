'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { adminConfirmEnrollment } from '../../app/admin/actions'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { RecoveryCodesPanel } from './RecoveryCodesPanel'
import { TotpCodeInput } from './TotpCodeInput'

interface EnrollState {
  errorAr: string | null
  codes?: string[]
}

const INITIAL: EnrollState = { errorAr: null }

export function AdminEnrollForm({ factorId }: { factorId: string }) {
  const [state, formAction] = useActionState(adminConfirmEnrollment, INITIAL)

  // Two phases in one component because they are one continuous act: confirm
  // the binding, then read the codes it produced. The codes exist ONLY in this
  // response — they are bcrypt-hashed server-side and cannot be fetched again.
  if (state.codes) return <RecoveryCodesPanel codes={state.codes} />

  return (
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

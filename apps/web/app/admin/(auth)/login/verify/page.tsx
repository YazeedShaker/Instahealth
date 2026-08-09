import { redirect } from 'next/navigation'

import { AdminAuthLayout } from '../../../../../components/admin/AdminAuthLayout'
import { AdminVerifyForm } from '../../../../../components/admin/AdminVerifyForm'
import { getAdminContext } from '../../../../../lib/auth/admin'

export const dynamic = 'force-dynamic'

// Screens B and C of the handoff — the TOTP step and its wrong-code state.
export default async function AdminVerifyPage() {
  const lookup = await getAdminContext()

  if (lookup.kind === 'signedOut' || lookup.kind === 'notAdmin') redirect('/admin/login')
  if (lookup.kind === 'needsPasswordChange') redirect('/admin/login/change-password')
  // No factor → the enrollment screen. Showing a verify box for a factor that
  // does not exist is the brick: there would be no code that could ever work.
  if (lookup.kind === 'needsEnrollment') redirect('/admin/login/enroll')
  // Codes minted but never confirmed saved — the enrollment screen owns
  // that conversation (migration 20260808231917).
  if (lookup.kind === 'needsRecoveryCodes') redirect('/admin/login/enroll')
  if (lookup.kind === 'ok') redirect('/admin/overview')

  return (
    <AdminAuthLayout
      panelTitle={
        <>
          الخطوة الثانية تحمي
          <br />
          ما لا يُمكن التراجع عنه
        </>
      }
      panelBody="من هذه اللوحة تتغيّر نسب الاتفاق، وتُصدَر الكشوف، وتُخفى الفروع من المرضى. كلمة مرور مسروقة لا تكفي للوصول إليها."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-arabic text-[22px] font-extrabold text-ih-neutral-800">
          أدخل رمز التحقق
        </h1>
        <p className="text-[13.5px] leading-[1.7] text-ih-neutral-600">
          من تطبيق المصادقة على هاتفك — الرمز يتغيّر كل ٣٠ ثانية.
        </p>
      </div>

      <AdminVerifyForm
        initialAttemptsRemaining={lookup.attemptsRemaining}
        initialLockedUntil={lookup.lockedUntil}
        recoveryCodesRemaining={lookup.context.recoveryCodesRemaining}
      />
    </AdminAuthLayout>
  )
}

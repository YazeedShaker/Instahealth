import { redirect } from 'next/navigation'

import { AdminAuthLayout } from '../../../../../components/admin/AdminAuthLayout'
import { AdminRecoveryForm } from '../../../../../components/admin/AdminRecoveryForm'
import { getAdminContext } from '../../../../../lib/auth/admin'

export const dynamic = 'force-dynamic'

// The recovery path. The handoff draws only the LINK to it («استخدم رمز
// استعادة بدلاً من ذلك»), not the destination, so this screen is composed from
// the component contract and the verify screen's anatomy — which SPEC-A01 §B
// explicitly asks for ("recovery-code entry path"). §9's second branch.
export default async function AdminRecoveryPage() {
  const lookup = await getAdminContext()

  if (lookup.kind === 'signedOut' || lookup.kind === 'notAdmin') redirect('/admin/login')
  if (lookup.kind === 'needsPasswordChange') redirect('/admin/login/change-password')
  // No factor already → nothing to recover FROM. Enrolment is the right screen.
  if (lookup.kind === 'needsEnrollment') redirect('/admin/login/enroll')
  // Codes minted but never confirmed saved — the enrollment screen owns
  // that conversation (migration 20260808231917).
  if (lookup.kind === 'needsRecoveryCodes') redirect('/admin/login/enroll')
  if (lookup.kind === 'ok') redirect('/admin/overview')

  // No unconsumed codes → the route is a dead end, so don't render it.
  if (lookup.context.recoveryCodesRemaining === 0) redirect('/admin/login/verify')

  return (
    <AdminAuthLayout
      panelTitle={
        <>
          الرمز يفكّ الارتباط
          <br />
          ولا يفتح الباب
        </>
      }
      panelBody="رمز الاستعادة يلغي ربط تطبيق المصادقة المفقود ويُنهي كل الجلسات، ثم تربط تطبيقاً جديداً بكلمة مرورك. لا يمنحك دخولاً بذاته."
      panelFootnote="كل رمز يعمل مرة واحدة. بعد الاستخدام، ولّد مجموعة جديدة."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-arabic text-[22px] font-extrabold text-ih-neutral-800">
          استخدم رمز استعادة
        </h1>
        <p className="text-[13.5px] leading-[1.7] text-ih-neutral-600">
          أدخل أحد الرموز الثمانية التي حفظتها عند الربط.
        </p>
      </div>

      <AdminRecoveryForm remaining={lookup.context.recoveryCodesRemaining} />
    </AdminAuthLayout>
  )
}

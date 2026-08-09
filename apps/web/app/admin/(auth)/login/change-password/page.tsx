import { redirect } from 'next/navigation'

import { AdminAuthLayout } from '../../../../../components/admin/AdminAuthLayout'
import { AdminPasswordChangeForm } from '../../../../../components/admin/AdminPasswordChangeForm'
import { getAdminContext } from '../../../../../lib/auth/admin'

export const dynamic = 'force-dynamic'

// The forced first-login password change. The handoff does not draw this
// screen — it draws its CONSEQUENCE («لا استعادة ذاتية — الحساب الوحيد يُدار
// يدوياً») — so it is composed from the login screen's own anatomy, which
// SPEC-A01's test list requires ("temp password → change → enroll"). §9's
// second branch: the spec instructs, the contract supplies.
//
// ⚠ It comes BEFORE enrollment on purpose. The temp password arrived through a
// seed and an environment variable and may exist in a shell history or a CI
// log; binding a second factor to an account still holding it would be
// protecting the wrong credential.
export default async function AdminChangePasswordPage() {
  const lookup = await getAdminContext()

  if (lookup.kind === 'signedOut' || lookup.kind === 'notAdmin') redirect('/admin/login')
  if (lookup.kind !== 'needsPasswordChange') {
    // Already changed — the gate decides where they actually belong.
    redirect('/admin/overview')
  }

  return (
    <AdminAuthLayout
      panelTitle={
        <>
          كلمة المرور المؤقتة
          <br />
          ليست كلمة مرور
        </>
      }
      panelBody="وصلت هذه الكلمة عبر ملف تهيئة ومتغيّر بيئة، وقد تكون موجودة في سجل طرفية أو سجل نشر. استبدلها الآن، قبل ربط أي تطبيق مصادقة."
      panelFootnote="لا يوجد إعادة تعيين ذاتية لاحقاً — اختر كلمة تحفظها في مدير كلمات المرور."
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-arabic text-[22px] font-extrabold text-ih-neutral-800">
          اختر كلمة مرور جديدة
        </h1>
        <p className="text-[13.5px] leading-[1.7] text-ih-neutral-600">
          خطوة إلزامية لمرة واحدة قبل الدخول إلى اللوحة.
        </p>
      </div>

      <AdminPasswordChangeForm />
    </AdminAuthLayout>
  )
}

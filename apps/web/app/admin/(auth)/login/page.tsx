import { redirect } from 'next/navigation'

import { AdminLoginForm } from '../../../../components/admin/AdminLoginForm'
import { AdminAuthBrand, AdminAuthLayout } from '../../../../components/admin/AdminAuthLayout'
import { getAdminContext } from '../../../../lib/auth/admin'

export const dynamic = 'force-dynamic'

// Screen A of `Admin - Login and TOTP.dc.html`.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ rejected?: string; reset?: string }>
}) {
  const params = await searchParams
  const lookup = await getAdminContext()

  // Already through the door — don't show a login form to a signed-in admin.
  // ⚠ But NOT when they were just rejected or just reset: those states have a
  // session and would ping-pong between here and the gate forever. Same
  // infinite-loop shape P01 hit, avoided the same way.
  if (lookup.kind === 'ok' && !params.rejected && !params.reset) redirect('/admin/overview')
  // Mid-flow states route themselves; the gate in (shell) is the authority.
  if (lookup.kind === 'needsRecoveryCodes') redirect('/admin/login/enroll')

  return (
    <AdminAuthLayout
      panelTitle={
        <>
          صلاحية واسعة
          <br />
          تستحق خطوة ثانية
        </>
      }
      panelBullets={[
        'نسب الاتفاق وكشوف الحساب',
        'تفعيل الفروع وإخفاؤها من المرضى',
        'حسابات الشركاء وصلاحياتها',
      ]}
    >
      <div className="flex flex-col gap-3.5">
        <AdminAuthBrand />
        <div className="flex flex-col gap-1.5">
          <h1 className="font-arabic text-[24px] font-extrabold text-ih-neutral-800">
            لوحة الإدارة
          </h1>
          <p className="text-[14px] leading-[1.7] text-ih-neutral-600">
            هذه اللوحة تتحكم في شبكة المزودين كلها وفي ما يدفعه الشركاء. الدخول بخطوتين.
          </p>
        </div>
      </div>

      <AdminLoginForm rejected={params.rejected === '1'} afterReset={params.reset === '1'} />

      <div className="flex flex-col gap-2 border-t border-ih-neutral-200 pt-1">
        {/* NO SELF-SERVICE RESET — the design states it and the build honours
            it. There is no «نسيت كلمة المرور» link because there is no such
            flow: recovery is a runbook procedure
            (docs/runbooks/RUNBOOK-admin-account.md). */}
        <span className="pt-3 text-[12px] leading-[1.7] text-ih-neutral-600">
          نسيت كلمة المرور؟ لا يوجد إعادة تعيين بالبريد لحساب الإدارة — تُعاد يدوياً من قاعدة
          البيانات. احفظ رموز الاستعادة في مكان آمن خارج هذا الجهاز.
        </span>
      </div>
    </AdminAuthLayout>
  )
}

import type { Metadata } from 'next'

import { Alert } from '../../components/ui/Alert'
import { Logo } from '../../components/ui/Logo'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = {
  title: 'بوابة الشركاء — InstaHealth',
}

// Login, per the approved design: form on the start side, brand panel on the
// end side. Providers use email + password (patients use phone OTP) — see
// CLAUDE.md §2.
const BULLETS = [
  'الحجوزات الجديدة تظهر فوراً — بدون تحديث الصفحة',
  'يوضح لك مَن دفع أونلاين ومَن يدفع عند الوصول',
  'حدّث أسعار خدماتك في أي وقت',
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; rejected?: string }>
}) {
  const { next, rejected } = await searchParams
  // The dashboard (and now the root) bounce a non-staff session here with
  // `rejected=1`. Nothing read it, so the visitor landed on a plain login form
  // with no idea why — say it out loud instead.
  const wasRejected = rejected === '1'

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex min-w-0 flex-1 items-center justify-center p-10">
        <div className="flex w-full max-w-[380px] flex-col gap-[26px]">
          <div className="flex flex-col gap-4">
            <Logo variant="color" size={36} withWordmark />
            <div className="flex flex-col gap-1.5">
              <h1 className="font-arabic text-2xl font-extrabold text-ih-neutral-800">
                بوابة الشركاء
              </h1>
              <p className="text-sm leading-[1.7] text-ih-neutral-600">
                سجّل الدخول لمتابعة حجوزات فرعك وإدارة خدماتك وأسعارك.
              </p>
            </div>
          </div>

          {wasRejected ? (
            <Alert type="warning" testId="login-rejected">
              هذا الحساب لا يملك صلاحية الدخول إلى بوابة الشركاء. سجّل الدخول بحساب الفرع.
            </Alert>
          ) : null}

          <LoginForm next={next ?? ''} />

          <div className="flex flex-col gap-2.5 border-t border-ih-neutral-200 pt-[18px]">
            <div className="flex items-center gap-2 text-[12.5px] text-ih-neutral-600">
              <span aria-hidden="true">⚠</span>
              <span>جهاز مشترك؟ سجّل الخروج بعد انتهاء الشيفت.</span>
            </div>
            <div className="text-[12.5px] text-ih-neutral-500">
              تحتاج مساعدة؟{' '}
              <span className="font-semibold text-ih-primary-600">دعم الشركاء ١٦٧٢٣</span>
            </div>
          </div>
        </div>
      </div>

      {/* Brand panel — hidden below the 1366px desktop floor the design targets,
          so the form never gets squeezed on an old office screen. */}
      <div
        className="hidden w-[480px] shrink-0 flex-col justify-between p-11 lg:flex"
        style={{
          background: 'linear-gradient(135deg, var(--ih-primary-700), var(--ih-primary-500))',
        }}
      >
        <Logo variant="white" size={44} />
        <div className="flex flex-col gap-[22px]">
          <div className="font-arabic text-[26px] font-extrabold leading-[1.5] text-white">
            كل حجوزات فرعك
            <br />
            في شاشة واحدة
          </div>
          <div className="flex flex-col gap-3">
            {BULLETS.map((bullet) => (
              <div key={bullet} className="flex items-center gap-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] text-white">
                  ✓
                </span>
                <span className="text-sm leading-[1.6] text-white/90">{bullet}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-white/70">InstaHealth · بوابة الشركاء ٢٠٢٦</div>
      </div>
    </div>
  )
}

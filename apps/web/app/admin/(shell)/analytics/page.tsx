import Link from 'next/link'

import { AdminHeader } from '../../../../components/admin/AdminHeader'

export const dynamic = 'force-dynamic'

// ⚠ NOT a placeholder — this is the APPROVED design from
// `Admin - Analytics.dc.html`, rendered as drawn, per SPEC-A01 §B. The screen's
// whole argument is that an announced page beats an empty one: it names the
// five questions it will answer and the evidence each needs, so «قريباً» is a
// schedule rather than a shrug. Rendering it as a generic stub would throw away
// a finished design.
//
// The «قريباً» chip in the header stays: the page is announced, not live.

const QUESTIONS = [
  {
    icon: '🏥',
    title: 'نشاط الفروع على مدى الوقت',
    detail: 'أي فرع ينمو وأيّه يتراجع، شهراً بشهر — لا يوماً بيوم.',
    needs: '٣ أشهر بيانات',
  },
  {
    icon: '📅',
    title: 'اتجاه نسبة الإشغال',
    detail: 'هل المواعيد المتاحة أكثر أو أقل من الطلب، ولأي فرع وأي يوم في الأسبوع.',
    needs: '٨ أسابيع بيانات',
  },
  {
    icon: '🧪',
    title: 'أكثر الخدمات حجزاً',
    detail: 'ما يطلبه المرضى فعلاً — يوجّه الكتالوج وأي خدمة تستحق فرعاً إضافياً.',
    needs: '٥٠٠ حجز مكتمل',
  },
  {
    icon: '✕',
    title: 'أنماط الإلغاء وعدم الحضور',
    detail: 'متى يُلغى الحجز، من ألغاه، وأي فرع أو خدمة أو ساعة تتكرر عندها المشكلة.',
    needs: '١٠٠ إلغاء',
  },
  {
    icon: '💵',
    title: 'الإيراد بحسب المزود',
    detail: 'العمولة المحقّقة لكل مزود شهرياً — بجانب ما تقوله الكشوف، لا بديلاً عنه.',
    needs: '٣ كشوف مُسوّاة',
  },
] as const

export default function AdminAnalyticsPage() {
  return (
    <>
      <AdminHeader title="التحليلات" displayName="مؤسِّس" soon />
      <main data-testid="admin-analytics" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-[20px] font-extrabold text-ih-neutral-800">
              التحليلات تُفتح بعد أن تتجمّع بيانات التجربة
            </h2>
            <p className="text-[13.5px] leading-[1.8] text-ih-neutral-600">
              لا معنى لرسم اتجاه على أسبوعين من التشغيل — الرقم يبدو دقيقاً وهو ليس كذلك. حتى ذلك
              الحين، «نظرة عامة» تكفي لتشغيل اليوم: أرقام اليوم، إشغال كل فرع، وما يحتاج انتباهك.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-ih-neutral-200 px-[18px] py-3.5">
              <span className="text-[14.5px] font-bold text-ih-neutral-800">
                الأسئلة التي ستجيب عنها هذه الصفحة
              </span>
              <span className="shrink-0 text-[11.5px] text-ih-neutral-500">٥ أسئلة مُقرّة</span>
            </div>

            {QUESTIONS.map((question) => (
              <div
                key={question.title}
                data-testid="admin-analytics-question"
                // ⚠ `auto` for the evidence chip, not the design's fixed 160px.
                // VIEW-01: the chip is whitespace-nowrap Arabic, which renders
                // ~5% wider on Linux CI than on Windows — a fixed track clips
                // it there and passes here. An `auto` track cannot.
                className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-ih-neutral-100 px-[18px] py-3.5 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-ih-primary-50 text-[14px]"
                >
                  {question.icon}
                </span>
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-[13.5px] font-bold text-ih-neutral-800">
                    {question.title}
                  </span>
                  <span className="text-[12px] leading-[1.6] text-ih-neutral-600">
                    {question.detail}
                  </span>
                </div>
                <span className="justify-self-start whitespace-nowrap rounded-full border border-ih-neutral-200 bg-ih-neutral-100 px-2.5 py-1 text-[11.5px] font-semibold text-ih-neutral-600">
                  {question.needs}
                </span>
              </div>
            ))}

            <div className="bg-ih-neutral-50 px-[18px] py-3">
              <span className="text-[11.5px] leading-[1.7] text-ih-neutral-600">
                تُفعَّل الصفحة بعد ثلاثة أشهر تشغيل أو ٥٠٠ حجز مكتمل — أيّهما أسبق — حين تصبح
                المقارنة بين الأسابيع ذات معنى.
              </span>
            </div>
          </div>

          <div
            className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5"
            style={{ background: 'var(--ih-info-bg)', border: '1px solid rgba(2,128,144,0.25)' }}
          >
            <span aria-hidden="true" className="shrink-0 text-[15px]">
              ℹ
            </span>
            <span className="text-[12.5px] leading-[1.7] text-ih-primary-800">
              البيانات تُجمَّع من اليوم الأول — لن تفقد شيئاً بانتظار التفعيل. ما يتأخر هو العرض
              فقط.
            </span>
            <div className="flex-1" />
            <Link
              href="/admin/overview"
              data-testid="admin-analytics-overview-link"
              className="shrink-0 whitespace-nowrap rounded-lg border border-ih-primary-400 px-3.5 py-2 text-[13px] font-semibold text-ih-primary-700 hover:bg-ih-primary-50"
            >
              افتح نظرة عامة
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}

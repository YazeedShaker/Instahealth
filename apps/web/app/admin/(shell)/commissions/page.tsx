import { ComingSoonSurface } from '../../../../components/admin/ComingSoonSurface'

export const dynamic = 'force-dynamic'

export default function AdminCommissionsPage() {
  return (
    <ComingSoonSurface
      testId="admin-commissions"
      title="العمولات والفواتير"
      spec="A02 — التالي مباشرة"
      summary="كشف حساب لكل شريك ولكل شهر: الإجمالي، الحجوزات المحتسبة، والعمولة المستحقة — وكل رقم يرجع إلى صفوفه، لأن هذا هو الكشف الذي يعترض عليه الشريك."
      bullets={[
        'مُنتقي الشريك + الشهر ← أرقام مجمّعة ← الجدول الذي يسندها.',
        'الحجوزات المغلقة تلقائياً (closed_by = system) مستبعدة ومذكورة بوضوح: «أُغلقت تلقائياً — غير محتسبة».',
        'العمولة النقدية تُحتسب عند الإتمام، والمدفوعة مسبقاً عند الدفع — حسب DECISION-commission-attachment.',
        'تصدير CSV أو طباعة، وحالة «أُرسلت / سُوِّيت» يبدّلها المؤسس يدوياً في v1.',
      ]}
    />
  )
}

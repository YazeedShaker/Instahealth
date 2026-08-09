import { ComingSoonSurface } from '../../../../components/admin/ComingSoonSurface'

export const dynamic = 'force-dynamic'

export default function AdminOverviewPage() {
  return (
    <ComingSoonSurface
      testId="admin-overview"
      title="نظرة عامة"
      spec="A06"
      summary="اليوم عبر الشبكة كلها: الحجوزات، نسبة الإشغال لكل فرع، الإلغاءات، وأي شيء يحتاج انتباهك — صغيرة وصادقة، تكفي لتشغيل اليوم."
      bullets={[
        'أرقام اليوم عبر كل المزودين — حجوزات، مكتملة، ملغاة.',
        'نسبة الإشغال لكل فرع، وأي فرع بلا مواعيد مولّدة.',
        'ما هو أحمر: كرون متوقف، فرع بصفر مواعيد، حجز عالق.',
      ]}
    />
  )
}

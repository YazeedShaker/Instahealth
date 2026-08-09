import { ComingSoonSurface } from '../../../../components/admin/ComingSoonSurface'

export const dynamic = 'force-dynamic'

export default function AdminProvidersPage() {
  return (
    <ComingSoonSurface
      testId="admin-providers"
      title="المزودون والفروع"
      spec="A03"
      summary="ما تقفله بوابة الشركاء يُحرَّر من هنا: الاسم، ساعات العمل، عدد المواعيد المخصصة، حالة التفعيل، والموقع على الخريطة."
      bullets={[
        'قائمة المزودين والفروع، وتفاصيل كل فرع.',
        'محرّر عدد المواعيد يحمل نتيجته بصدق: تغييره يعيد توليد مواعيد الأيام القادمة.',
        'سجل التغييرات ظاهر — نفس شكل branch_profile_history.',
      ]}
    />
  )
}

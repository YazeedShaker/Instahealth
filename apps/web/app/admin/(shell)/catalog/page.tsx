import { ComingSoonSurface } from '../../../../components/admin/ComingSoonSurface'

export const dynamic = 'force-dynamic'

export default function AdminCatalogPage() {
  return (
    <ComingSoonSurface
      testId="admin-catalog"
      title="كتالوج الخدمات"
      spec="A04"
      summary="الفئات ومفتاح الإطلاق is_active — القرص الذي يفتح فئة كاملة للمرضى — والخدمات نفسها، وأي فرع يقدّم كلاً منها."
      bullets={[
        'الفئات مع مفتاح is_active: تأكيد يليق بحجم القرار (فئتان نشطتان مقابل ١٣ غير نشطة اليوم).',
        'إنشاء وتعديل الخدمات: الاسم عربي/إنجليزي، ملاحظات التحضير، الفئة.',
        'أي فرع يقدّم كل خدمة.',
      ]}
    />
  )
}

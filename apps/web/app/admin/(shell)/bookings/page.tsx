import { ComingSoonSurface } from '../../../../components/admin/ComingSoonSurface'

export const dynamic = 'force-dynamic'

export default function AdminBookingsPage() {
  return (
    <ComingSoonSurface
      testId="admin-bookings"
      title="الحجوزات"
      spec="A06"
      summary="بحث عبر كل المزودين — بالمرجع أو رقم المريض أو التاريخ أو الحالة — للقراءة غالباً، بنفس درج التفاصيل المستخدم في بوابة الشركاء."
      bullets={[
        'بحث وفلترة وترقيم من الخادم، كما في P02.',
        'درج التفاصيل نفسه، معاد استخدامه لا معاد بناؤه.',
        'إلغاء نيابة عن المريض بـ cancelled_by = admin.',
      ]}
    />
  )
}

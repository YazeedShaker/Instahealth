import { ComingSoonSurface } from '../../../../components/admin/ComingSoonSurface'

export const dynamic = 'force-dynamic'

export default function AdminStaffPage() {
  return (
    <ComingSoonSurface
      testId="admin-staff"
      title="حسابات المزودين"
      spec="A05"
      summary="النصف اليدوي من التسجيل: إنشاء أو تعطيل حساب موظف استقبال لفرع، وقائمة الحسابات لكل مزود."
      bullets={[
        'إنشاء حساب: بريد + كلمة مرور مؤقتة، على نمط seed 003.',
        'تعطيل حساب دون حذفه — provider_users.is_active موجود بالفعل.',
        'عمود الصلاحيات مرسوم في التصميم ولا يُشحن الآن: كل الحسابات متساوية في v1.',
      ]}
    />
  )
}

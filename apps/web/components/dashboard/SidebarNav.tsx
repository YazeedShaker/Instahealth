// Sidebar per the approved design. Only اليوم is a real destination in P01 —
// the rest are P02+ screens and are rendered DISABLED rather than hidden, so
// the receptionist sees where the product is going without hitting dead links
// (spec: one screen done well beats four scaffolds).
const NAV_ITEMS = [
  { icon: '📋', label: 'اليوم', active: true },
  { icon: '📅', label: 'الأيام القادمة', active: false },
  { icon: '💰', label: 'الخدمات والأسعار', active: false },
  { icon: '🕐', label: 'المواعيد المتاحة', active: false },
  { icon: '🏥', label: 'بيانات الفرع', active: false },
]

export function SidebarNav() {
  return (
    <nav
      data-print="hide"
      aria-label="التنقل الرئيسي"
      className="flex w-[220px] shrink-0 flex-col gap-1 p-3"
      style={{ background: 'var(--ih-surface-sidebar)' }}
    >
      <div className="flex items-center gap-2.5 px-3 pb-4 pt-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ih-primary-400 text-base text-white">
          ⚕
        </div>
        <span className="font-arabic text-[15px] font-bold text-white">بوابة الشركاء</span>
      </div>

      {NAV_ITEMS.map((item) => (
        <div
          key={item.label}
          aria-current={item.active ? 'page' : undefined}
          aria-disabled={item.active ? undefined : true}
          data-testid={item.active ? 'nav-today' : undefined}
          className={
            item.active
              ? 'flex items-center gap-2.5 rounded-lg bg-white/15 px-3 py-2.5 text-[13.5px] font-semibold text-white'
              : 'flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] text-white/40'
          }
          title={item.active ? undefined : 'قريباً'}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </nav>
  )
}

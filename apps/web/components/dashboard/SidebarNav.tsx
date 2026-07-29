'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Logo } from '../ui/Logo'

// Sidebar per the approved design. اليوم and الأيام القادمة are real
// destinations as of P03; the rest are P04+ screens and render DISABLED rather
// than hidden, so the receptionist sees where the product is going without
// hitting dead links.
const NAV_ITEMS = [
  { icon: '📋', label: 'اليوم', href: '/dashboard/today', testId: 'nav-today' },
  { icon: '📅', label: 'الأيام القادمة', href: '/dashboard/upcoming', testId: 'nav-upcoming' },
  { icon: '💰', label: 'الخدمات والأسعار', href: '/dashboard/services', testId: 'nav-services' },
  { icon: '🕐', label: 'المواعيد المتاحة', href: null, testId: undefined },
  { icon: '🏥', label: 'بيانات الفرع', href: null, testId: undefined },
]

const ACTIVE_CLASS =
  'flex items-center gap-2.5 rounded-lg bg-white/15 px-3 py-2.5 text-[13.5px] font-semibold text-white'
const LINK_CLASS =
  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white'
const DISABLED_CLASS =
  'flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] text-white/40'

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav
      data-print="hide"
      aria-label="التنقل الرئيسي"
      className="flex w-[220px] shrink-0 flex-col gap-1 p-3"
      style={{ background: 'var(--ih-surface-sidebar)' }}
    >
      <div className="flex items-center gap-2.5 px-3 pb-4 pt-3">
        <Logo variant="white" size={32} />
        <span className="font-arabic text-[15px] font-bold text-white">بوابة الشركاء</span>
      </div>

      {NAV_ITEMS.map((item) => {
        if (item.href === null) {
          return (
            <div key={item.label} aria-disabled={true} className={DISABLED_CLASS} title="قريباً">
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        }

        const isActive = pathname === item.href
        return (
          <Link
            key={item.label}
            href={item.href}
            data-testid={item.testId}
            aria-current={isActive ? 'page' : undefined}
            className={isActive ? ACTIVE_CLASS : LINK_CLASS}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

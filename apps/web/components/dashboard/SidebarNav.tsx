'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Logo } from '../ui/Logo'

// Sidebar per the approved design. Every destination is live as of P05.
const NAV_ITEMS = [
  { icon: '📋', label: 'اليوم', href: '/dashboard/today', testId: 'nav-today' },
  { icon: '📅', label: 'الأيام القادمة', href: '/dashboard/upcoming', testId: 'nav-upcoming' },
  { icon: '💰', label: 'الخدمات والأسعار', href: '/dashboard/services', testId: 'nav-services' },
  { icon: '🕐', label: 'المواعيد المتاحة', href: '/dashboard/slots', testId: 'nav-slots' },
  { icon: '🏥', label: 'بيانات الفرع', href: '/dashboard/profile', testId: 'nav-profile' },
]

const ACTIVE_CLASS =
  'flex items-center gap-2.5 rounded-lg bg-white/15 px-3 py-2.5 text-[13.5px] font-semibold text-white'
const LINK_CLASS =
  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white'

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

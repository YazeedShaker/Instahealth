'use client'

import { ADMIN_ACCENT } from '@instahealth/design-tokens'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Logo } from '../ui/Logo'

// The admin sidebar. Structurally the partner portal's SidebarNav — same 220px,
// same pill anatomy — with one deliberate difference: the DEEP-INK background
// from ADMIN_ACCENT instead of the cerulean `--ih-surface-sidebar`. That is the
// whole point of DESIGN-03's visual brief: "nobody ever confuses which portal
// they're in". The colour comes from the contract, never from this file.
//
// Order and labels are the handoff's `navItems`, verbatim.
export const ADMIN_NAV_ITEMS = [
  { icon: '📊', label: 'نظرة عامة', href: '/admin/overview', testId: 'admin-nav-overview' },
  { icon: '📈', label: 'التحليلات', href: '/admin/analytics', testId: 'admin-nav-analytics' },
  {
    icon: '🧾',
    label: 'العمولات والفواتير',
    href: '/admin/commissions',
    testId: 'admin-nav-commissions',
  },
  {
    icon: '🏥',
    label: 'المزودون والفروع',
    href: '/admin/providers',
    testId: 'admin-nav-providers',
  },
  { icon: '🧪', label: 'كتالوج الخدمات', href: '/admin/catalog', testId: 'admin-nav-catalog' },
  { icon: '👤', label: 'حسابات المزودين', href: '/admin/staff', testId: 'admin-nav-staff' },
  { icon: '📋', label: 'الحجوزات', href: '/admin/bookings', testId: 'admin-nav-bookings' },
] as const

const ACTIVE_CLASS =
  'flex items-center gap-2.5 rounded-lg bg-white/15 px-3 py-2.5 text-[13.5px] font-semibold text-white'
const LINK_CLASS =
  'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white'

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav
      data-print="hide"
      data-testid="admin-sidebar"
      aria-label="تنقل لوحة الإدارة"
      className="flex w-[220px] shrink-0 flex-col gap-1 p-3"
      style={{ background: ADMIN_ACCENT.ink }}
    >
      <div className="flex items-center gap-2.5 px-3 pb-4 pt-3">
        <Logo variant="white" size={32} />
        <span className="font-arabic text-[15px] font-bold text-white">الإدارة</span>
      </div>

      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  FileText,
  BarChart3,
  ClipboardList,
  Radar,
  Bell,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react'
import useAuthStore from '@/store/authStore'
import api from '@/lib/axios'
import { cn, parseJWT } from '@/lib/utils'

// ── Navigation items ───────────────────────────────────────────────────────
const navItems = [
  { label: 'Dashboard',       labelAr: 'لوحة التحكم',     href: '/dashboard',        icon: LayoutDashboard },
  { label: 'KYC Requests',    labelAr: 'طلبات التحقق',    href: '/kyc-requests',     icon: ClipboardList   },
  { label: 'Customers',       labelAr: 'العملاء',          href: '/customers',        icon: Users           },
  { label: 'Screening',       labelAr: 'الفحص والتحقق',   href: '/screening',        icon: Radar           },
  { label: 'Alerts',             labelAr: 'التنبيهات',         href: '/alerts',            icon: Bell               },
  { label: 'Monitoring Rules',   labelAr: 'قواعد المراقبة',  href: '/monitoring-rules',  icon: SlidersHorizontal  },
  { label: 'STR Cases',          labelAr: 'بلاغات الاشتباه', href: '/str-cases',         icon: AlertTriangle      },
  { label: 'Policies',        labelAr: 'السياسات',         href: '/policies',         icon: FileText        },
  { label: 'Risk Assessment', labelAr: 'تقييم المخاطر',   href: '/risk-assessment',  icon: BarChart3       },
]

// ── Sidebar (shared between desktop and mobile) ───────────────────────────
function SidebarContent({
  pathname,
  isAr,
  orgName,
  alertBadge,
  onNavClick,
  onLogout,
}: {
  pathname: string
  isAr: boolean
  orgName: string
  alertBadge: number
  onNavClick: () => void
  onLogout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-indigo-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-indigo-800 px-6">
        <Shield className="h-7 w-7 shrink-0 text-indigo-300" />
        <span className="text-xl font-bold text-white">Trous</span>
      </div>

      {/* Org name */}
      <div className="border-b border-indigo-800 px-6 py-3">
        <p className="text-xs uppercase tracking-wider text-indigo-400">
          {isAr ? 'المنظمة' : 'Organisation'}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-indigo-100">{orgName}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map(({ label, labelAr, href, icon: Icon }) => {
          const active = pathname === href || (href.length > 1 && pathname.startsWith(href + '/'))
          const badge  = href === '/alerts' && alertBadge > 0 ? alertBadge : 0
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-300 hover:bg-indigo-800 hover:text-white',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1">{isAr ? labelAr : label}</span>
              {badge > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold leading-none text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-indigo-800 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {isAr ? 'تسجيل الخروج' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}

// ── Dashboard Layout ───────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted]           = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)
  const [openAlertCount, setOpenAlertCount] = useState(0)

  const { token, user, org, language, logout, setLanguage } = useAuthStore()
  const router   = useRouter()
  const pathname = usePathname()
  const isAr     = language === 'ar'

  // Wait for Zustand to rehydrate from localStorage before checking auth.
  useEffect(() => { setMounted(true) }, [])

  // Fetch open alert count once after mount so the sidebar badge is live.
  useEffect(() => {
    if (!mounted || !token) return
    api.get('/alerts?status=open&page_size=1')
      .then(res => setOpenAlertCount(res.data?.data?.stats?.open ?? 0))
      .catch(() => { /* non-critical — badge stays at 0 on error */ })
  }, [mounted, token])

  useEffect(() => {
    if (!mounted) return

    if (!token) {
      router.push('/login')
      return
    }

    // Proactively check JWT expiry so stale sessions are cleared immediately
    // rather than waiting for the next API call to return 401.
    const claims = parseJWT(token)
    if (typeof claims.exp === 'number' && Date.now() / 1000 > claims.exp) {
      logout()
      router.push('/login')
    }
  }, [mounted, token, router, logout])

  // Show a centred spinner while rehydrating or during redirect.
  if (!mounted || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const orgLabel = isAr && org?.name_ar ? org.name_ar : org?.name_en || `Org #${org?.id ?? ''}`

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── Mobile overlay ───────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar — fixed on mobile, static on desktop ─────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 z-30 w-64 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0',
          isAr ? 'right-0' : 'left-0',
          sidebarOpen
            ? 'translate-x-0'
            : isAr ? 'translate-x-full' : '-translate-x-full',
        )}
      >
        {/* Close button — mobile only */}
        <button
          className="absolute top-4 z-10 rounded-lg bg-indigo-800 p-1.5 text-white lg:hidden ltr:-right-10 rtl:-left-10"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent
          pathname={pathname}
          isAr={isAr}
          orgName={orgLabel}
          alertBadge={openAlertCount}
          onNavClick={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
          {/* Hamburger — mobile */}
          <button
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page breadcrumb spacer */}
          <div className="flex-1" />

          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-indigo-600"
            title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            <span className="text-base leading-none">{language === 'ar' ? '🌐' : '🌐'}</span>
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex rtl:items-start">
              <span className="text-sm font-medium text-slate-800">{user?.email}</span>
              <span className="text-xs capitalize text-slate-400">{user?.role}</span>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isAr ? 'خروج' : 'Logout'}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  BellDot,
  SlidersHorizontal,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  CheckCheck,
  UserCircle,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import useAuthStore from '@/store/authStore'
import api from '@/lib/axios'
import { cn, parseJWT } from '@/lib/utils'

// ── Notification types ─────────────────────────────────────────────────────

interface AppNotification {
  ID:                 number
  CreatedAt:          string
  Title:              string
  TitleAr:            string
  Message:            string
  MessageAr:          string
  NotificationType:   string
  EntityType:         string
  EntityID:           number
  IsRead:             boolean
  ReadAt:             string | null
}

// Maps entity_type → dashboard route
const ENTITY_ROUTE: Record<string, string> = {
  alert:             '/alerts',
  kyc_request:       '/kyc-requests',
  str_case:          '/str-cases',
  customer:          '/customers',
  policy:            '/policies',
  screening_result:  '/screening',
  beneficial_owner:  '/customers',
}

const NOTIF_TYPE_ICON: Record<string, string> = {
  alert:            '🚨',
  kyc_pending:      '📋',
  str_update:       '📁',
  screening_hit:    '⚠️',
  review_due:       '🔍',
  policy_approval:  '📜',
}

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
  { label: 'Notifications',   labelAr: 'الإشعارات',        href: '/notifications',    icon: BellDot         },
  { label: 'Settings',        labelAr: 'الإعدادات',        href: '/settings',         icon: Settings        },
]

// ── Sidebar (shared between desktop and mobile) ───────────────────────────
function SidebarContent({
  pathname,
  isAr,
  orgName,
  alertBadge,
  notifBadge,
  onNavClick,
  onLogout,
}: {
  pathname: string
  isAr: boolean
  orgName: string
  alertBadge: number
  notifBadge: number
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
          const badge  =
            href === '/alerts'        && alertBadge > 0 ? alertBadge :
            href === '/notifications' && notifBadge  > 0 ? notifBadge : 0
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
  const [mounted, setMounted]               = useState(false)
  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const [openAlertCount, setOpenAlertCount] = useState(0)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [profileOpen, setProfileOpen]       = useState(false)

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
      .catch(() => { /* non-critical */ })
  }, [mounted, token])

  // Poll unread notification count every 30 s for the sidebar badge.
  useEffect(() => {
    if (!mounted || !token) return
    const fetch = () =>
      api.get('/notifications/unread-count')
        .then(res => setUnreadNotifCount(res.data?.data?.unread_count ?? 0))
        .catch(() => { /* non-critical */ })
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
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
          notifBadge={unreadNotifCount}
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

          {/* Notification bell */}
          <NotificationBell isAr={isAr} />

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProfileOpen(true)}
              className="hidden flex-col items-end sm:flex rtl:items-start rounded-lg px-2 py-1 transition hover:bg-slate-50"
              title={isAr ? 'الملف الشخصي' : 'My Profile'}
            >
              <span className="text-sm font-medium text-slate-800">{user?.email}</span>
              <span className="text-xs capitalize text-indigo-500 hover:underline">{user?.role}</span>
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className="flex sm:hidden rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
              aria-label={isAr ? 'الملف الشخصي' : 'My Profile'}
            >
              <UserCircle className="h-5 w-5" />
            </button>

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

      {/* Profile modal */}
      {profileOpen && (
        <ProfileModal
          isAr={isAr}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  )
}

// ── NotificationBell ───────────────────────────────────────────────────────

function NotificationBell({ isAr }: { isAr: boolean }) {
  const router = useRouter()
  const [open, setOpen]                     = useState(false)
  const [unreadCount, setUnreadCount]       = useState(0)
  const [notifications, setNotifications]   = useState<AppNotification[]>([])
  const [loading, setLoading]               = useState(false)
  const [markingAll, setMarkingAll]         = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Poll unread count every 30 s ────────────────────────────────────────
  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread-count')
      setUnreadCount(data.data?.unread_count ?? 0)
    } catch {
      // non-critical — badge stays at previous value
    }
  }, [])

  useEffect(() => {
    fetchCount()
    const id = setInterval(fetchCount, 30_000)
    return () => clearInterval(id)
  }, [fetchCount])

  // ── Load recent notifications when panel opens ───────────────────────────
  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/notifications?page_size=15')
      setNotifications((data.data?.items ?? []) as AppNotification[])
    } catch {
      // swallow
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadNotifications()
  }, [open, loadNotifications])

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // ── Mark single notification as read + navigate ──────────────────────────
  const handleNotifClick = async (n: AppNotification) => {
    setOpen(false)
    if (!n.IsRead) {
      try {
        await api.patch(`/notifications/${n.ID}/read`)
        setUnreadCount((c) => Math.max(0, c - 1))
      } catch { /* best-effort */ }
    }
    const route = ENTITY_ROUTE[n.EntityType] ?? '/dashboard'
    router.push(route)
  }

  // ── Mark all as read ─────────────────────────────────────────────────────
  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await api.post('/notifications/mark-all-read')
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, IsRead: true })))
    } catch { /* best-effort */ } finally {
      setMarkingAll(false)
    }
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1)  return isAr ? 'الآن'         : 'just now'
    if (mins < 60) return isAr ? `منذ ${mins}د` : `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs  < 24) return isAr ? `منذ ${hrs}س`  : `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return isAr ? `منذ ${days}ي` : `${days}d ago`
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg transition',
          open ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        )}
        aria-label={isAr ? 'الإشعارات' : 'Notifications'}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={cn(
          'absolute top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl',
          isAr ? 'left-0' : 'right-0',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {isAr ? 'الإشعارات' : 'Notifications'}
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-600">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {isAr ? 'قراءة الكل' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[26rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="h-7 w-7 text-slate-200" />
                <p className="text-sm text-slate-400">
                  {isAr ? 'لا توجد إشعارات' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <li key={n.ID}>
                    <button
                      onClick={() => handleNotifClick(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left rtl:text-right transition hover:bg-slate-50',
                        !n.IsRead && 'bg-indigo-50/50',
                      )}
                    >
                      {/* Type icon */}
                      <span className="mt-0.5 shrink-0 text-base leading-none">
                        {NOTIF_TYPE_ICON[n.NotificationType] ?? '🔔'}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          'truncate text-xs',
                          n.IsRead ? 'font-normal text-slate-600' : 'font-semibold text-slate-800',
                        )}>
                          {isAr ? n.TitleAr : n.Title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                          {isAr ? n.MessageAr : n.Message}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-300">
                          {timeAgo(n.CreatedAt)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.IsRead && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 text-center">
              <button
                onClick={() => { setOpen(false); router.push('/notifications') }}
                className="text-xs text-indigo-600 transition hover:text-indigo-800"
              >
                {isAr ? 'عرض جميع الإشعارات' : 'View all notifications'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ProfileModal ────────────────────────────────────────────────────────────

function ProfileModal({ isAr, onClose }: { isAr: boolean; onClose: () => void }) {
  const { token, user, org, login } = useAuthStore()

  const [fullName,         setFullName]         = useState('')
  const [currentPassword,  setCurrentPassword]  = useState('')
  const [newPassword,      setNewPassword]       = useState('')
  const [confirmPassword,  setConfirmPassword]   = useState('')
  const [showPass,         setShowPass]          = useState(false)
  const [saving,           setSaving]            = useState(false)
  const [error,            setError]             = useState('')
  const [success,          setSuccess]           = useState(false)

  // Load current full name from /me on open
  useEffect(() => {
    api.get('/me').then(res => {
      setFullName(res.data?.data?.user?.full_name ?? '')
    }).catch(() => { /* proceed with empty */ })
  }, [])

  const hasPasswordChange = !!newPassword

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasPasswordChange && newPassword !== confirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'New passwords do not match.')
      return
    }
    if (hasPasswordChange && !currentPassword) {
      setError(isAr ? 'أدخل كلمة المرور الحالية.' : 'Enter your current password.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (fullName)        body.full_name        = fullName
      if (hasPasswordChange) {
        body.current_password = currentPassword
        body.new_password     = newPassword
      }
      const { data } = await api.patch('/me', body)
      // Update the in-memory user name if token + org are available
      if (token && user && org) {
        login(token, { ...user, email: data.data?.email ?? user.email }, org)
      }
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 401) {
        setError(isAr ? 'كلمة المرور الحالية غير صحيحة.' : 'Current password is incorrect.')
      } else {
        setError(isAr ? 'فشل الحفظ. حاول مرة أخرى.' : 'Save failed. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900">
              {isAr ? 'الملف الشخصي' : 'My Profile'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 p-6">

          {/* Email — read only */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {isAr ? 'البريد الإلكتروني' : 'Email address'}
            </label>
            <input
              value={user?.email ?? ''}
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 cursor-default"
            />
          </div>

          {/* Full name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {isAr ? 'الاسم الكامل' : 'Full name'}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {isAr ? 'تغيير كلمة المرور (اختياري)' : 'Change password (optional)'}
            </p>

            {/* Current password */}
            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {isAr ? 'كلمة المرور الحالية' : 'Current password'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 pe-10"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {isAr ? 'كلمة المرور الجديدة' : 'New password'}
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
              {isAr ? 'تم الحفظ بنجاح.' : 'Saved successfully.'}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
            <button
              type="submit"
              disabled={saving || (!fullName && !newPassword)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? 'حفظ' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface Notification {
  ID:               number
  CreatedAt:        string
  Title:            string
  TitleAr:          string
  Message:          string
  MessageAr:        string
  NotificationType: string
  IsRead:           boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  alert:           '🚨',
  kyc_pending:     '📋',
  str_update:      '📁',
  screening_hit:   '⚠️',
  review_due:      '🔍',
  policy_approval: '📜',
}

function timeAgo(iso: string, isAr: boolean) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return isAr ? 'الآن'          : 'just now'
  if (mins < 60) return isAr ? `منذ ${mins}د`  : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24) return isAr ? `منذ ${hrs}س`   : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return isAr ? `منذ ${days}ي` : `${days}d ago`
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { language } = useAuthStore()
  const isAr = language === 'ar'

  const [filter,       setFilter]       = useState<'all' | 'unread'>('all')
  const [items,        setItems]        = useState<Notification[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [markingAll,   setMarkingAll]   = useState(false)
  const [markingId,    setMarkingId]    = useState<number | null>(null)

  const pageSize = 20

  const load = useCallback(async (p: number, f: 'all' | 'unread') => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: p, page_size: pageSize }
      if (f === 'unread') params.unread = 'true'
      const { data } = await api.get('/notifications', { params })
      setItems(data.data?.items ?? [])
      setTotal(data.data?.total ?? 0)
    } catch {
      // silently swallow
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page, filter)
  }, [load, page, filter])

  const handleFilterChange = (f: 'all' | 'unread') => {
    setFilter(f)
    setPage(1)
  }

  const handleMarkRead = async (id: number) => {
    setMarkingId(id)
    try {
      await api.patch(`/notifications/${id}/read`)
      setItems((prev) => prev.map((n) => n.ID === id ? { ...n, IsRead: true } : n))
    } catch { /* best-effort */ } finally {
      setMarkingId(null)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await api.post('/notifications/mark-all-read')
      setItems((prev) => prev.map((n) => ({ ...n, IsRead: true })))
    } catch { /* best-effort */ } finally {
      setMarkingAll(false)
    }
  }

  const totalPages   = Math.ceil(total / pageSize)
  const hasUnread    = items.some((n) => !n.IsRead)

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isAr ? 'الإشعارات' : 'Notifications'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr ? `${total} إشعار` : `${total} notification${total !== 1 ? 's' : ''}`}
          </p>
        </div>

        {hasUnread && (
          <button
            onClick={handleMarkAll}
            disabled={markingAll}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {markingAll
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCheck className="h-4 w-4" />}
            {isAr ? 'تحديد الكل كمقروء' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              filter === f
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {f === 'all'
              ? (isAr ? 'الكل' : 'All')
              : (isAr ? 'غير مقروء' : 'Unread')}
          </button>
        ))}
      </div>

      {/* ── List ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Bell className="h-10 w-10 text-slate-200" />
            <p className="text-sm text-slate-400">
              {isAr ? 'لا توجد إشعارات' : 'No notifications'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {items.map((n) => (
              <li
                key={n.ID}
                className={cn(
                  'flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50',
                  !n.IsRead && 'bg-indigo-50/40',
                )}
              >
                {/* Type icon */}
                <span className="mt-0.5 shrink-0 text-xl leading-none">
                  {TYPE_ICON[n.NotificationType] ?? '🔔'}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'text-sm',
                    n.IsRead ? 'font-normal text-slate-600' : 'font-semibold text-slate-900',
                  )}>
                    {isAr ? n.TitleAr : n.Title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                    {isAr ? n.MessageAr : n.Message}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    {timeAgo(n.CreatedAt, isAr)}
                  </p>
                </div>

                {/* Mark read button */}
                {!n.IsRead && (
                  <button
                    onClick={() => handleMarkRead(n.ID)}
                    disabled={markingId === n.ID}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                  >
                    {markingId === n.ID
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : (isAr ? 'تحديد كمقروء' : 'Mark read')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAr ? 'السابق' : 'Previous'}
          </button>
          <span>
            {isAr
              ? `الصفحة ${page} من ${totalPages}`
              : `Page ${page} of ${totalPages}`}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isAr ? 'التالي' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}

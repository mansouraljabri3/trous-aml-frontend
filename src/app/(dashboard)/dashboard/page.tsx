'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  AlertTriangle,
  FileText,
  BarChart3,
  ClipboardList,
  ShieldAlert,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  customers:        { total: number; high_risk: number; critical_risk: number }
  alerts:           { open: number; under_review: number; escalated: number }
  str_cases:        { total: number; draft: number; filed_to_fiu: number }
  screening:        { total_screened: number; pending_review: number; confirmed_hits: number }
  kyc_requests:     { pending: number }
  policies:         { approved: number }
  risk_assessments: { approved: number }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, language } = useAuthStore()
  const isAr    = language === 'ar'
  const isAdmin = user?.role === 'admin'

  const [loading,   setLoading]   = useState(true)
  const [stats,     setStats]     = useState<DashboardStats | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState('')

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data.data as DashboardStats))
      .catch(() => { /* silently fall through — cards show dashes */ })
      .finally(() => setLoading(false))
  }, [])

  async function handleExport() {
    setExportErr('')
    setExporting(true)
    try {
      const res  = await api.get('/inspection-pack')
      const json = JSON.stringify(res.data.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `inspection-pack-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportErr(isAr ? 'فشل تصدير الحزمة.' : 'Export failed — please try again.')
    } finally {
      setExporting(false)
    }
  }

  const v = (n: number | undefined) => loading ? '…' : String(n ?? 0)

  const statCards = [
    {
      label: 'Total Customers', labelAr: 'إجمالي العملاء',
      icon: Users,
      value: v(stats?.customers.total),
      sub: loading ? '' : (isAr
        ? `${stats?.customers.high_risk ?? 0} عالي + ${stats?.customers.critical_risk ?? 0} حرج`
        : `${stats?.customers.high_risk ?? 0} high + ${stats?.customers.critical_risk ?? 0} critical`),
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Open Alerts', labelAr: 'التنبيهات المفتوحة',
      icon: AlertTriangle,
      value: v(stats?.alerts.open),
      sub: loading ? '' : (isAr
        ? `${stats?.alerts.escalated ?? 0} مصعَّد`
        : `${stats?.alerts.escalated ?? 0} escalated`),
      color: 'bg-red-50 text-red-600',
    },
    {
      label: 'Pending KYC Requests', labelAr: 'طلبات التحقق المعلقة',
      icon: ClipboardList,
      value: v(stats?.kyc_requests.pending),
      sub: isAr ? 'بانتظار المراجعة' : 'awaiting review',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'STR Cases', labelAr: 'بلاغات الاشتباه',
      icon: FileText,
      value: v(stats?.str_cases.total),
      sub: loading ? '' : (isAr
        ? `${stats?.str_cases.draft ?? 0} مسودة · ${stats?.str_cases.filed_to_fiu ?? 0} مُقدَّم`
        : `${stats?.str_cases.draft ?? 0} draft · ${stats?.str_cases.filed_to_fiu ?? 0} filed`),
      color: 'bg-orange-50 text-orange-600',
    },
    {
      label: 'Screening Hits', labelAr: 'نتائج الفحص',
      icon: ShieldAlert,
      value: v(stats?.screening.confirmed_hits),
      sub: loading ? '' : (isAr
        ? `${stats?.screening.pending_review ?? 0} قيد المراجعة`
        : `${stats?.screening.pending_review ?? 0} pending review`),
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Approved Policies', labelAr: 'السياسات المعتمدة',
      icon: BarChart3,
      value: v(stats?.policies.approved),
      sub: loading ? '' : (isAr
        ? `${stats?.risk_assessments.approved ?? 0} تقييم معتمد`
        : `${stats?.risk_assessments.approved ?? 0} risk assessment(s) approved`),
      color: 'bg-green-50 text-green-600',
    },
  ]

  const hasPolicy     = (stats?.policies.approved        ?? 0) > 0
  const hasAssessment = (stats?.risk_assessments.approved ?? 0) > 0
  const hasCustomers  = (stats?.customers.total           ?? 0) > 0
  const hasSTR        = (stats?.str_cases.total           ?? 0) > 0
  const isReady       = hasPolicy && hasAssessment

  const checklist = [
    { label: 'AML Policy created and approved',       labelAr: 'تم إنشاء سياسة مكافحة غسيل الأموال واعتمادها', done: hasPolicy },
    { label: 'Enterprise Risk Assessment completed',  labelAr: 'اكتمل تقييم مخاطر المنظمة',                    done: hasAssessment },
    { label: 'KYC customers registered',              labelAr: 'تم تسجيل عملاء العناية الواجبة',               done: hasCustomers },
    { label: 'At least one STR case filed',           labelAr: 'تم تقديم بلاغ اشتباه واحد على الأقل',         done: hasSTR },
  ]

  return (
    <div className="space-y-8">

      {/* ── Welcome ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">
          {isAr
            ? `مرحباً بك، ${user?.email ?? ''}`
            : `Welcome back, ${user?.email ?? ''}`}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr
            ? 'فيما يلي ملخص حالة الامتثال الخاصة بمنظمتك.'
            : "Here's a compliance status overview for your organisation."}
        </p>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map(({ label, labelAr, icon: Icon, value, sub, color }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="min-w-0 flex-1 ltr:pr-3 rtl:pl-3">
              <p className="text-sm text-slate-500">{isAr ? labelAr : label}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>
            </div>
            <div className={cn('shrink-0 rounded-xl p-3', color)}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Compliance checklist ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-semibold text-slate-900">
          {isAr ? 'قائمة متطلبات الامتثال' : 'Compliance Checklist'}
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isAr ? 'جارٍ التحميل…' : 'Loading…'}
          </div>
        ) : (
          <ul className="space-y-3">
            {checklist.map(({ label, labelAr, done }) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                {done
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  : <Circle       className="h-4 w-4 shrink-0 text-slate-300"   />}
                <span className={done ? 'font-medium text-slate-800' : 'text-slate-500'}>
                  {isAr ? labelAr : label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Inspection pack banner ────────────────────────────────────────── */}
      <div
        className={cn(
          'rounded-xl border px-6 py-4 shadow-sm',
          isReady ? 'border-emerald-100 bg-emerald-50' : 'border-indigo-100 bg-indigo-50',
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={cn(
                'mt-0.5 h-5 w-5 shrink-0',
                isReady ? 'text-emerald-500' : 'text-indigo-400',
              )}
            />
            <div>
              <p className={cn('text-sm font-medium', isReady ? 'text-emerald-900' : 'text-indigo-900')}>
                {isAr
                  ? (isReady ? 'المنظمة جاهزة للتفتيش' : 'تصدير حزمة التفتيش')
                  : (isReady ? 'Organisation is Inspection-Ready' : 'Inspection Pack Export')}
              </p>
              <p className={cn('mt-0.5 text-xs', isReady ? 'text-emerald-700' : 'text-indigo-600')}>
                {isAr
                  ? (isReady
                      ? 'يمكنك الآن تصدير حزمة التفتيش الكاملة لتقديمها للجهات التنظيمية.'
                      : 'بمجرد اعتماد السياسة وتقييم المخاطر، يمكنك تصدير حزمة التفتيش.')
                  : (isReady
                      ? 'You can now export the full inspection pack for regulators.'
                      : 'Once your policy and risk assessment are approved, you can export the full inspection pack.')}
              </p>
              {exportErr && (
                <p className="mt-1 text-xs text-red-600">{exportErr}</p>
              )}
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={handleExport}
              disabled={!isReady || exporting}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isReady
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-slate-200 text-slate-400',
              )}
            >
              {exporting
                ? <Loader2  className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              {isAr ? 'تصدير JSON' : 'Export JSON'}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  AlertTriangle,
  FileText,
  BarChart3,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface ApprovedPolicy {
  Title: string
  TitleAr: string
  Version: string
}

interface ApprovedAssessment {
  OverallRiskLevel: string
  OverallRiskScore: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const RISK_VALUE_COLOR: Record<string, string> = {
  Low:      'text-emerald-600',
  Medium:   'text-amber-600',
  High:     'text-orange-600',
  Critical: 'text-red-600',
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, language } = useAuthStore()
  const isAr    = language === 'ar'
  const isAdmin = user?.role === 'admin'

  const [loading,    setLoading]    = useState(true)
  const [custTotal,  setCustTotal]  = useState(0)
  const [strTotal,   setStrTotal]   = useState(0)
  const [policy,     setPolicy]     = useState<ApprovedPolicy | null>(null)
  const [assessment, setAssessment] = useState<ApprovedAssessment | null>(null)
  const [exporting,  setExporting]  = useState(false)
  const [exportErr,  setExportErr]  = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [cRes, sRes, pRes, rRes] = await Promise.all([
          api.get('/customers?page_size=1'),
          api.get('/str-cases?page_size=1'),
          api.get('/policies?page_size=50'),
          api.get('/risk-assessments?page_size=50'),
        ])
        setCustTotal(cRes.data.data.total ?? 0)
        setStrTotal(sRes.data.data.total  ?? 0)
        setPolicy(
          (pRes.data.data.items as any[]).find((p: any) => p.Status === 'Approved') ?? null
        )
        setAssessment(
          (rRes.data.data.items as any[]).find((a: any) => a.Status === 'Approved') ?? null
        )
      } catch {
        // silently fall through — stat cards show dashes
      } finally {
        setLoading(false)
      }
    })()
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

  const hasPolicy     = !!policy
  const hasAssessment = !!assessment
  const isReady       = hasPolicy && hasAssessment
  const hasCustomers  = custTotal > 0
  const hasSTR        = strTotal  > 0
  const riskLevel     = assessment?.OverallRiskLevel ?? '—'

  const statCards = [
    {
      label: 'Total Customers', labelAr: 'إجمالي العملاء',
      icon: Users,
      value: loading ? '…' : String(custTotal),
      sub:   isAr ? 'سجلات العناية الواجبة' : 'KYC records',
      color: 'bg-blue-50 text-blue-600',
      valueClass: 'text-slate-900',
    },
    {
      label: 'STR Cases', labelAr: 'بلاغات الاشتباه',
      icon: AlertTriangle,
      value: loading ? '…' : String(strTotal),
      sub:   isAr ? 'جميع الحالات' : 'All statuses',
      color: 'bg-amber-50 text-amber-600',
      valueClass: 'text-slate-900',
    },
    {
      label: 'Active Policy', labelAr: 'السياسة النشطة',
      icon: FileText,
      value: loading ? '…' : (policy ? `v${policy.Version}` : '—'),
      sub: loading || !policy
        ? (isAr ? 'الإصدار المعتمد' : 'Approved version')
        : (isAr ? policy.TitleAr : policy.Title),
      color: 'bg-green-50 text-green-600',
      valueClass: 'text-slate-900',
    },
    {
      label: 'Risk Level', labelAr: 'مستوى المخاطر',
      icon: BarChart3,
      value: loading ? '…' : riskLevel,
      sub: !loading && assessment
        ? (isAr
            ? `النتيجة: ${assessment.OverallRiskScore.toFixed(2)} / 5`
            : `Score: ${assessment.OverallRiskScore.toFixed(2)} / 5`)
        : (isAr ? 'التقييم الإجمالي' : 'Overall assessment'),
      color: 'bg-purple-50 text-purple-600',
      valueClass: !loading && assessment
        ? (RISK_VALUE_COLOR[riskLevel] ?? 'text-slate-900')
        : 'text-slate-900',
    },
  ]

  const checklist = [
    {
      label:   'AML Policy created and approved',
      labelAr: 'تم إنشاء سياسة مكافحة غسيل الأموال واعتمادها',
      done: hasPolicy,
    },
    {
      label:   'Enterprise Risk Assessment completed',
      labelAr: 'اكتمل تقييم مخاطر المنظمة',
      done: hasAssessment,
    },
    {
      label:   'KYC customers registered',
      labelAr: 'تم تسجيل عملاء العناية الواجبة',
      done: hasCustomers,
    },
    {
      label:   'At least one STR case filed',
      labelAr: 'تم تقديم بلاغ اشتباه واحد على الأقل',
      done: hasSTR,
    },
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, labelAr, icon: Icon, value, sub, color, valueClass }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <div className="min-w-0 flex-1 ltr:pr-3 rtl:pl-3">
              <p className="text-sm text-slate-500">{isAr ? labelAr : label}</p>
              <p className={cn('mt-1 text-3xl font-bold', valueClass)}>{value}</p>
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

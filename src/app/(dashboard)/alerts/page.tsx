'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface CustomerSummary {
  ID:           number
  CustomerType: string
  FullName:     string
  CompanyName:  string
  RiskLevel:    string
}

interface TransactionSummary {
  ID:        number
  Amount:    number
  Currency:  string
  TxType:    string
  TxDate:    string
  Status:    string
  Reference: string
}

interface MonitoringRuleSummary {
  ID:          number
  Name:        string
  RuleType:    string
  Description: string
}

interface UserSummary {
  ID:       number
  Email:    string
  FullName: string
}

interface Alert {
  ID:               number
  CreatedAt:        string
  CustomerID:       number
  TransactionID:    number
  MonitoringRuleID: number
  RuleType:         string
  RuleName:         string
  Severity:         string
  Status:           string
  Amount:           number
  Details:          string
  AssignedToID:     number | null
  Notes:            string | null
  Customer?:        CustomerSummary
  Transaction?:     TransactionSummary
  MonitoringRule?:  MonitoringRuleSummary
  AssignedTo?:      UserSummary
}

interface Stats {
  open:         number
  under_review: number
  escalated:    number
  closed:       number
}

// ── Display maps ───────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  low:      'bg-blue-100 text-blue-700',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_STYLES: Record<string, string> = {
  open:         'bg-red-100 text-red-700',
  under_review: 'bg-amber-100 text-amber-700',
  escalated:    'bg-orange-100 text-orange-700',
  closed:       'bg-slate-100 text-slate-500',
}

const RULE_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  threshold:   { en: 'Threshold',   ar: 'حد المبلغ' },
  velocity:    { en: 'Velocity',    ar: 'سرعة المعاملات' },
  structuring: { en: 'Structuring', ar: 'التجزئة' },
  geography:   { en: 'Geography',   ar: 'جغرافي' },
  pattern:     { en: 'Pattern',     ar: 'نمط' },
}

const TRIGGER_DETAIL_LABELS: Record<string, { en: string; ar: string }> = {
  transaction_amount: { en: 'Transaction Amount', ar: 'مبلغ المعاملة' },
  rule_threshold:     { en: 'Rule Threshold',     ar: 'حد القاعدة' },
  period_days:        { en: 'Period (days)',       ar: 'الفترة (أيام)' },
  period_total:       { en: 'Cumulative Total',   ar: 'الإجمالي التراكمي' },
  window_hours:       { en: 'Window (hours)',      ar: 'النافذة (ساعات)' },
  tx_count:           { en: 'Tx Count',            ar: 'عدد المعاملات' },
  min_transactions:   { en: 'Min Transactions',   ar: 'الحد الأدنى' },
  threshold:          { en: 'Threshold',           ar: 'الحد' },
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'red' | 'amber' | 'orange' | 'slate'
}) {
  const cls = {
    red:    { bg: 'bg-red-50    border-red-100',    text: 'text-red-600' },
    amber:  { bg: 'bg-amber-50  border-amber-100',  text: 'text-amber-600' },
    orange: { bg: 'bg-orange-50 border-orange-100', text: 'text-orange-600' },
    slate:  { bg: 'bg-slate-50  border-slate-200',  text: 'text-slate-600' },
  }[color]

  return (
    <div className={cn('rounded-xl border p-5 shadow-sm', cls.bg)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', cls.text)}>{value.toLocaleString()}</p>
    </div>
  )
}

function DRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-800">{children}</dd>
    </>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// ── Page ───────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { language, user } = useAuthStore()
  const isAr      = language === 'ar'
  const isOfficer = user?.role === 'admin' || user?.role === 'officer'

  // List state
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [stats, setStats]     = useState<Stats>({ open: 0, under_review: 0, escalated: 0, closed: 0 })
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [listErr, setListErr] = useState('')

  // Filters
  const [statusFilter,   setStatusFilter]   = useState('')
  const [severityFilter, setSeverityFilter] = useState('')

  // Detail modal
  const [selected,       setSelected]       = useState<Alert | null>(null)
  const [loadingDetail,  setLoadingDetail]  = useState(false)
  const [actionErr,      setActionErr]      = useState('')
  const [updating,       setUpdating]       = useState(false)

  // Dismiss panel
  const [showDismiss,   setShowDismiss]   = useState(false)
  const [dismissNotes,  setDismissNotes]  = useState('')

  // Escalate to STR panel
  const [showEscalate,   setShowEscalate]   = useState(false)
  const [strTitle,       setStrTitle]       = useState('')
  const [strDesc,        setStrDesc]        = useState('')
  const [strSubmitting,  setStrSubmitting]  = useState(false)

  // ── Data loading ───────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setListErr('')
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (statusFilter)   params.set('status',   statusFilter)
      if (severityFilter) params.set('severity', severityFilter)
      const { data } = await api.get(`/alerts?${params}`)
      setAlerts((data.data.items ?? []) as Alert[])
      setTotal(data.data.total ?? 0)
      setStats(data.data.stats ?? { open: 0, under_review: 0, escalated: 0, closed: 0 })
    } catch {
      setListErr(isAr ? 'فشل تحميل التنبيهات.' : 'Failed to load alerts.')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, severityFilter, isAr])

  useEffect(() => { load() }, [load])

  const applyFilter = (setter: (v: string) => void, v: string) => {
    setter(v)
    setPage(1)
  }

  // ── Detail modal ───────────────────────────────────────────────────────────

  const openDetail = async (a: Alert) => {
    setSelected(a)
    setShowDismiss(false)
    setShowEscalate(false)
    setDismissNotes('')
    setStrTitle('')
    setStrDesc('')
    setActionErr('')
    // Fetch full record (with Transaction + MonitoringRule + AssignedTo).
    setLoadingDetail(true)
    try {
      const { data } = await api.get(`/alerts/${a.ID}`)
      setSelected(data.data as Alert)
    } catch {
      // Keep list-level data on error.
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeModal = () => {
    setSelected(null)
    setShowDismiss(false)
    setShowEscalate(false)
    setActionErr('')
    setDismissNotes('')
    setStrTitle('')
    setStrDesc('')
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const doUpdate = async (status: string, notes?: string) => {
    if (!selected) return
    setUpdating(true)
    setActionErr('')
    try {
      const body: Record<string, string> = { status }
      if (notes) body.notes = notes
      const { data } = await api.patch(`/alerts/${selected.ID}`, body)
      setSelected(data.data as Alert)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionErr(msg ?? (isAr ? 'فشل تحديث التنبيه.' : 'Failed to update alert.'))
    } finally {
      setUpdating(false)
    }
  }

  const handleTakeOwnership = () => doUpdate('under_review')

  const handleDismiss = async () => {
    if (!dismissNotes.trim()) {
      setActionErr(isAr ? 'الملاحظات مطلوبة.' : 'Notes are required when dismissing.')
      return
    }
    await doUpdate('closed', dismissNotes.trim())
    setShowDismiss(false)
  }

  const handleEscalate = async () => {
    if (!selected || !strTitle.trim()) {
      setActionErr(isAr ? 'عنوان البلاغ مطلوب.' : 'STR title is required.')
      return
    }
    setStrSubmitting(true)
    setActionErr('')
    try {
      await api.post('/str-cases', {
        customer_id:         selected.CustomerID,
        title:               strTitle.trim(),
        description:         strDesc.trim(),
        risk_indicators:     [selected.RuleType],
        investigation_notes: `Alert #${selected.ID} — ${selected.RuleName}`,
      })
      const { data } = await api.patch(`/alerts/${selected.ID}`, { status: 'escalated' })
      setSelected(data.data as Alert)
      setShowEscalate(false)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setActionErr(msg ?? (isAr ? 'فشل إنشاء البلاغ.' : 'Failed to create STR case.'))
    } finally {
      setStrSubmitting(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const customerName = (a: Alert) =>
    a.Customer
      ? a.Customer.CustomerType === 'individual'
        ? a.Customer.FullName   || '—'
        : a.Customer.CompanyName || '—'
      : `#${a.CustomerID}`

  const isActionable = (a: Alert) => a.Status === 'open' || a.Status === 'under_review'
  const canOwn       = (a: Alert) => isOfficer && a.Status === 'open'

  const parseTrigger = (a: Alert): Record<string, number | string> => {
    try { return JSON.parse(a.Details ?? '{}') } catch { return {} }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Bell className="h-7 w-7 text-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isAr ? 'لوحة التنبيهات' : 'Alerts Dashboard'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr
              ? 'تنبيهات مراقبة المعاملات الصادرة عن محرك القواعد'
              : 'Transaction monitoring alerts from the rules engine'}
          </p>
        </div>
      </div>

      {listErr && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{listErr}</div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={isAr ? 'مفتوح'          : 'Open'}         value={stats.open}         color="red" />
        <StatCard label={isAr ? 'قيد المراجعة'   : 'Under Review'} value={stats.under_review} color="amber" />
        <StatCard label={isAr ? 'مُصعَّد لبلاغ'  : 'Escalated'}    value={stats.escalated}    color="orange" />
        <StatCard label={isAr ? 'مُغلق'           : 'Dismissed'}    value={stats.closed}       color="slate" />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Status pills */}
        {(['', 'open', 'under_review', 'escalated', 'closed'] as const).map(s => {
          const label =
            s === ''           ? (isAr ? 'كل الحالات'   : 'All') :
            s === 'open'       ? (isAr ? 'مفتوح'         : 'Open') :
            s === 'under_review' ? (isAr ? 'قيد المراجعة' : 'Under Review') :
            s === 'escalated'  ? (isAr ? 'مُصعَّد'       : 'Escalated') :
                                  (isAr ? 'مُغلق'         : 'Closed')
          return (
            <button
              key={s || 'all-s'}
              onClick={() => applyFilter(setStatusFilter, s)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
              )}
            >
              {label}
            </button>
          )
        })}

        <div className="mx-1 h-5 w-px self-center bg-slate-200" />

        {/* Severity pills */}
        {(['', 'low', 'medium', 'high', 'critical'] as const).map(sv => (
          <button
            key={sv || 'all-sv'}
            onClick={() => applyFilter(setSeverityFilter, sv)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              severityFilter === sv
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {sv || (isAr ? 'كل الدرجات' : 'All Severities')}
          </button>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            {isAr ? 'لا توجد تنبيهات' : 'No alerts found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[
                    '#',
                    isAr ? 'العميل'        : 'Customer',
                    isAr ? 'القاعدة'       : 'Rule',
                    isAr ? 'الخطورة'       : 'Severity',
                    isAr ? 'الحالة'        : 'Status',
                    isAr ? 'المبلغ'        : 'Amount',
                    isAr ? 'المكلَّف'      : 'Assigned To',
                    isAr ? 'تاريخ الإنشاء' : 'Created',
                  ].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map(a => (
                  <tr
                    key={a.ID}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => openDetail(a)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{a.ID}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{customerName(a)}</td>
                    <td className="px-4 py-3 text-slate-700">{a.RuleName}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium capitalize',
                        SEVERITY_STYLES[a.Severity] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {a.Severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[a.Status] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {a.Status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {a.Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.AssignedTo?.Email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(a.CreatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {isAr
              ? `إجمالي: ${total} تنبيه`
              : `${total} alert${total !== 1 ? 's' : ''}`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAr ? '→' : '←'}
            </button>
            <span className="rounded border border-slate-200 bg-white px-3 py-1">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded border border-slate-200 bg-white px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAr ? '←' : '→'}
            </button>
          </div>
        </div>
      )}

      {/* ── Detail / Action modal ──────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  {isAr ? `تنبيه #${selected.ID}` : `Alert #${selected.ID}`}
                </h2>
                <span className={cn(
                  'rounded px-2 py-0.5 text-xs font-medium',
                  STATUS_STYLES[selected.Status] ?? 'bg-slate-100',
                )}>
                  {selected.Status.replace('_', ' ')}
                </span>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
              {loadingDetail && (
                <div className="flex justify-center py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                </div>
              )}

              {/* ── Alert overview ───────────────────────────────────────── */}
              <section className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isAr ? 'تفاصيل التنبيه' : 'Alert Details'}
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                  <DRow label={isAr ? 'القاعدة'     : 'Rule'}>
                    {selected.RuleName}
                  </DRow>
                  <DRow label={isAr ? 'نوع القاعدة' : 'Rule Type'}>
                    {RULE_TYPE_LABELS[selected.RuleType]?.[isAr ? 'ar' : 'en'] ?? selected.RuleType}
                  </DRow>
                  <DRow label={isAr ? 'الخطورة'     : 'Severity'}>
                    <span className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium capitalize',
                      SEVERITY_STYLES[selected.Severity] ?? '',
                    )}>
                      {selected.Severity}
                    </span>
                  </DRow>
                  <DRow label={isAr ? 'المبلغ المُحرِّض' : 'Triggering Amount'}>
                    {selected.Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </DRow>
                  {selected.AssignedTo && (
                    <DRow label={isAr ? 'المكلَّف' : 'Assigned To'}>
                      {selected.AssignedTo.Email}
                    </DRow>
                  )}
                </dl>
              </section>

              {/* ── Trigger data (parsed Details JSON) ───────────────────── */}
              {(() => {
                const d = parseTrigger(selected)
                const keys = Object.keys(d)
                if (!keys.length) return null
                return (
                  <section>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {isAr ? 'بيانات الاكتشاف' : 'Trigger Data'}
                    </p>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
                      {keys.flatMap(k => [
                        <dt key={`${k}-l`} className="text-slate-500">
                          {TRIGGER_DETAIL_LABELS[k]?.[isAr ? 'ar' : 'en'] ?? k}
                        </dt>,
                        <dd key={`${k}-v`} className="font-medium text-slate-800">
                          {typeof d[k] === 'number'
                            ? (d[k] as number).toLocaleString(undefined, { maximumFractionDigits: 2 })
                            : String(d[k])}
                        </dd>,
                      ])}
                    </dl>
                  </section>
                )
              })()}

              {/* ── Customer ─────────────────────────────────────────────── */}
              {selected.Customer && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {isAr ? 'العميل' : 'Customer'}
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                    <DRow label={isAr ? 'الاسم'       : 'Name'}>
                      {customerName(selected)}
                    </DRow>
                    <DRow label={isAr ? 'النوع'       : 'Type'}>
                      <span className="capitalize">{selected.Customer.CustomerType}</span>
                    </DRow>
                    <DRow label={isAr ? 'مستوى الخطر' : 'Risk Level'}>
                      {selected.Customer.RiskLevel}
                    </DRow>
                  </dl>
                </section>
              )}

              {/* ── Triggering transaction ────────────────────────────────── */}
              {selected.Transaction && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {isAr ? 'المعاملة المُحرِّضة' : 'Triggering Transaction'}
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                    <DRow label={isAr ? 'المبلغ'  : 'Amount'}>
                      {selected.Transaction.Amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}{' '}
                      {selected.Transaction.Currency}
                    </DRow>
                    <DRow label={isAr ? 'النوع'   : 'Type'}>
                      <span className="capitalize">{selected.Transaction.TxType}</span>
                    </DRow>
                    <DRow label={isAr ? 'التاريخ' : 'Date'}>
                      {new Date(selected.Transaction.TxDate).toLocaleDateString()}
                    </DRow>
                    <DRow label={isAr ? 'الحالة'  : 'Status'}>
                      <span className="capitalize">{selected.Transaction.Status}</span>
                    </DRow>
                    {selected.Transaction.Reference && (
                      <DRow label={isAr ? 'المرجع' : 'Reference'}>
                        {selected.Transaction.Reference}
                      </DRow>
                    )}
                  </dl>
                </section>
              )}

              {/* ── Existing notes ────────────────────────────────────────── */}
              {selected.Notes && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {isAr ? 'ملاحظات المراجعة' : 'Review Notes'}
                  </p>
                  <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {selected.Notes}
                  </p>
                </section>
              )}

              {/* ── Error ─────────────────────────────────────────────────── */}
              {actionErr && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionErr}</p>
              )}

              {/* ── Dismiss panel ─────────────────────────────────────────── */}
              {showDismiss && (
                <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">
                    {isAr ? 'سبب الإغلاق (مطلوب)' : 'Dismissal Notes (required)'}
                  </p>
                  <textarea
                    rows={3}
                    value={dismissNotes}
                    onChange={e => setDismissNotes(e.target.value)}
                    placeholder={isAr ? 'أدخل سبب الإغلاق...' : 'Enter reason for dismissal...'}
                    className={inputCls}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleDismiss}
                      disabled={updating || !dismissNotes.trim()}
                      className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isAr ? 'تأكيد الإغلاق' : 'Confirm Dismiss'}
                    </button>
                    <button
                      onClick={() => { setShowDismiss(false); setActionErr('') }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </section>
              )}

              {/* ── Escalate to STR panel ─────────────────────────────────── */}
              {showEscalate && (
                <section className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-orange-800">
                    {isAr ? 'إنشاء بلاغ اشتباه (STR)' : 'Create Suspicious Transaction Report'}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {isAr ? 'عنوان البلاغ *' : 'Title *'}
                      </label>
                      <input
                        type="text"
                        value={strTitle}
                        onChange={e => setStrTitle(e.target.value)}
                        placeholder={isAr ? 'عنوان البلاغ...' : 'STR title...'}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {isAr ? 'الوصف' : 'Description'}
                      </label>
                      <textarea
                        rows={3}
                        value={strDesc}
                        onChange={e => setStrDesc(e.target.value)}
                        placeholder={isAr ? 'وصف النشاط المشبوه...' : 'Description of suspicious activity...'}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEscalate}
                        disabled={strSubmitting || !strTitle.trim()}
                        className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {strSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        <ArrowUpRight className="h-4 w-4" />
                        {isAr ? 'إرسال البلاغ' : 'Submit STR & Escalate'}
                      </button>
                      <button
                        onClick={() => { setShowEscalate(false); setActionErr('') }}
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                      >
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* ── Action footer (officer/admin, actionable alerts only) ───── */}
            {isOfficer && isActionable(selected) && !showDismiss && !showEscalate && (
              <div className="shrink-0 flex flex-wrap items-center gap-2 border-t border-slate-200 px-6 py-4">
                {/* Take Ownership — only when status is open */}
                {canOwn(selected) && (
                  <button
                    onClick={handleTakeOwnership}
                    disabled={updating}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {updating
                      ? <Loader2  className="h-4 w-4 animate-spin" />
                      : <UserCheck className="h-4 w-4" />}
                    {isAr ? 'تولّي المراجعة' : 'Take Ownership'}
                  </button>
                )}

                {/* Dismiss */}
                <button
                  onClick={() => { setShowDismiss(true); setShowEscalate(false); setActionErr('') }}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isAr ? 'إغلاق التنبيه' : 'Dismiss'}
                </button>

                {/* Escalate to STR */}
                <button
                  onClick={() => {
                    setShowEscalate(true)
                    setShowDismiss(false)
                    setActionErr('')
                    if (!strTitle) {
                      setStrTitle(
                        selected.Customer
                          ? `${selected.RuleName} — ${customerName(selected)}`
                          : `${selected.RuleName} — Alert #${selected.ID}`,
                      )
                    }
                  }}
                  className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-100"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {isAr ? 'تصعيد إلى بلاغ' : 'Escalate to STR'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

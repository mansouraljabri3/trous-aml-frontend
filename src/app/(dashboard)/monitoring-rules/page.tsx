'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Shield, SlidersHorizontal, Trash2, X } from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────────────

interface UserSummary {
  ID:    number
  Email: string
}

interface MonitoringRule {
  ID:              number
  CreatedAt:       string
  Name:            string
  NameAr:          string
  Description:     string
  RuleType:        string
  Parameters:      string  // JSON string
  Severity:        string
  IsActive:        boolean
  IsSystemDefault: boolean
  CreatedByID:     number | null
  CreatedBy:       UserSummary | null
  alert_count_30d: number
}

// ── Display maps ─────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { en: string; ar: string; color: string }> = {
  threshold:   { en: 'Threshold',   ar: 'حد المبلغ',        color: 'bg-blue-100   text-blue-700'   },
  velocity:    { en: 'Velocity',    ar: 'سرعة المعاملات',  color: 'bg-purple-100 text-purple-700' },
  structuring: { en: 'Structuring', ar: 'التجزئة',          color: 'bg-orange-100 text-orange-700' },
  geography:   { en: 'Geography',   ar: 'جغرافي',           color: 'bg-teal-100   text-teal-700'   },
  pattern:     { en: 'Pattern',     ar: 'نمط',              color: 'bg-pink-100   text-pink-700'   },
}

const SEVERITY_STYLES: Record<string, string> = {
  low:      'bg-slate-100  text-slate-600',
  medium:   'bg-amber-100  text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100    text-red-700',
}

const SEVERITY_OPTS = ['low', 'medium', 'high', 'critical'] as const
const TYPE_OPTS     = ['threshold', 'velocity', 'structuring'] as const   // geography/pattern are stubs
const CURRENCY_OPTS = ['SAR', 'USD', 'EUR', 'GBP', 'AED']

// ── Parameter helpers ────────────────────────────────────────────────────────

interface ParamState {
  // threshold
  amount?:           string
  currency?:         string
  // velocity
  period_days?:      string
  // structuring
  threshold?:        string
  window_hours?:     string
  min_transactions?: string
}

function defaultParams(ruleType: string): ParamState {
  switch (ruleType) {
    case 'threshold':   return { amount: '', currency: 'SAR' }
    case 'velocity':    return { amount: '', period_days: '30' }
    case 'structuring': return { threshold: '', window_hours: '24', min_transactions: '3' }
    default:            return {}
  }
}

function parseParams(raw: string): ParamState {
  try { return JSON.parse(raw) as ParamState } catch { return {} }
}

function paramsToPayload(ruleType: string, p: ParamState): Record<string, number | string> {
  switch (ruleType) {
    case 'threshold':
      return { amount: parseFloat(p.amount || '0'), currency: p.currency ?? 'SAR' }
    case 'velocity':
      return { amount: parseFloat(p.amount || '0'), period_days: parseInt(p.period_days || '0', 10) }
    case 'structuring':
      return {
        threshold:        parseFloat(p.threshold || '0'),
        window_hours:     parseInt(p.window_hours || '0', 10),
        min_transactions: parseInt(p.min_transactions || '0', 10),
      }
    default:
      return {}
  }
}

function formatParamsSummary(ruleType: string, raw: string): string {
  const p = parseParams(raw)
  switch (ruleType) {
    case 'threshold':
      return `> ${Number(p.amount ?? 0).toLocaleString()} ${p.currency ?? ''}`
    case 'velocity':
      return `> ${Number(p.amount ?? 0).toLocaleString()} / ${p.period_days ?? '?'}d`
    case 'structuring':
      return `< ${Number(p.threshold ?? 0).toLocaleString()} × ${p.min_transactions ?? '?'} in ${p.window_hours ?? '?'}h`
    default:
      return '—'
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color: 'indigo' | 'green' | 'amber' | 'red'
}) {
  const cls = {
    indigo: { bg: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-600' },
    green:  { bg: 'bg-green-50  border-green-100',  text: 'text-green-600'  },
    amber:  { bg: 'bg-amber-50  border-amber-100',  text: 'text-amber-600'  },
    red:    { bg: 'bg-red-50    border-red-100',     text: 'text-red-600'    },
  }[color]

  return (
    <div className={cn('rounded-xl border p-5 shadow-sm', cls.bg)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', cls.text)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const labelCls = 'mb-1 block text-xs font-medium text-slate-600'

function ThresholdFields({
  p,
  set,
  isAr,
}: {
  p: ParamState
  set: (k: keyof ParamState, v: string) => void
  isAr: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>{isAr ? 'الحد الأقصى للمبلغ *' : 'Amount Limit *'}</label>
        <input
          type="number" min="0" step="0.01"
          className={inputCls}
          value={p.amount ?? ''}
          onChange={e => set('amount', e.target.value)}
          placeholder="10000"
        />
      </div>
      <div>
        <label className={labelCls}>{isAr ? 'العملة' : 'Currency'}</label>
        <select
          className={inputCls}
          value={p.currency ?? 'SAR'}
          onChange={e => set('currency', e.target.value)}
        >
          {CURRENCY_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
    </div>
  )
}

function VelocityFields({
  p,
  set,
  isAr,
}: {
  p: ParamState
  set: (k: keyof ParamState, v: string) => void
  isAr: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>{isAr ? 'الحد التراكمي *' : 'Cumulative Limit *'}</label>
        <input
          type="number" min="0" step="0.01"
          className={inputCls}
          value={p.amount ?? ''}
          onChange={e => set('amount', e.target.value)}
          placeholder="50000"
        />
      </div>
      <div>
        <label className={labelCls}>{isAr ? 'فترة الرصد (أيام) *' : 'Period (days) *'}</label>
        <input
          type="number" min="1" max="365"
          className={inputCls}
          value={p.period_days ?? ''}
          onChange={e => set('period_days', e.target.value)}
          placeholder="30"
        />
      </div>
    </div>
  )
}

function StructuringFields({
  p,
  set,
  isAr,
}: {
  p: ParamState
  set: (k: keyof ParamState, v: string) => void
  isAr: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className={labelCls}>{isAr ? 'حد الإبلاغ *' : 'Report Threshold *'}</label>
        <input
          type="number" min="0" step="0.01"
          className={inputCls}
          value={p.threshold ?? ''}
          onChange={e => set('threshold', e.target.value)}
          placeholder="10000"
        />
      </div>
      <div>
        <label className={labelCls}>{isAr ? 'النافذة (ساعات) *' : 'Window (hours) *'}</label>
        <input
          type="number" min="1" max="168"
          className={inputCls}
          value={p.window_hours ?? ''}
          onChange={e => set('window_hours', e.target.value)}
          placeholder="24"
        />
      </div>
      <div>
        <label className={labelCls}>{isAr ? 'أدنى معاملات *' : 'Min Transactions *'}</label>
        <input
          type="number" min="2" max="100"
          className={inputCls}
          value={p.min_transactions ?? ''}
          onChange={e => set('min_transactions', e.target.value)}
          placeholder="3"
        />
      </div>
    </div>
  )
}

// ── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name:        string
  name_ar:     string
  description: string
  rule_type:   string
  severity:    string
  params:      ParamState
}

const emptyForm = (): FormState => ({
  name:        '',
  name_ar:     '',
  description: '',
  rule_type:   'threshold',
  severity:    'medium',
  params:      defaultParams('threshold'),
})

function ruleToForm(rule: MonitoringRule): FormState {
  return {
    name:        rule.Name,
    name_ar:     rule.NameAr,
    description: rule.Description,
    rule_type:   rule.RuleType,
    severity:    rule.Severity,
    params:      parseParams(rule.Parameters),
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MonitoringRulesPage() {
  const { language, user } = useAuthStore()
  const isAr    = language === 'ar'
  const isAdmin = user?.role === 'admin'

  // List state
  const [rules,   setRules]   = useState<MonitoringRule[]>([])
  const [loading, setLoading] = useState(true)
  const [listErr, setListErr] = useState('')

  // Filters (client-side — rule counts per org are small)
  const [filterType,   setFilterType]   = useState('')
  const [filterSev,    setFilterSev]    = useState('')
  const [filterActive, setFilterActive] = useState<'' | 'active' | 'inactive'>('')

  // Create / edit modal
  const [showModal,    setShowModal]    = useState(false)
  const [editingRule,  setEditingRule]  = useState<MonitoringRule | null>(null)
  const [form,         setForm]         = useState<FormState>(emptyForm)
  const [formErr,      setFormErr]      = useState('')
  const [saving,       setSaving]       = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MonitoringRule | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteErr,    setDeleteErr]    = useState('')

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setListErr('')
    try {
      const { data } = await api.get('/monitoring-rules')
      setRules((data.data.items ?? []) as MonitoringRule[])
    } catch {
      setListErr(isAr ? 'فشل تحميل القواعد.' : 'Failed to load monitoring rules.')
    } finally {
      setLoading(false)
    }
  }, [isAr])

  useEffect(() => { load() }, [load])

  // ── Client-side filtering ───────────────────────────────────────────────────

  const filtered = useMemo(() => rules.filter(r => {
    if (filterType   && r.RuleType  !== filterType)                     return false
    if (filterSev    && r.Severity  !== filterSev)                      return false
    if (filterActive === 'active'   && !r.IsActive)                     return false
    if (filterActive === 'inactive' &&  r.IsActive)                     return false
    return true
  }), [rules, filterType, filterSev, filterActive])

  // ── Derived stats ───────────────────────────────────────────────────────────

  const totalRules    = rules.length
  const activeRules   = rules.filter(r => r.IsActive).length
  const totalAlerts30 = rules.reduce((s, r) => s + r.alert_count_30d, 0)

  // ── Toggle active inline ────────────────────────────────────────────────────

  const handleToggle = async (rule: MonitoringRule) => {
    // Optimistic update.
    setRules(prev => prev.map(r => r.ID === rule.ID ? { ...r, IsActive: !r.IsActive } : r))
    try {
      await api.patch(`/monitoring-rules/${rule.ID}`, { is_active: !rule.IsActive })
    } catch {
      // Revert on error.
      setRules(prev => prev.map(r => r.ID === rule.ID ? { ...r, IsActive: rule.IsActive } : r))
      setListErr(isAr ? 'فشل تحديث حالة القاعدة.' : 'Failed to update rule status.')
    }
  }

  // ── Open create/edit modal ──────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRule(null)
    setForm(emptyForm())
    setFormErr('')
    setShowModal(true)
  }

  const openEdit = (rule: MonitoringRule) => {
    setEditingRule(rule)
    setForm(ruleToForm(rule))
    setFormErr('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingRule(null)
    setFormErr('')
  }

  // ── Form helpers ────────────────────────────────────────────────────────────

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const setParam = (key: keyof ParamState, val: string) =>
    setForm(f => ({ ...f, params: { ...f.params, [key]: val } }))

  const handleTypeChange = (type: string) => {
    setForm(f => ({ ...f, rule_type: type, params: defaultParams(type) }))
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormErr(isAr ? 'الاسم مطلوب.' : 'Name is required.')
      return
    }

    const params = paramsToPayload(form.rule_type, form.params)

    // Validate all numeric params > 0 for concrete rule types.
    if (['threshold', 'velocity', 'structuring'].includes(form.rule_type)) {
      const bad = Object.entries(params).some(([, v]) => typeof v === 'number' && v <= 0)
      if (bad) {
        setFormErr(
          isAr
            ? 'جميع قيم المعاملات يجب أن تكون أكبر من صفر.'
            : 'All parameter values must be greater than zero.',
        )
        return
      }
    }

    setSaving(true)
    setFormErr('')
    try {
      if (editingRule) {
        await api.patch(`/monitoring-rules/${editingRule.ID}`, {
          name:        form.name,
          name_ar:     form.name_ar,
          description: form.description,
          severity:    form.severity,
          parameters:  params,
        })
      } else {
        await api.post('/monitoring-rules', {
          name:        form.name,
          name_ar:     form.name_ar,
          description: form.description,
          rule_type:   form.rule_type,
          severity:    form.severity,
          parameters:  params,
        })
      }
      closeModal()
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setFormErr(msg ?? (isAr ? 'فشل حفظ القاعدة.' : 'Failed to save rule.'))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteErr('')
    try {
      await api.delete(`/monitoring-rules/${deleteTarget.ID}`)
      setDeleteTarget(null)
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setDeleteErr(msg ?? (isAr ? 'فشل حذف القاعدة.' : 'Failed to delete rule.'))
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isAr ? 'قواعد المراقبة' : 'Monitoring Rules'}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {isAr
                ? 'إدارة قواعد المراقبة الآلية لمعاملات العملاء'
                : 'Manage automated rules that evaluate customer transactions'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'قاعدة جديدة' : 'New Rule'}
          </button>
        )}
      </div>

      {listErr && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{listErr}</div>
      )}

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={isAr ? 'إجمالي القواعد'    : 'Total Rules'}      value={totalRules}    color="indigo" />
        <StatCard label={isAr ? 'القواعد النشطة'     : 'Active Rules'}     value={activeRules}   color="green"  />
        <StatCard label={isAr ? 'غير نشطة'           : 'Inactive'}         value={totalRules - activeRules} color="amber" />
        <StatCard label={isAr ? 'تنبيهات (30 يومًا)' : 'Alerts (30d)'}    value={totalAlerts30} color="red"   />
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Type pills */}
        {(['', ...Object.keys(TYPE_META)] as string[]).map(t => (
          <button
            key={t || 'all-t'}
            onClick={() => setFilterType(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filterType === t
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {t ? (TYPE_META[t]?.[isAr ? 'ar' : 'en'] ?? t) : (isAr ? 'كل الأنواع' : 'All Types')}
          </button>
        ))}

        <div className="mx-1 h-5 w-px self-center bg-slate-200" />

        {/* Severity pills */}
        {(['', ...SEVERITY_OPTS] as string[]).map(sv => (
          <button
            key={sv || 'all-sv'}
            onClick={() => setFilterSev(sv)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors',
              filterSev === sv
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {sv || (isAr ? 'كل الدرجات' : 'All Severities')}
          </button>
        ))}

        <div className="mx-1 h-5 w-px self-center bg-slate-200" />

        {/* Active / Inactive toggle */}
        {(['', 'active', 'inactive'] as const).map(a => (
          <button
            key={a || 'all-a'}
            onClick={() => setFilterActive(a)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filterActive === a
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {a === ''         ? (isAr ? 'الكل'    : 'All')
             : a === 'active' ? (isAr ? 'نشط'    : 'Active')
             :                  (isAr ? 'غير نشط' : 'Inactive')}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            {isAr ? 'لا توجد قواعد' : 'No rules found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[
                    '#',
                    isAr ? 'الاسم'              : 'Name',
                    isAr ? 'النوع'              : 'Type',
                    isAr ? 'الخطورة'            : 'Severity',
                    isAr ? 'المعاملات'          : 'Parameters',
                    isAr ? 'تنبيهات (30 يومًا)' : 'Alerts (30d)',
                    isAr ? 'الحالة'             : 'Status',
                    isAr ? 'أُنشئ بواسطة'      : 'Created By',
                    '',
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(rule => (
                  <tr key={rule.ID} className="transition-colors hover:bg-slate-50">

                    {/* # */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{rule.ID}</td>

                    {/* Name + badges */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="font-medium text-slate-800">{rule.Name}</span>
                          {rule.NameAr && (
                            <span className="ml-2 text-xs text-slate-400">{rule.NameAr}</span>
                          )}
                        </div>
                        {rule.IsSystemDefault && (
                          <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                            <Shield className="h-3 w-3" />
                            {isAr ? 'افتراضي' : 'System'}
                          </span>
                        )}
                      </div>
                      {rule.Description && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                          {rule.Description}
                        </p>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        TYPE_META[rule.RuleType]?.color ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {TYPE_META[rule.RuleType]?.[isAr ? 'ar' : 'en'] ?? rule.RuleType}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium capitalize',
                        SEVERITY_STYLES[rule.Severity] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {rule.Severity}
                      </span>
                    </td>

                    {/* Parameters summary */}
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {formatParamsSummary(rule.RuleType, rule.Parameters)}
                    </td>

                    {/* Alerts 30d */}
                    <td className="px-4 py-3">
                      {rule.alert_count_30d > 0 ? (
                        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-100 px-2 text-xs font-semibold text-red-700">
                          {rule.alert_count_30d}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">0</span>
                      )}
                    </td>

                    {/* Active toggle */}
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <button
                          onClick={() => handleToggle(rule)}
                          className={cn(
                            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                            rule.IsActive ? 'bg-indigo-600' : 'bg-slate-200',
                          )}
                          title={rule.IsActive
                            ? (isAr ? 'إيقاف' : 'Deactivate')
                            : (isAr ? 'تفعيل' : 'Activate')}
                        >
                          <span
                            className={cn(
                              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out',
                              rule.IsActive ? 'translate-x-4' : 'translate-x-0',
                            )}
                          />
                        </button>
                      ) : (
                        <span className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          rule.IsActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500',
                        )}>
                          {rule.IsActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                        </span>
                      )}
                    </td>

                    {/* Created by */}
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {rule.CreatedBy?.Email ?? (rule.IsSystemDefault ? (isAr ? 'النظام' : 'System') : '—')}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(rule)}
                            title={isAr ? 'تعديل' : 'Edit'}
                            className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {!rule.IsSystemDefault && (
                            <button
                              onClick={() => { setDeleteTarget(rule); setDeleteErr('') }}
                              title={isAr ? 'حذف' : 'Delete'}
                              className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div
            className="flex w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            {/* Modal header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingRule
                  ? (isAr ? 'تعديل قاعدة المراقبة' : 'Edit Monitoring Rule')
                  : (isAr ? 'قاعدة مراقبة جديدة'  : 'New Monitoring Rule')}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">

              {/* Name EN */}
              <div>
                <label className={labelCls}>{isAr ? 'الاسم (إنجليزي) *' : 'Name (EN) *'}</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  placeholder="e.g. Large Cash Deposit"
                />
              </div>

              {/* Name AR */}
              <div>
                <label className={labelCls}>{isAr ? 'الاسم (عربي)' : 'Name (AR)'}</label>
                <input
                  type="text"
                  dir="rtl"
                  className={inputCls}
                  value={form.name_ar}
                  onChange={e => setField('name_ar', e.target.value)}
                  placeholder="مثال: إيداع نقدي كبير"
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>{isAr ? 'الوصف' : 'Description'}</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder={isAr ? 'وصف اختياري للقاعدة...' : 'Optional rule description...'}
                />
              </div>

              {/* Rule Type — locked in edit mode */}
              <div>
                <label className={labelCls}>{isAr ? 'نوع القاعدة *' : 'Rule Type *'}</label>
                <select
                  className={cn(inputCls, editingRule ? 'cursor-not-allowed bg-slate-50 text-slate-400' : '')}
                  value={form.rule_type}
                  disabled={!!editingRule}
                  onChange={e => handleTypeChange(e.target.value)}
                >
                  {TYPE_OPTS.map(t => (
                    <option key={t} value={t}>
                      {TYPE_META[t]?.[isAr ? 'ar' : 'en'] ?? t}
                    </option>
                  ))}
                </select>
                {editingRule && (
                  <p className="mt-1 text-xs text-slate-400">
                    {isAr ? 'لا يمكن تغيير نوع القاعدة بعد الإنشاء.' : 'Rule type cannot be changed after creation.'}
                  </p>
                )}
              </div>

              {/* Dynamic parameter fields */}
              <div>
                <label className={labelCls}>
                  {isAr ? 'معاملات القاعدة' : 'Rule Parameters'}
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {form.rule_type === 'threshold' && (
                    <ThresholdFields p={form.params} set={setParam} isAr={isAr} />
                  )}
                  {form.rule_type === 'velocity' && (
                    <VelocityFields p={form.params} set={setParam} isAr={isAr} />
                  )}
                  {form.rule_type === 'structuring' && (
                    <StructuringFields p={form.params} set={setParam} isAr={isAr} />
                  )}
                  {!['threshold', 'velocity', 'structuring'].includes(form.rule_type) && (
                    <p className="text-xs text-slate-400">
                      {isAr ? 'هذا النوع غير مدعوم حالياً.' : 'This rule type is not yet supported.'}
                    </p>
                  )}
                  {/* Hint */}
                  <p className="mt-2 text-xs text-slate-400">
                    {form.rule_type === 'threshold'
                      ? (isAr
                          ? 'تنبيه عند تجاوز مبلغ معاملة واحدة للحد المحدد.'
                          : 'Alert when a single transaction amount exceeds the limit.')
                      : form.rule_type === 'velocity'
                      ? (isAr
                          ? 'تنبيه عند تجاوز المجموع التراكمي للمعاملات في الفترة المحددة.'
                          : 'Alert when cumulative transaction volume over the period exceeds the limit.')
                      : form.rule_type === 'structuring'
                      ? (isAr
                          ? 'تنبيه عند رصد معاملات متعددة أقل من الحد للتهرب من الإبلاغ.'
                          : 'Alert when multiple just-below-threshold transactions suggest structuring.')
                      : ''}
                  </p>
                </div>
              </div>

              {/* Severity */}
              <div>
                <label className={labelCls}>{isAr ? 'درجة الخطورة *' : 'Severity *'}</label>
                <select
                  className={inputCls}
                  value={form.severity}
                  onChange={e => setField('severity', e.target.value)}
                >
                  {SEVERITY_OPTS.map(sv => (
                    <option key={sv} value={sv} className="capitalize">{sv}</option>
                  ))}
                </select>
              </div>

              {formErr && (
                <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formErr}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingRule
                  ? (isAr ? 'حفظ التعديلات' : 'Save Changes')
                  : (isAr ? 'إنشاء القاعدة' : 'Create Rule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
        >
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {isAr
                ? `سيتم حذف القاعدة "${deleteTarget.Name}" نهائياً. لا يمكن التراجع عن هذا الإجراء.`
                : `Rule "${deleteTarget.Name}" will be permanently deleted. This action cannot be undone.`}
            </p>

            {deleteErr && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{deleteErr}</p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isAr ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

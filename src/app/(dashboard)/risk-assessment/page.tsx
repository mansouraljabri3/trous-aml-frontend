'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Plus,
  Check,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  ShieldCheck,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface RiskFactor {
  ID:                   number
  Category:             string
  FactorName:           string
  FactorNameAr:         string
  InherentRiskScore:    number
  ControlEffectiveness: number
  ResidualRiskScore:    number
  Notes:                string
}

interface RiskAssessment {
  ID:               number
  CreatedAt:        string
  AssessedByID:     number
  ApprovedByID:     number | null
  ApprovedAt:       string | null
  Version:          string
  Status:           string
  OverallRiskLevel: string
  OverallRiskScore: number
  Factors:          RiskFactor[]
}

interface FactorForm {
  category:             string
  factorName:           string
  factorNameAr:         string
  inherentRiskScore:    number
  controlEffectiveness: number
  notes:                string
}

// ── Constants ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'Customer',    en: 'Customer',     ar: 'العملاء',         weight: '30%' },
  { key: 'Geography',   en: 'Geography',    ar: 'الجغرافيا',       weight: '20%' },
  { key: 'Product',     en: 'Product',      ar: 'المنتجات',        weight: '25%' },
  { key: 'Channel',     en: 'Channel',      ar: 'قنوات التوزيع',   weight: '10%' },
  { key: 'Transaction', en: 'Transaction',  ar: 'المعاملات',       weight: '15%' },
]

const LEVEL_COLOR: Record<string, { badge: string; bar: string; text: string }> = {
  Low:      { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  Medium:   { badge: 'bg-amber-100   text-amber-700',   bar: 'bg-amber-500',   text: 'text-amber-600'   },
  High:     { badge: 'bg-orange-100  text-orange-700',  bar: 'bg-orange-500',  text: 'text-orange-600'  },
  Critical: { badge: 'bg-red-100     text-red-700',     bar: 'bg-red-500',     text: 'text-red-600'     },
}

function levelFromScore(score: number): string {
  if (score > 4) return 'Critical'
  if (score > 3) return 'High'
  if (score > 2) return 'Medium'
  return 'Low'
}

function scoreBarColor(score: number): string {
  return LEVEL_COLOR[levelFromScore(score)]?.bar ?? 'bg-slate-300'
}

const EMPTY_FORM: FactorForm = {
  category:             'Customer',
  factorName:           '',
  factorNameAr:         '',
  inherentRiskScore:    3,
  controlEffectiveness: 3,
  notes:                '',
}

// ── ScoreBar ───────────────────────────────────────────────────────────────

function ScoreBar({ score, max = 5 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100)
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── ScoreButtons — 1-5 selector ────────────────────────────────────────────

function ScoreButtons({
  label,
  value,
  onChange,
  disabled,
}: {
  label:    string
  value:    number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-600">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              'h-9 w-9 rounded-lg border text-sm font-semibold transition-colors',
              value === n
                ? cn('border-transparent text-white', scoreBarColor(n).replace('bg-', 'bg-').replace('500', '500'))
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
              value === n && n <= 2 && 'bg-emerald-500 border-emerald-500',
              value === n && n === 3 && 'bg-amber-500 border-amber-500',
              value === n && n === 4 && 'bg-orange-500 border-orange-500',
              value === n && n === 5 && 'bg-red-500 border-red-500',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── FactorModal ────────────────────────────────────────────────────────────

function FactorModal({
  isAr,
  assessmentId,
  editFactor,
  defaultCategory,
  onClose,
  onSaved,
}: {
  isAr:            boolean
  assessmentId:    number
  editFactor:      RiskFactor | null
  defaultCategory: string
  onClose:         () => void
  onSaved:         () => void
}) {
  const isEdit = !!editFactor

  const [form,   setForm]   = useState<FactorForm>(() =>
    editFactor
      ? {
          category:             editFactor.Category,
          factorName:           editFactor.FactorName,
          factorNameAr:         editFactor.FactorNameAr,
          inherentRiskScore:    editFactor.InherentRiskScore,
          controlEffectiveness: editFactor.ControlEffectiveness,
          notes:                editFactor.Notes,
        }
      : { ...EMPTY_FORM, category: defaultCategory },
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  function field<K extends keyof FactorForm>(k: K, v: FactorForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const residual = Math.max(1, form.inherentRiskScore - form.controlEffectiveness * 0.5)

  const canSave =
    form.factorName.trim().length >= 2 &&
    form.factorNameAr.trim().length >= 2 &&
    !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setErr('')
    try {
      await api.post(`/risk-assessments/${assessmentId}/factors`, {
        category:              form.category,
        factor_name:           form.factorName.trim(),
        factor_name_ar:        form.factorNameAr.trim(),
        inherent_risk_score:   form.inherentRiskScore,
        control_effectiveness: form.controlEffectiveness,
        notes:                 form.notes.trim(),
      })
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? (isAr ? 'حدث خطأ.' : 'An error occurred.'))
    } finally {
      setSaving(false)
    }
  }

  const catObj = CATEGORIES.find((c) => c.key === form.category)

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit
              ? (isAr ? 'تعديل عامل المخاطر' : 'Edit Risk Factor')
              : (isAr ? 'إضافة عامل مخاطر' : 'Add Risk Factor')}
          </h2>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {isAr ? 'الفئة' : 'Category'}
              {isEdit && <span className="ml-1 text-slate-400 rtl:mr-1 rtl:ml-0">{isAr ? '(مُثبَّتة)' : '(locked)'}</span>}
            </label>
            {isEdit ? (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
                <span className="font-medium">{isAr ? catObj?.ar : catObj?.en}</span>
                <span className="text-xs text-slate-400">· {catObj?.weight}</span>
              </div>
            ) : (
              <select
                value={form.category}
                onChange={(e) => field('category', e.target.value)}
                disabled={saving}
                className={selectCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {isAr ? c.ar : c.en} ({c.weight})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Factor Name EN */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {isAr ? 'اسم العامل (إنجليزي) *' : 'Factor Name — English *'}
              {isEdit && <span className="ml-1 text-slate-400 rtl:mr-1 rtl:ml-0">{isAr ? '(مُثبَّت)' : '(locked)'}</span>}
            </label>
            {isEdit ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700">
                {form.factorName}
              </div>
            ) : (
              <input
                dir="ltr"
                value={form.factorName}
                onChange={(e) => field('factorName', e.target.value)}
                maxLength={200}
                placeholder="Politically Exposed Persons"
                disabled={saving}
                className={fieldCls}
              />
            )}
          </div>

          {/* Factor Name AR */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {isAr ? 'اسم العامل (عربي) *' : 'Factor Name — Arabic *'}
            </label>
            <input
              dir="rtl"
              value={form.factorNameAr}
              onChange={(e) => field('factorNameAr', e.target.value)}
              maxLength={200}
              placeholder="الأشخاص المعرضون سياسياً"
              disabled={saving}
              className={fieldCls}
            />
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <ScoreButtons
              label={isAr ? 'درجة المخاطر الكامنة (1–5)' : 'Inherent Risk Score (1–5)'}
              value={form.inherentRiskScore}
              onChange={(v) => field('inherentRiskScore', v)}
              disabled={saving}
            />
            <ScoreButtons
              label={isAr ? 'فعالية الضبط (1–5)' : 'Control Effectiveness (1–5)'}
              value={form.controlEffectiveness}
              onChange={(v) => field('controlEffectiveness', v)}
              disabled={saving}
            />
          </div>

          {/* Residual score preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                {isAr ? 'درجة المخاطر المتبقية (محسوبة تلقائياً)' : 'Residual Risk Score (auto-calculated)'}
              </span>
              <span className={cn('text-sm font-bold', LEVEL_COLOR[levelFromScore(residual)]?.text ?? 'text-slate-700')}>
                {residual.toFixed(1)} / 5 · {levelFromScore(residual)}
              </span>
            </div>
            <ScoreBar score={residual} />
            <p className="mt-1.5 text-xs text-slate-400">
              max(1, {form.inherentRiskScore} − {form.controlEffectiveness} × 0.5) = {residual.toFixed(1)}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {isAr ? 'ملاحظات' : 'Notes'}
              <span className="ml-1 text-slate-400 rtl:mr-1 rtl:ml-0">{isAr ? '(اختياري)' : '(optional)'}</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => field('notes', e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={saving}
              placeholder={isAr ? 'ملاحظات إضافية…' : 'Additional context or justification…'}
              className={cn(fieldCls, 'resize-none')}
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 ring-1 ring-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'حفظ العامل' : 'Save Factor'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CategorySection ────────────────────────────────────────────────────────

function CategorySection({
  catKey,
  catEn,
  catAr,
  weight,
  factors,
  isAr,
  canManage,
  onAddFactor,
  onEditFactor,
}: {
  catKey:       string
  catEn:        string
  catAr:        string
  weight:       string
  factors:      RiskFactor[]
  isAr:         boolean
  canManage:    boolean
  onAddFactor:  (cat: string) => void
  onEditFactor: (f: RiskFactor) => void
}) {
  const [open, setOpen] = useState(true)

  const avgResidual = factors.length
    ? factors.reduce((s, f) => s + f.ResidualRiskScore, 0) / factors.length
    : 0

  const level = factors.length ? levelFromScore(avgResidual) : null

  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      {/* Category header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 rtl:text-right"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-800">
            {isAr ? catAr : catEn}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {isAr ? `الوزن: ${weight}` : `Weight: ${weight}`}
          </span>
          {factors.length > 0 && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
              {factors.length} {isAr ? 'عامل' : factors.length === 1 ? 'factor' : 'factors'}
            </span>
          )}
          {level && (
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', LEVEL_COLOR[level]?.badge)}>
              {avgResidual.toFixed(1)} · {level}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onAddFactor(catKey) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onAddFactor(catKey) } }}
              className="flex items-center gap-1 rounded-lg border border-dashed border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50"
            >
              <Plus className="h-3 w-3" />
              {isAr ? 'إضافة' : 'Add'}
            </span>
          )}
          {open
            ? <ChevronUp   className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {/* Factors list */}
      {open && (
        <div className="border-t border-slate-50">
          {factors.length === 0 ? (
            <div className="px-5 py-4 text-center text-xs text-slate-400">
              {isAr ? 'لم تُضف عوامل لهذه الفئة بعد.' : 'No factors added for this category yet.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {factors.map((f) => (
                <div key={f.ID} className="group flex items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{isAr ? f.FactorNameAr : f.FactorName}</p>
                      <p className="text-xs text-slate-400">{isAr ? f.FactorName : f.FactorNameAr}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>{isAr ? 'كامن: ' : 'Inherent: '}<strong className="text-slate-700">{f.InherentRiskScore}</strong></span>
                      <span>{isAr ? 'ضبط: ' : 'Control: '}<strong className="text-slate-700">{f.ControlEffectiveness}</strong></span>
                      <span className={cn('font-semibold', LEVEL_COLOR[levelFromScore(f.ResidualRiskScore)]?.text ?? '')}>
                        {isAr ? 'متبقٍ: ' : 'Residual: '}{f.ResidualRiskScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-2 w-48 max-w-full">
                      <ScoreBar score={f.ResidualRiskScore} />
                    </div>
                    {f.Notes && (
                      <p className="mt-1.5 text-xs italic text-slate-400">{f.Notes}</p>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => onEditFactor(f)}
                      className="mt-0.5 shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                      title={isAr ? 'تعديل' : 'Edit factor'}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function RiskAssessmentPage() {
  const { user, language } = useAuthStore()
  const isAr     = language === 'ar'
  const isAdmin  = user?.role === 'admin'
  const canManage = user?.role === 'admin' || user?.role === 'officer'

  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [draft,      setDraft]      = useState<RiskAssessment | null>(null)
  const [history,    setHistory]    = useState<RiskAssessment[]>([])
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState('')
  const [approving,  setApproving]  = useState(false)
  const [approveErr, setApproveErr] = useState('')

  // Factor modal
  const [factorModal,  setFactorModal]  = useState(false)
  const [editFactor,   setEditFactor]   = useState<RiskFactor | null>(null)
  const [defaultCat,   setDefaultCat]   = useState('Customer')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const listRes = await api.get('/risk-assessments?page_size=50')
      const all: RiskAssessment[] = listRes.data.data.items ?? []

      const draftBasic = all.find((a) => a.Status === 'Draft')
      if (draftBasic) {
        const detailRes = await api.get(`/risk-assessments/${draftBasic.ID}`)
        setDraft({ ...detailRes.data.data, Factors: detailRes.data.data.Factors ?? [] })
      } else {
        setDraft(null)
      }
      setHistory(all.filter((a) => a.Status === 'Approved').reverse())
    } catch {
      setError(isAr ? 'فشل التحميل.' : 'Failed to load assessments.')
    } finally {
      setLoading(false)
    }
  }, [isAr])

  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setCreateErr('')
    setCreating(true)
    try {
      await api.post('/risk-assessments')
      load()
    } catch (e: any) {
      setCreateErr(e?.response?.data?.error ?? (isAr ? 'فشل الإنشاء.' : 'Failed to create.'))
    } finally {
      setCreating(false)
    }
  }

  async function handleApprove() {
    if (!draft) return
    setApproveErr('')
    setApproving(true)
    try {
      await api.patch(`/risk-assessments/${draft.ID}/approve`)
      load()
    } catch (e: any) {
      setApproveErr(e?.response?.data?.error ?? (isAr ? 'فشل الاعتماد.' : 'Approval failed.'))
    } finally {
      setApproving(false)
    }
  }

  function openAddFactor(cat: string) {
    setEditFactor(null)
    setDefaultCat(cat)
    setFactorModal(true)
  }

  function openEditFactor(f: RiskFactor) {
    setEditFactor(f)
    setDefaultCat(f.Category)
    setFactorModal(true)
  }

  const overallLevel = draft?.OverallRiskLevel ?? 'Low'
  const overallScore = draft?.OverallRiskScore ?? 0
  const levelColors  = LEVEL_COLOR[overallLevel] ?? LEVEL_COLOR.Low

  const isCreator  = draft?.AssessedByID === user?.id
  const canApprove = isAdmin && !!draft && !isCreator && (draft.Factors?.length ?? 0) > 0

  // Group factors by category
  const grouped = CATEGORIES.reduce<Record<string, RiskFactor[]>>((acc, cat) => {
    acc[cat.key] = (draft?.Factors ?? []).filter((f) => f.Category === cat.key)
    return acc
  }, {})

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isAr ? 'تقييم مخاطر المنظمة' : 'Enterprise Risk Assessment'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr
              ? 'تقييم مخاطر العمليات وفق إطار مجموعة العمل المالي (FATF)'
              : 'FATF-aligned risk scoring across 5 weighted categories'}
          </p>
        </div>
        <button
          onClick={load}
          className="self-start rounded-full border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 sm:self-auto"
          title={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Loading / Error ─────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── No draft — CTA ──────────────────────────────────────────── */}
          {!draft && (
            <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
              <div className="rounded-2xl bg-indigo-50 p-4">
                <BarChart3 className="h-10 w-10 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {isAr ? 'لا يوجد تقييم نشط' : 'No active assessment'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {isAr
                    ? 'أنشئ تقييماً جديداً لبدء رصد مخاطر المنظمة.'
                    : 'Create a new assessment to begin scoring organisational risk.'}
                </p>
              </div>
              {isAdmin && (
                <>
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {creating
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Plus    className="h-4 w-4" />}
                    {isAr ? 'إنشاء تقييم جديد' : 'Create New Assessment'}
                  </button>
                  {createErr && <p className="text-xs text-red-600">{createErr}</p>}
                </>
              )}
            </div>
          )}

          {/* ── Draft assessment ─────────────────────────────────────────── */}
          {draft && (
            <div className="space-y-5">

              {/* Overview card */}
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">

                  {/* Left: version + score */}
                  <div className="flex items-center gap-4">
                    <div className={cn('flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2', levelColors.badge.replace('text-', 'border-').replace('-700', '-300').replace('-500', '-300').replace('bg-', 'bg-').split(' ')[0])}>
                      <span className={cn('text-2xl font-black leading-none', levelColors.text)}>
                        {overallScore.toFixed(1)}
                      </span>
                      <span className="mt-0.5 text-[10px] font-medium text-slate-400">/ 5</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('rounded-full px-2.5 py-0.5 text-sm font-bold', levelColors.badge)}>
                          {overallLevel}
                        </span>
                        <span className="text-xs text-slate-400">
                          {isAr ? `الإصدار ${draft.Version}` : `Version ${draft.Version}`}
                          {' · '}
                          {isAr ? 'مسودة' : 'Draft'}
                        </span>
                      </div>
                      <div className="mt-2 w-48 max-w-full">
                        <ScoreBar score={overallScore} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {isAr
                          ? `${draft.Factors?.length ?? 0} عامل مُضاف`
                          : `${draft.Factors?.length ?? 0} factor${(draft.Factors?.length ?? 0) === 1 ? '' : 's'} added`}
                      </p>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-wrap gap-3">
                    {canManage && (
                      <button
                        onClick={() => openAddFactor('Customer')}
                        className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        <Plus className="h-4 w-4" />
                        {isAr ? 'إضافة عامل' : 'Add Factor'}
                      </button>
                    )}
                    {canApprove && (
                      <button
                        onClick={handleApprove}
                        disabled={approving}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {approving
                          ? <Loader2     className="h-4 w-4 animate-spin" />
                          : <ShieldCheck className="h-4 w-4" />}
                        {isAr ? 'اعتماد التقييم' : 'Approve Assessment'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-eyes / approval hints */}
                {isAdmin && isCreator && (draft.Factors?.length ?? 0) > 0 && (
                  <div className="border-t border-slate-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">
                    <AlertCircle className="mr-1.5 inline h-3.5 w-3.5 rtl:mr-0 rtl:ml-1.5" />
                    {isAr
                      ? 'أنشأت هذا التقييم — يجب أن يقوم مسؤول آخر باعتماده (مبدأ الرقابة المزدوجة).'
                      : 'You created this assessment — another admin must approve it (4-eyes principle).'}
                  </div>
                )}
                {!isAdmin && (draft.Factors?.length ?? 0) === 0 && (
                  <div className="border-t border-slate-100 bg-blue-50 px-5 py-3 text-xs text-blue-700">
                    {isAr
                      ? 'أضف عوامل المخاطر لكل فئة ليتمكن المسؤول من اعتماد التقييم.'
                      : 'Add risk factors for each category so an admin can approve the assessment.'}
                  </div>
                )}
                {isAdmin && !isCreator && (draft.Factors?.length ?? 0) === 0 && (
                  <div className="border-t border-slate-100 bg-blue-50 px-5 py-3 text-xs text-blue-700">
                    {isAr
                      ? 'أضف عاملاً واحداً على الأقل قبل الاعتماد.'
                      : 'At least one risk factor is required before approval.'}
                  </div>
                )}
                {approveErr && (
                  <div className="border-t border-slate-100 bg-red-50 px-5 py-3 text-xs text-red-700">
                    <AlertCircle className="mr-1.5 inline h-3.5 w-3.5 rtl:mr-0 rtl:ml-1.5" />
                    {approveErr}
                  </div>
                )}
              </div>

              {/* Category sections */}
              {CATEGORIES.map((cat) => (
                <CategorySection
                  key={cat.key}
                  catKey={cat.key}
                  catEn={cat.en}
                  catAr={cat.ar}
                  weight={cat.weight}
                  factors={grouped[cat.key] ?? []}
                  isAr={isAr}
                  canManage={canManage}
                  onAddFactor={openAddFactor}
                  onEditFactor={openEditFactor}
                />
              ))}

              {/* Category weights legend */}
              <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isAr ? 'أوزان الفئات (إطار FATF)' : 'Category Weights (FATF framework)'}
                </p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map((cat) => (
                    <div key={cat.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-semibold">{isAr ? cat.ar : cat.en}</span>
                      <span className="text-slate-400">{cat.weight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Assessment history ───────────────────────────────────────── */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {isAr ? 'التقييمات المعتمدة السابقة' : 'Approved Assessment History'}
              </h2>
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400 rtl:text-right">
                      <tr>
                        <th className="px-4 py-3">{isAr ? 'الإصدار' : 'Version'}</th>
                        <th className="px-4 py-3">{isAr ? 'مستوى المخاطر' : 'Risk Level'}</th>
                        <th className="px-4 py-3">{isAr ? 'النتيجة' : 'Score'}</th>
                        <th className="hidden px-4 py-3 sm:table-cell">{isAr ? 'تاريخ الاعتماد' : 'Approved'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {history.map((a) => (
                        <tr key={a.ID}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">v{a.Version}</td>
                          <td className="px-4 py-3">
                            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', LEVEL_COLOR[a.OverallRiskLevel]?.badge ?? 'bg-slate-100 text-slate-500')}>
                              {a.OverallRiskLevel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={cn('text-sm font-bold', LEVEL_COLOR[a.OverallRiskLevel]?.text ?? 'text-slate-700')}>
                                {a.OverallRiskScore.toFixed(2)}
                              </span>
                              <div className="w-20">
                                <ScoreBar score={a.OverallRiskScore} />
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">
                            {a.ApprovedAt
                              ? new Date(a.ApprovedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── Create new draft (when no draft, has history, is admin) ─── */}
          {!draft && history.length > 0 && isAdmin && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-8 text-center">
              <p className="text-sm text-slate-500">
                {isAr ? 'إنشاء دورة تقييم جديدة' : 'Start a new assessment cycle'}
              </p>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isAr ? 'تقييم جديد' : 'New Assessment'}
              </button>
              {createErr && <p className="text-xs text-red-600">{createErr}</p>}
            </div>
          )}
        </>
      )}

      {/* ── Factor modal ─────────────────────────────────────────────────── */}
      {factorModal && draft && (
        <FactorModal
          isAr={isAr}
          assessmentId={draft.ID}
          editFactor={editFactor}
          defaultCategory={defaultCat}
          onClose={() => setFactorModal(false)}
          onSaved={() => { setFactorModal(false); load() }}
        />
      )}

    </div>
  )
}

// ── Shared style constants ─────────────────────────────────────────────────

const fieldCls =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 ' +
  'outline-none transition placeholder:text-slate-400 ' +
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 ' +
  'disabled:bg-slate-50 disabled:opacity-60'

const selectCls =
  'w-full appearance-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 ' +
  'outline-none transition bg-white ' +
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 ' +
  'disabled:bg-slate-50 disabled:opacity-60'

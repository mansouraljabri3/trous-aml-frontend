'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  Radar,
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
}

interface ScreeningResult {
  ID:             number
  CreatedAt:      string
  CustomerID:     number
  ScreeningType:  string
  Provider:       string
  Status:         string
  MatchedLists:   string[] | null
  MatchScore:     number
  RawResponse:    string
  ScreenedAt:     string
  ReviewedByID:   number | null
  ReviewDecision: string | null
  ReviewedAt:     string | null
  Customer?:      CustomerSummary
}

interface Stats {
  total_screened: number
  pending_review: number
  confirmed_hits: number
}

interface BatchResult {
  screened: number
  hits:     number
  clear:    number
}

// ── Display maps ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  clear:          'bg-emerald-100 text-emerald-700',
  hit:            'bg-red-100 text-red-700',
  possible_match: 'bg-amber-100 text-amber-700',
  error:          'bg-slate-100 text-slate-600',
}

const REVIEW_STYLES: Record<string, string> = {
  confirmed_hit:  'bg-red-100 text-red-700',
  false_positive: 'bg-emerald-100 text-emerald-700',
  escalated:      'bg-orange-100 text-orange-700',
}

const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  sanctions:     { en: 'Sanctions',     ar: 'العقوبات' },
  pep:           { en: 'PEP',           ar: 'الأشخاص المعرضون' },
  adverse_media: { en: 'Adverse Media', ar: 'الإعلام السلبي' },
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: 'indigo' | 'amber' | 'red'
}) {
  const colorCls = {
    indigo: 'text-indigo-600',
    amber:  'text-amber-600',
    red:    'text-red-600',
  }[color]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', colorCls)}>{value.toLocaleString()}</p>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ScreeningPage() {
  const { language, user } = useAuthStore()
  const isAr              = language === 'ar'
  const isOfficer         = user?.role === 'admin' || user?.role === 'officer'
  const isAdmin           = user?.role === 'admin'

  // List state
  const [results, setResults] = useState<ScreeningResult[]>([])
  const [stats, setStats]     = useState<Stats>({ total_screened: 0, pending_review: 0, confirmed_hits: 0 })
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Filters
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter]     = useState('')
  const [reviewFilter, setReviewFilter] = useState('')

  // Detail / review modal
  const [selected, setSelected]             = useState<ScreeningResult | null>(null)
  const [reviewDecision, setReviewDecision] = useState('')
  const [reviewing, setReviewing]           = useState(false)
  const [reviewErr, setReviewErr]           = useState('')

  // Batch screen
  const [batching, setBatching]         = useState(false)
  const [batchResult, setBatchResult]   = useState<BatchResult | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (statusFilter) params.set('status', statusFilter)
      if (typeFilter)   params.set('screening_type', typeFilter)
      if (reviewFilter) params.set('review_decision', reviewFilter)
      const { data } = await api.get(`/screening-results?${params}`)
      setResults((data.data.items ?? []) as ScreeningResult[])
      setTotal(data.data.total ?? 0)
      setStats(data.data.stats ?? { total_screened: 0, pending_review: 0, confirmed_hits: 0 })
    } catch {
      setError(isAr ? 'فشل تحميل نتائج الفحص.' : 'Failed to load screening results.')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, typeFilter, reviewFilter, isAr])

  useEffect(() => { load() }, [load])

  // Reset to page 1 whenever a filter changes.
  const applyFilter = (setter: (v: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  // ── Batch screen ─────────────────────────────────────────────────────────

  const handleBatchScreen = async () => {
    setBatching(true)
    setBatchResult(null)
    setError('')
    try {
      const { data } = await api.post('/screening/batch')
      setBatchResult(data.data as BatchResult)
      load()
    } catch {
      setError(isAr ? 'فشل تنفيذ الفحص الجماعي.' : 'Batch screen failed.')
    } finally {
      setBatching(false)
    }
  }

  // ── Review ───────────────────────────────────────────────────────────────

  const handleReview = async () => {
    if (!selected || !reviewDecision) return
    setReviewing(true)
    setReviewErr('')
    try {
      const { data } = await api.post(`/screening-results/${selected.ID}/review`, {
        decision: reviewDecision,
      })
      setSelected(data.data as ScreeningResult)
      load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setReviewErr(msg ?? (isAr ? 'فشل حفظ القرار.' : 'Failed to save decision.'))
    } finally {
      setReviewing(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const customerName = (r: ScreeningResult) => {
    if (!r.Customer) return `#${r.CustomerID}`
    return r.Customer.CustomerType === 'individual'
      ? r.Customer.FullName  || '—'
      : r.Customer.CompanyName || '—'
  }

  const canReview = (r: ScreeningResult) =>
    (r.Status === 'hit' || r.Status === 'possible_match') && r.ReviewedByID == null

  const totalPages = Math.max(1, Math.ceil(total / 20))

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isAr ? 'إدارة الفحص' : 'Screening Management'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAr
              ? 'نتائج فحص العقوبات والأشخاص المعرضين سياسياً والإعلام السلبي'
              : 'Sanctions, PEP, and adverse media screening results for all customers'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleBatchScreen}
            disabled={batching}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {batching
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Radar className="h-4 w-4" />}
            {isAr ? 'فحص جماعي' : 'Batch Screen'}
          </button>
        )}
      </div>

      {/* ── Batch result banner ─────────────────────────────────────────── */}
      {batchResult && (
        <div className="flex items-start justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>
            {isAr
              ? `تم الفحص: ${batchResult.screened} عميل — إصابات: ${batchResult.hits} — نظيف: ${batchResult.clear}`
              : `Screened ${batchResult.screened} customer(s) — Hits: ${batchResult.hits} — Clear: ${batchResult.clear}`}
          </span>
          <button onClick={() => setBatchResult(null)} className="ml-4 text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={isAr ? 'إجمالي العملاء المفحوصين' : 'Total Screened'}
          value={stats.total_screened}
          color="indigo"
        />
        <StatCard
          label={isAr ? 'في انتظار المراجعة' : 'Pending Review'}
          value={stats.pending_review}
          color="amber"
        />
        <StatCard
          label={isAr ? 'إصابات مؤكدة' : 'Confirmed Hits'}
          value={stats.confirmed_hits}
          color="red"
        />
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Status */}
        {(['', 'clear', 'hit', 'possible_match'] as const).map(s => (
          <button
            key={s || 'all-status'}
            onClick={() => applyFilter(setStatusFilter, s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {s === ''
              ? (isAr ? 'كل الحالات' : 'All Statuses')
              : s.replace('_', ' ')}
          </button>
        ))}

        <div className="mx-1 h-5 w-px self-center bg-slate-200" />

        {/* Type */}
        {(['', 'sanctions', 'pep', 'adverse_media'] as const).map(t => (
          <button
            key={t || 'all-type'}
            onClick={() => applyFilter(setTypeFilter, t)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === t
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {t === ''
              ? (isAr ? 'كل الأنواع' : 'All Types')
              : (TYPE_LABELS[t]?.[isAr ? 'ar' : 'en'] ?? t)}
          </button>
        ))}

        <div className="mx-1 h-5 w-px self-center bg-slate-200" />

        {/* Review decision */}
        {(['', 'none', 'confirmed_hit', 'false_positive', 'escalated'] as const).map(r => (
          <button
            key={r || 'all-review'}
            onClick={() => applyFilter(setReviewFilter, r)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              reviewFilter === r
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-400',
            )}
          >
            {r === ''     ? (isAr ? 'كل القرارات'  : 'All Reviews')
             : r === 'none' ? (isAr ? 'لم تُراجع'    : 'Unreviewed')
             : r.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : results.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            {isAr ? 'لا توجد نتائج' : 'No screening results found'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[
                    isAr ? 'العميل'       : 'Customer',
                    isAr ? 'نوع الفحص'   : 'Type',
                    isAr ? 'الحالة'       : 'Status',
                    isAr ? 'القوائم'      : 'Matched Lists',
                    isAr ? 'الدرجة'       : 'Score',
                    isAr ? 'تاريخ الفحص'  : 'Screened At',
                    isAr ? 'المراجعة'     : 'Review',
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
                {results.map(r => (
                  <tr
                    key={r.ID}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => {
                      setSelected(r)
                      setReviewDecision('')
                      setReviewErr('')
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{customerName(r)}</td>

                    <td className="px-4 py-3">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {TYPE_LABELS[r.ScreeningType]?.[isAr ? 'ar' : 'en'] ?? r.ScreeningType}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        STATUS_STYLES[r.Status] ?? 'bg-slate-100 text-slate-600',
                      )}>
                        {r.Status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-500">
                      {r.MatchedLists?.length ? r.MatchedLists.join(', ') : '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {r.MatchScore > 0 ? `${r.MatchScore.toFixed(0)}%` : '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {new Date(r.ScreenedAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3">
                      {r.ReviewDecision ? (
                        <span className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          REVIEW_STYLES[r.ReviewDecision] ?? 'bg-slate-100 text-slate-600',
                        )}>
                          {r.ReviewDecision.replace('_', ' ')}
                        </span>
                      ) : (r.Status === 'hit' || r.Status === 'possible_match') ? (
                        <span className="text-xs font-medium text-amber-600">
                          {isAr ? 'في الانتظار' : 'Pending'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {isAr
              ? `إجمالي: ${total} نتيجة`
              : `${total} result${total !== 1 ? 's' : ''}`}
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

      {/* ── Detail / Review modal ───────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {isAr ? 'تفاصيل نتيجة الفحص' : 'Screening Result Detail'}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-4">

              {/* Customer */}
              <section>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isAr ? 'العميل' : 'Customer'}
                </p>
                <p className="font-medium text-slate-800">{customerName(selected)}</p>
                {selected.Customer && (
                  <p className="text-sm capitalize text-slate-500">{selected.Customer.CustomerType}</p>
                )}
              </section>

              {/* Screening details */}
              <section>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {isAr ? 'تفاصيل الفحص' : 'Screening Details'}
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-slate-500">{isAr ? 'النوع'       : 'Type'}</dt>
                  <dd className="font-medium text-slate-800">
                    {TYPE_LABELS[selected.ScreeningType]?.[isAr ? 'ar' : 'en'] ?? selected.ScreeningType}
                  </dd>

                  <dt className="text-slate-500">{isAr ? 'الحالة'      : 'Status'}</dt>
                  <dd>
                    <span className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium',
                      STATUS_STYLES[selected.Status] ?? 'bg-slate-100 text-slate-600',
                    )}>
                      {selected.Status.replace('_', ' ')}
                    </span>
                  </dd>

                  <dt className="text-slate-500">{isAr ? 'درجة التطابق' : 'Match Score'}</dt>
                  <dd className="font-medium text-slate-800">
                    {selected.MatchScore > 0 ? `${selected.MatchScore.toFixed(0)}%` : '—'}
                  </dd>

                  <dt className="text-slate-500">{isAr ? 'المزود'      : 'Provider'}</dt>
                  <dd className="font-medium capitalize text-slate-800">{selected.Provider}</dd>

                  <dt className="text-slate-500">{isAr ? 'تاريخ الفحص' : 'Screened At'}</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(selected.ScreenedAt).toLocaleString()}
                  </dd>
                </dl>

                {(selected.MatchedLists?.length ?? 0) > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs text-slate-500">
                      {isAr ? 'القوائم المطابقة' : 'Matched Lists'}
                    </p>
                    <ul className="space-y-1">
                      {selected.MatchedLists!.map(l => (
                        <li key={l} className="rounded bg-red-50 px-3 py-1 text-xs text-red-700">
                          {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Existing review decision */}
              {selected.ReviewDecision && (
                <section>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {isAr ? 'قرار المراجعة' : 'Review Decision'}
                  </p>
                  <span className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium',
                    REVIEW_STYLES[selected.ReviewDecision] ?? 'bg-slate-100 text-slate-600',
                  )}>
                    {selected.ReviewDecision.replace('_', ' ')}
                  </span>
                  {selected.ReviewedAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(selected.ReviewedAt).toLocaleString()}
                    </p>
                  )}
                </section>
              )}

              {/* Review form — officer/admin only, unreviewed hits/possible_matches */}
              {isOfficer && canReview(selected) && (
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-amber-800">
                    {isAr ? 'تسجيل قرار المراجعة' : 'Record Review Decision'}
                  </p>

                  <select
                    value={reviewDecision}
                    onChange={e => setReviewDecision(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">
                      {isAr ? 'اختر القرار...' : 'Select a decision...'}
                    </option>
                    <option value="confirmed_hit">
                      {isAr ? 'إصابة مؤكدة' : 'Confirmed Hit'}
                    </option>
                    <option value="false_positive">
                      {isAr ? 'إيجابية كاذبة' : 'False Positive'}
                    </option>
                    <option value="escalated">
                      {isAr ? 'تصعيد' : 'Escalated'}
                    </option>
                  </select>

                  {reviewErr && (
                    <p className="mt-2 text-xs text-red-600">{reviewErr}</p>
                  )}

                  <button
                    onClick={handleReview}
                    disabled={!reviewDecision || reviewing}
                    className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {reviewing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isAr ? 'حفظ القرار' : 'Save Decision'}
                  </button>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

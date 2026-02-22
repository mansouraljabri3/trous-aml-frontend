'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Link2,
  Loader2,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface KYCRequest {
  ID:                 number
  CreatedAt:          string
  Status:             'Generated' | 'Pending' | 'Approved' | 'Rejected'
  CustomerType:       string
  FullName:           string
  NationalID:         string
  Nationality:        string
  CompanyName:        string
  CommercialRecord:   string
  RepresentativeName: string
  CustomerID:         number | null
}

// Returned inside the approve response when screening_hit is true.
interface ScreeningResultItem {
  ID:            number
  ScreeningType: string        // 'sanctions' | 'pep' | 'adverse_media'
  Status:        string        // 'clear' | 'hit' | 'possible_match' | 'error'
  MatchedLists:  string[] | null
  MatchScore:    number
  Provider:      string
}

const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'] as const
type RiskLevel = typeof RISK_LEVELS[number]

const STATUS_STYLES: Record<KYCRequest['Status'], string> = {
  Generated: 'bg-slate-100 text-slate-600',
  Pending:   'bg-amber-100 text-amber-700',
  Approved:  'bg-emerald-100 text-emerald-700',
  Rejected:  'bg-red-100 text-red-700',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function KYCRequestsPage() {
  const { language } = useAuthStore()
  const isAr = language === 'ar'

  const [requests, setRequests]         = useState<KYCRequest[]>([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('Pending')
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')

  // Generate link state
  const [generating, setGenerating]         = useState(false)
  const [copiedId, setCopiedId]             = useState<number | null>(null)
  const [generatedLink, setGeneratedLink]   = useState<{ id: number; link: string } | null>(null)

  // Approval modal state
  const [approving, setApproving]               = useState<KYCRequest | null>(null)
  const [riskLevel, setRiskLevel]               = useState<RiskLevel>('Low')
  const [approveLoading, setApproveLoading]     = useState(false)
  const [approveErr, setApproveErr]             = useState('')
  // Set after a successful approval that returned screening_hit=true.
  // Contains only the "hit" results so the officer can acknowledge them.
  const [screeningHitResult, setScreeningHitResult] = useState<ScreeningResultItem[] | null>(null)

  // ── Data fetching ─────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/kyc-requests?${params}`)
      setRequests((data.data.items ?? []) as KYCRequest[])
      setTotal(data.data.total ?? 0)
    } catch {
      setError('Failed to load KYC requests.')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  // ── Generate link ─────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true)
    setGeneratedLink(null)
    try {
      const { data } = await api.post('/kyc-requests')
      const d = data.data as { id: number; token: string; kyc_link: string }
      // Build the link client-side so it always reflects the current frontend
      // origin, regardless of the APP_BASE_URL setting on the backend server.
      const link = window.location.origin + '/kyc/' + d.token
      setGeneratedLink({ id: d.id, link })
      load()
    } catch {
      setError('Failed to generate KYC link.')
    } finally {
      setGenerating(false)
    }
  }

  const copyLink = (id: number, link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // ── Approval modal helpers ────────────────────────────────────────────

  const closeApprovalModal = () => {
    setApproving(null)
    setScreeningHitResult(null)
    setApproveErr('')
  }

  const handleApprove = async () => {
    if (!approving) return
    setApproveLoading(true)
    setApproveErr('')
    try {
      const { data } = await api.post(`/kyc-requests/${approving.ID}/approve`, { risk_level: riskLevel })
      const result = data.data as {
        screening_hit: boolean
        screening_results: ScreeningResultItem[]
      }
      // Always refresh the list — whether hit or clear the KYC is now Approved.
      load()
      if (result.screening_hit) {
        // Stay in the modal so the officer can read and acknowledge the hit.
        setScreeningHitResult(result.screening_results.filter((r) => r.Status === 'hit'))
      } else {
        closeApprovalModal()
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setApproveErr(msg ?? 'Failed to approve request.')
    } finally {
      setApproveLoading(false)
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────

  const handleReject = async (req: KYCRequest) => {
    try {
      await api.post(`/kyc-requests/${req.ID}/reject`)
      load()
    } catch {
      setError('Failed to reject request.')
    }
  }

  // ── Helper: display name for a request ───────────────────────────────

  const displayName = (req: KYCRequest) =>
    req.CustomerType === 'corporate'
      ? req.CompanyName || <span className="italic text-slate-300">—</span>
      : req.FullName    || <span className="italic text-slate-300">—</span>

  const displaySub = (req: KYCRequest) =>
    req.CustomerType === 'corporate'
      ? req.CommercialRecord || ''
      : req.NationalID       || ''

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isAr ? 'طلبات التحقق KYC' : 'KYC Requests'}
          </h1>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {isAr ? 'إنشاء رابط التحقق' : 'Generate KYC Link'}
        </button>
      </div>

      {/* New link banner */}
      {generatedLink && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-indigo-700">
              {isAr ? 'رابط جديد — شاركه مع العميل' : 'New link — share this with the customer'}
            </p>
            <p className="truncate text-sm text-indigo-900">{generatedLink.link}</p>
          </div>
          <button
            onClick={() => copyLink(generatedLink.id, generatedLink.link)}
            className="shrink-0 rounded-lg border border-indigo-200 bg-white p-2 text-indigo-600 hover:bg-indigo-50"
            title="Copy link"
          >
            {copiedId === generatedLink.id
              ? <Check className="h-4 w-4 text-emerald-500" />
              : <Copy className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(['', 'Generated', 'Pending', 'Approved', 'Rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1) }}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {s === '' ? (isAr ? 'الكل' : 'All') : s}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            {isAr ? 'لا توجد طلبات' : 'No KYC requests found.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{isAr ? 'النوع' : 'Type'}</th>
                  <th className="px-4 py-3">{isAr ? 'الاسم / الشركة' : 'Name / Company'}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{isAr ? 'الهوية / السجل' : 'ID / CR'}</th>
                  <th className="px-4 py-3 hidden md:table-cell">{isAr ? 'الجنسية' : 'Nationality'}</th>
                  <th className="px-4 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests.map((req) => (
                  <tr key={req.ID} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{req.ID}</td>
                    <td className="px-4 py-3">
                      {req.CustomerType === 'corporate'
                        ? <span className="flex items-center gap-1 text-xs text-violet-600"><Building2 className="h-3.5 w-3.5" />{isAr ? 'شركة' : 'Corp'}</span>
                        : <span className="flex items-center gap-1 text-xs text-slate-500"><User className="h-3.5 w-3.5" />{isAr ? 'فرد' : 'Indiv'}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{displayName(req)}</p>
                      {displaySub(req) && (
                        <p className="font-mono text-xs text-slate-400">{displaySub(req)}</p>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 sm:table-cell">
                      {req.CustomerType === 'corporate'
                        ? req.CommercialRecord || <span className="italic text-slate-300">—</span>
                        : req.NationalID       || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {req.CustomerType === 'corporate'
                        ? <span className="italic text-slate-300">—</span>
                        : req.Nationality || <span className="italic text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[req.Status])}>
                        {req.Status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">
                      {new Date(req.CreatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {req.Status === 'Pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setApproving(req); setRiskLevel('Low'); setApproveErr(''); setScreeningHitResult(null) }}
                            className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isAr ? 'قبول' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(req)}
                            className="flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            {isAr ? 'رفض' : 'Reject'}
                          </button>
                        </div>
                      )}
                      {req.Status === 'Approved' && req.CustomerID && (
                        <span className="text-xs text-slate-400">
                          Customer #{req.CustomerID}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} {isAr ? 'إجمالي' : 'total'}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAr ? 'السابق' : 'Prev'}
            </button>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-200 px-3 py-1 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* ── Approval modal ────────────────────────────────────────────────── */}
      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Title — switches to a warning heading after a screening hit */}
            {screeningHitResult ? (
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <h3 className="text-base font-semibold text-red-700">
                    {isAr ? 'تحذير: اكتُشف تطابق في قوائم الفحص' : 'Screening Hit Detected'}
                  </h3>
                  <p className="text-xs text-red-500">
                    {isAr ? 'تم قبول الطلب بنجاح' : 'Request approved successfully'}
                  </p>
                </div>
              </div>
            ) : (
              <h3 className="mb-1 text-base font-semibold text-slate-900">
                {isAr ? 'قبول طلب KYC' : 'Approve KYC Request'}
              </h3>
            )}

            {/* Applicant summary — always visible */}
            <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {approving.CustomerType === 'corporate' ? (
                <>
                  <p className="font-medium text-slate-800">{approving.CompanyName || '—'}</p>
                  <p className="text-xs text-slate-400">CR: {approving.CommercialRecord || '—'}</p>
                  {approving.RepresentativeName && (
                    <p className="text-xs text-slate-400">Rep: {approving.RepresentativeName}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium text-slate-800">{approving.FullName || '—'}</p>
                  <p className="text-xs text-slate-400">ID: {approving.NationalID || '—'}</p>
                  <p className="text-xs text-slate-400">{approving.Nationality || '—'}</p>
                </>
              )}
            </div>

            {/* ── Screening hit warning (shown after approval returns a hit) ── */}
            {screeningHitResult && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
                <p className="mb-3 text-sm font-medium text-red-800">
                  {isAr
                    ? 'تم تصنيف هذا العميل تلقائياً بمستوى مخاطرة "حرج" بسبب التطابق مع قوائم العقوبات أو الأشخاص السياسيين المعرضين للخطر.'
                    : 'This customer has been automatically classified as Critical risk due to matches on sanctions or PEP lists.'}
                </p>

                <div className="space-y-2">
                  {screeningHitResult.map((r, i) => (
                    <div key={i} className="rounded border border-red-200 bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold capitalize text-red-800">
                          {r.ScreeningType.replace(/_/g, ' ')}
                        </p>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 font-mono text-xs font-bold text-red-700">
                          {isAr ? 'نتيجة:' : 'Score:'} {r.MatchScore.toFixed(0)}%
                        </span>
                      </div>
                      {r.MatchedLists && r.MatchedLists.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-xs text-red-700">
                          {r.MatchedLists.map((list, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="mt-0.5 shrink-0 text-red-400">•</span>
                              <span>{list}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk level selector — hidden once there's a confirmed hit */}
            {!screeningHitResult && (
              <>
                <p className="mb-4 text-sm text-slate-500">
                  {isAr
                    ? 'سيتم إنشاء سجل عميل جديد. حدد مستوى المخاطرة.'
                    : 'A customer record will be created. Assign a risk level.'}
                </p>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {isAr ? 'مستوى المخاطرة' : 'Risk Level'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {RISK_LEVELS.map((rl) => (
                      <button
                        key={rl}
                        type="button"
                        onClick={() => setRiskLevel(rl)}
                        className={cn(
                          'rounded-lg border py-2 text-xs font-semibold transition',
                          riskLevel === rl
                            ? RISK_SELECTED[rl]
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                        )}
                      >
                        {rl}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {approveErr && (
              <p className="mb-3 text-xs text-red-600">{approveErr}</p>
            )}

            {/* Action buttons — switch to a single "Acknowledged" button after hit */}
            {screeningHitResult ? (
              <button
                onClick={closeApprovalModal}
                className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                {isAr ? 'تم الإقرار — إغلاق' : 'Acknowledged — Close'}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={closeApprovalModal}
                  disabled={approveLoading}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approveLoading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {approveLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isAr ? 'تأكيد القبول' : 'Confirm Approval'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}

const RISK_SELECTED: Record<RiskLevel, string> = {
  Low:      'border-emerald-400 bg-emerald-50 text-emerald-700',
  Medium:   'border-amber-400 bg-amber-50 text-amber-700',
  High:     'border-orange-400 bg-orange-50 text-orange-700',
  Critical: 'border-red-500 bg-red-50 text-red-700',
}

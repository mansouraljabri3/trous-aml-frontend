'use client'

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  KeyboardEvent,
} from 'react'
import {
  AlertTriangle,
  Plus,
  Eye,
  Loader2,
  RefreshCw,
  X,
  User,
  Building2,
  Tag,
  ChevronRight,
  Download,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type STRStatus = 'Draft' | 'Under Investigation' | 'Filed to FIU' | 'Closed'

interface CaseCustomer {
  ID:               number
  CustomerType:     'individual' | 'corporate'
  FullName:         string
  CompanyName:      string
  NationalID:       string
  CommercialRecord: string
}

interface STRCase {
  ID:                 number
  CreatedAt:          string
  CustomerID:         number
  Title:              string
  Description:        string
  Status:             STRStatus
  RiskIndicators:     string[] | null
  InvestigationNotes: string
  Customer:           CaseCustomer

  // goAML report fields (nullable until set by the officer)
  ReportType:                   string | null
  ReportDate:                   string | null
  ReportPriority:               string | null
  SubjectRole:                  string | null
  SubjectAccountNumber:         string | null
  SubjectAccountType:           string | null
  SubjectBankName:              string | null
  ReportedAmount:               number | null
  ReportedCurrency:             string | null
  TransactionDateFrom:          string | null
  TransactionDateTo:            string | null
  TransactionLocation:          string | null
  TransactionDescriptionForFIU: string | null
  ReasonForSuspicion:           string | null
  GroundForReport:              string | null
}

interface CustomerOption {
  id:    number
  label: string
  type:  'individual' | 'corporate'
}

// ── Constants ──────────────────────────────────────────────────────────────

const STR_STATUSES: STRStatus[] = [
  'Draft', 'Under Investigation', 'Filed to FIU', 'Closed',
]

// Forward-only state machine — mirrors the backend.
const STR_NEXT_STATE: Record<STRStatus, STRStatus | null> = {
  'Draft':               'Under Investigation',
  'Under Investigation': 'Filed to FIU',
  'Filed to FIU':        'Closed',
  'Closed':              null,
}

const STATUS_BADGE: Record<STRStatus, string> = {
  'Draft':               'bg-slate-100   text-slate-600',
  'Under Investigation': 'bg-amber-100   text-amber-700',
  'Filed to FIU':        'bg-blue-100    text-blue-700',
  'Closed':              'bg-emerald-100 text-emerald-700',
}

const STATUS_SELECTED: Record<STRStatus, string> = {
  'Draft':               'border-slate-400   bg-slate-50   text-slate-700',
  'Under Investigation': 'border-amber-400   bg-amber-50   text-amber-700',
  'Filed to FIU':        'border-blue-400    bg-blue-50    text-blue-700',
  'Closed':              'border-emerald-400 bg-emerald-50 text-emerald-700',
}

const STATUS_LABEL: Record<STRStatus, { en: string; ar: string }> = {
  'Draft':               { en: 'Draft',               ar: 'مسودة'           },
  'Under Investigation': { en: 'Under Investigation',  ar: 'قيد التحقيق'    },
  'Filed to FIU':        { en: 'Filed to FIU',         ar: 'مُقدَّم لـ FIU' },
  'Closed':              { en: 'Closed',                ar: 'مغلق'           },
}

// ── Helpers ────────────────────────────────────────────────────────────────

function customerLabel(c: CaseCustomer): string {
  return c.CustomerType === 'corporate'
    ? c.CompanyName || `#${c.ID}`
    : c.FullName    || `#${c.ID}`
}

function statusLabel(s: STRStatus, isAr: boolean): string {
  return isAr ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function STRCasesPage() {
  const { language } = useAuthStore()
  const isAr = language === 'ar'

  // ── List state ──────────────────────────────────────────────────────────
  const [cases, setCases]               = useState<STRCase[]>([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [statusFilter, setStatusFilter] = useState<STRStatus | ''>('')
  const [loading, setLoading]           = useState(true)
  const [fetchErr, setFetchErr]         = useState(false)

  // ── Modal state ─────────────────────────────────────────────────────────
  const [fileOpen, setFileOpen] = useState(false)
  const [viewCase, setViewCase] = useState<STRCase | null>(null)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setFetchErr(false)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/str-cases?${params}`)
      setCases((data.data.items ?? []) as STRCase[])
      setTotal(data.data.total ?? 0)
    } catch {
      setFetchErr(true)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  const applyFilter = (val: STRStatus | '') => {
    setStatusFilter(val)
    setPage(1)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isAr ? 'بلاغات الاشتباه' : 'STR Cases'}
          </h1>
          {total > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title={isAr ? 'تحديث' : 'Refresh'}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setFileOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-400"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'تقديم بلاغ' : 'File New STR'}
          </button>
        </div>
      </div>

      {/* ── Status filter pills ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {([['', isAr ? 'الكل' : 'All'], ...STR_STATUSES.map((s) => [s, statusLabel(s, isAr)])] as [STRStatus | '', string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => applyFilter(val)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition',
              statusFilter === val
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {fetchErr && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
          {isAr ? 'فشل تحميل البلاغات. حاول مرة أخرى.' : 'Failed to load STR cases. Please try again.'}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
          </div>
        ) : cases.length === 0 ? (
          <EmptyState isAr={isAr} hasFilter={!!statusFilter} onNew={() => setFileOpen(true)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500 rtl:text-right">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">{isAr ? 'العميل' : 'Customer'}</th>
                  <th className="px-4 py-3">{isAr ? 'العنوان' : 'Title'}</th>
                  <th className="px-4 py-3">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="hidden px-4 py-3 md:table-cell">{isAr ? 'المؤشرات' : 'Indicators'}</th>
                  <th className="hidden px-4 py-3 sm:table-cell">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cases.map((c) => (
                  <tr key={c.ID} className="group hover:bg-slate-50/60">

                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{c.ID}</td>

                    <td className="px-4 py-3">
                      {c.Customer ? (
                        <div className="flex items-center gap-1.5">
                          {c.Customer.CustomerType === 'corporate'
                            ? <Building2 className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                            : <User       className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                          <span className="max-w-[120px] truncate font-medium text-slate-700">
                            {customerLabel(c.Customer)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">#{c.CustomerID}</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <p className="max-w-[200px] truncate font-medium text-slate-800" title={c.Title}>
                        {c.Title}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <span className={cn(
                        'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        STATUS_BADGE[c.Status],
                      )}>
                        {statusLabel(c.Status, isAr)}
                      </span>
                    </td>

                    <td className="hidden px-4 py-3 md:table-cell">
                      {c.RiskIndicators && c.RiskIndicators.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
                            {c.RiskIndicators[0]}
                          </span>
                          {c.RiskIndicators.length > 1 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                              +{c.RiskIndicators.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-slate-300">—</span>
                      )}
                    </td>

                    <td className="hidden px-4 py-3 text-xs text-slate-400 sm:table-cell">
                      {new Date(c.CreatedAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewCase(c)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1',
                          'text-xs font-medium text-slate-600 transition',
                          'opacity-0 group-hover:opacity-100',
                          'hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
                        )}
                      >
                        <Eye className="h-3 w-3" />
                        {isAr ? 'عرض' : 'View'}
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {isAr
              ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} من ${total}`
              : `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}`}
          </span>
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

      {/* ── File New STR modal ───────────────────────────────────────────── */}
      {fileOpen && (
        <FileNewSTRModal
          isAr={isAr}
          onClose={() => setFileOpen(false)}
          onSaved={() => { setFileOpen(false); load() }}
        />
      )}

      {/* ── View / Investigate modal — key forces re-mount when status advances */}
      {viewCase && (
        <ViewCaseModal
          key={`${viewCase.ID}-${viewCase.Status}`}
          isAr={isAr}
          strCase={viewCase}
          onClose={() => setViewCase(null)}
          onSaved={(updated) => {
            setViewCase(updated)
            load()
          }}
        />
      )}

    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────

function EmptyState({ isAr, hasFilter, onNew }: {
  isAr: boolean; hasFilter: boolean; onNew: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="rounded-2xl bg-amber-50 p-4">
        <AlertTriangle className="h-10 w-10 text-amber-300" />
      </div>
      <div>
        {hasFilter ? (
          <>
            <p className="text-sm font-medium text-slate-600">
              {isAr ? 'لا توجد بلاغات بهذه الحالة' : 'No cases match the selected status'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isAr ? 'جرّب إزالة الفلتر' : 'Try clearing the status filter.'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600">
              {isAr ? 'لا توجد بلاغات اشتباه بعد' : 'No STR cases filed yet'}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {isAr
                ? 'ابدأ بتقديم بلاغ اشتباه عند رصد نشاط مشبوه.'
                : 'File a report whenever you identify suspicious activity.'}
            </p>
          </>
        )}
      </div>
      {!hasFilter && (
        <button
          onClick={onNew}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" />
          {isAr ? 'تقديم بلاغ' : 'File New STR'}
        </button>
      )}
    </div>
  )
}

// ── FileNewSTRModal ────────────────────────────────────────────────────────

function FileNewSTRModal({ isAr, onClose, onSaved }: {
  isAr: boolean; onClose: () => void; onSaved: () => void
}) {
  const [customers, setCustomers]       = useState<CustomerOption[]>([])
  const [customersLoading, setCLoading] = useState(true)
  const [customersErr, setCErr]         = useState(false)

  const [customerID, setCustomerID]     = useState<number | ''>('')
  const [title, setTitle]               = useState('')
  const [description, setDescription]  = useState('')
  const [notes, setNotes]               = useState('')
  const [riskTags, setRiskTags]         = useState<string[]>([])

  const [saving, setSaving]             = useState(false)
  const [saveErr, setSaveErr]           = useState('')

  useEffect(() => {
    setCLoading(true)
    setCErr(false)
    api.get('/customers?page_size=100')
      .then(({ data }) => {
        const items = (data.data.items ?? []) as {
          ID: number; CustomerType: 'individual' | 'corporate'
          FullName: string; CompanyName: string
        }[]
        setCustomers(items.map((c) => ({
          id:    c.ID,
          label: c.CustomerType === 'corporate'
            ? (c.CompanyName || `#${c.ID}`)
            : (c.FullName    || `#${c.ID}`),
          type: c.CustomerType,
        })))
      })
      .catch(() => setCErr(true))
      .finally(() => setCLoading(false))
  }, [])

  const isDisabled = saving || !customerID || title.trim().length < 5

  const handleSubmit = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      const body: Record<string, unknown> = {
        customer_id: customerID,
        title:       title.trim(),
      }
      if (description.trim())  body.description          = description.trim()
      if (notes.trim())        body.investigation_notes  = notes.trim()
      if (riskTags.length)     body.risk_indicators      = riskTags
      await api.post('/str-cases', body)
      onSaved()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setSaveErr(msg ?? (isAr ? 'فشل تقديم البلاغ.' : 'Failed to file the report.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title={isAr ? 'تقديم بلاغ اشتباه جديد' : 'File New STR Case'}
      subtitle={isAr ? 'استكمل التفاصيل أدناه' : 'Complete the details below'}
      onClose={saving ? undefined : onClose}
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto px-6 py-5">

        {/* Customer selector */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            {isAr ? 'العميل المرتبط *' : 'Linked Customer *'}
          </label>
          {customersLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? 'جارٍ تحميل العملاء...' : 'Loading customers…'}
            </div>
          ) : customersErr ? (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
              {isAr ? 'فشل تحميل العملاء.' : 'Failed to load customers.'}
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-4 text-center text-sm text-slate-500">
              <p>{isAr ? 'لا يوجد عملاء بعد.' : 'No customers found.'}</p>
              <p className="mt-1 text-xs text-slate-400">
                {isAr ? 'أضف عميلاً أولاً قبل تقديم بلاغ.' : 'Add a customer first before filing an STR.'}
              </p>
            </div>
          ) : (
            <select
              value={customerID}
              onChange={(e) => setCustomerID(Number(e.target.value) || '')}
              disabled={saving}
              className={selectCls}
            >
              <option value="">{isAr ? '— اختر عميلاً —' : '— Select a customer —'}</option>
              {customers.filter((c) => c.type === 'individual').length > 0 && (
                <optgroup label={isAr ? 'أفراد' : 'Individuals'}>
                  {customers.filter((c) => c.type === 'individual').map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </optgroup>
              )}
              {customers.filter((c) => c.type === 'corporate').length > 0 && (
                <optgroup label={isAr ? 'شركات' : 'Corporate'}>
                  {customers.filter((c) => c.type === 'corporate').map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
          )}
        </div>

        {/* Title */}
        <div>
          <label htmlFor="str_title" className="mb-1.5 block text-sm font-medium text-slate-700">
            {isAr ? 'عنوان البلاغ *' : 'Report Title *'}
          </label>
          <input
            id="str_title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isAr ? 'مثال: ودائع نقدية غير مبررة' : 'e.g. Unusual cash deposits'}
            disabled={saving}
            className={inputCls}
            maxLength={300}
          />
          <p className={cn(
            'mt-1 text-right text-xs rtl:text-left',
            title.length < 5 && title.length > 0 ? 'text-red-400' : 'text-slate-400',
          )}>
            {title.length}/300{title.length < 5 && title.length > 0 && (isAr ? ' (5 أحرف على الأقل)' : ' (min 5)')}
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="str_desc" className="mb-1.5 block text-sm font-medium text-slate-700">
            {isAr ? 'الوصف التفصيلي' : 'Detailed Description'}
            <span className="ml-1 text-slate-400 rtl:ml-0 rtl:mr-1">{isAr ? '(اختياري)' : '(optional)'}</span>
          </label>
          <textarea
            id="str_desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={isAr ? 'اشرح طبيعة النشاط المشبوه وظروفه...' : 'Describe the nature and circumstances of the suspicious activity…'}
            disabled={saving}
            className={cn(inputCls, 'resize-none')}
            maxLength={5000}
          />
        </div>

        {/* Initial investigation notes */}
        <div>
          <label htmlFor="str_notes" className="mb-1.5 block text-sm font-medium text-slate-700">
            {isAr ? 'ملاحظات التحقيق' : 'Investigation Notes'}
            <span className="ml-1 text-slate-400 rtl:ml-0 rtl:mr-1">{isAr ? '(اختياري)' : '(optional)'}</span>
          </label>
          <textarea
            id="str_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={isAr ? 'ملاحظات داخلية أو خطوات التحقيق الأولية...' : 'Internal notes or initial investigation steps…'}
            disabled={saving}
            className={cn(inputCls, 'resize-none')}
            maxLength={10000}
          />
        </div>

        {/* Risk Indicators */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {isAr ? 'مؤشرات المخاطر' : 'Risk Indicators'}
            <span className="ml-1 text-slate-400 rtl:ml-0 rtl:mr-1">{isAr ? '(اختياري)' : '(optional)'}</span>
          </label>
          <p className="mb-2 text-xs text-slate-400">
            {isAr ? 'اكتب مؤشراً واضغط Enter أو فاصلة لإضافته كوسم' : 'Type an indicator and press Enter or comma to add it as a tag.'}
          </p>
          <RiskTagInput tags={riskTags} onChange={setRiskTags} isAr={isAr} disabled={saving} />
        </div>

        {saveErr && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            {saveErr}
          </div>
        )}
      </div>

      <ModalFooter
        isAr={isAr}
        saving={saving}
        disabled={isDisabled}
        confirmLabel={isAr ? 'تقديم البلاغ' : 'File Report'}
        onCancel={onClose}
        onConfirm={handleSubmit}
      />
    </ModalShell>
  )
}

// ── ViewCaseModal ──────────────────────────────────────────────────────────

function ViewCaseModal({ isAr, strCase, onClose, onSaved }: {
  isAr: boolean
  strCase: STRCase
  onClose: () => void
  onSaved: (updated: STRCase) => void
}) {
  const [notes, setNotes]         = useState(strCase.InvestigationNotes || '')
  const [advancing, setAdvancing] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveErr, setSaveErr]     = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState<string | null>(null)
  const [missingFields, setMissingFields] = useState<string[] | null>(null)

  const nextState    = STR_NEXT_STATE[strCase.Status]
  const isClosed     = strCase.Status === 'Closed'
  const notesChanged = notes !== (strCase.InvestigationNotes || '')
  const hasChanges   = notesChanged || advancing

  // Client-side pre-check before calling the export endpoint
  const clientMissingFields = (): string[] => {
    const missing: string[] = []
    if (!strCase.ReportType)          missing.push(isAr ? 'نوع البلاغ (STR / SAR)'                     : 'Report type (STR / SAR)')
    if (!strCase.ReasonForSuspicion)  missing.push(isAr ? 'سبب الاشتباه — نص مطلوب لـ SAFIU'           : 'Reason for suspicion — required narrative for SAFIU')
    return missing
  }

  const handleExportGoAML = async () => {
    setExportErr(null)
    setMissingFields(null)

    // Fast client-side check to surface obvious gaps before the API call
    const localMissing = clientMissingFields()
    if (localMissing.length > 0) {
      setMissingFields(localMissing)
      return
    }

    setExporting(true)
    try {
      const response = await api.get(`/str-cases/${strCase.ID}/export-goaml`, {
        responseType: 'blob',
      })
      // Trigger browser download
      const url  = URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href     = url
      link.download = `STR-${strCase.ID}-goaml.xml`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: Blob | unknown; status?: number } }
      if (axiosErr.response?.data instanceof Blob) {
        try {
          const text    = await (axiosErr.response.data as Blob).text()
          const parsed  = JSON.parse(text) as { message?: string; missing_fields?: string[] }
          if (parsed.missing_fields && parsed.missing_fields.length > 0) {
            setMissingFields(parsed.missing_fields)
          } else {
            setExportErr(parsed.message ?? (isAr ? 'فشل تصدير الملف.' : 'Export failed.'))
          }
        } catch {
          setExportErr(isAr ? 'فشل تصدير الملف.' : 'Export failed.')
        }
      } else {
        setExportErr(isAr ? 'فشل تصدير الملف.' : 'Export failed.')
      }
    } finally {
      setExporting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveErr('')
    try {
      const body: Record<string, unknown> = {}
      if (notesChanged)           body.investigation_notes = notes
      if (advancing && nextState) body.status              = nextState
      const { data } = await api.patch(`/str-cases/${strCase.ID}`, body)
      onSaved(data.data as STRCase)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setSaveErr(msg ?? (isAr ? 'فشل حفظ التغييرات.' : 'Failed to save changes.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell
      title={isAr ? `بلاغ #${strCase.ID}` : `STR Case #${strCase.ID}`}
      subtitle={new Date(strCase.CreatedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
      })}
      onClose={saving ? undefined : onClose}
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">

        {/* Customer info */}
        {strCase.Customer && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              strCase.Customer.CustomerType === 'corporate' ? 'bg-violet-100' : 'bg-indigo-100',
            )}>
              {strCase.Customer.CustomerType === 'corporate'
                ? <Building2 className="h-4 w-4 text-violet-600" />
                : <User       className="h-4 w-4 text-indigo-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-400">{isAr ? 'العميل المرتبط' : 'Linked customer'}</p>
              <p className="truncate text-sm font-medium text-slate-800">
                {customerLabel(strCase.Customer)}
              </p>
              {strCase.Customer.CustomerType === 'individual' && strCase.Customer.NationalID && (
                <p className="font-mono text-xs text-slate-400">{strCase.Customer.NationalID}</p>
              )}
              {strCase.Customer.CustomerType === 'corporate' && strCase.Customer.CommercialRecord && (
                <p className="font-mono text-xs text-slate-400">{strCase.Customer.CommercialRecord}</p>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        <DetailRow label={isAr ? 'العنوان' : 'Title'}>
          <p className="text-sm font-medium text-slate-800">{strCase.Title}</p>
        </DetailRow>

        {/* Description */}
        {strCase.Description && (
          <DetailRow label={isAr ? 'الوصف' : 'Description'}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {strCase.Description}
            </p>
          </DetailRow>
        )}

        {/* Risk Indicators */}
        <DetailRow label={isAr ? 'مؤشرات المخاطر' : 'Risk Indicators'}>
          {strCase.RiskIndicators && strCase.RiskIndicators.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {strCase.RiskIndicators.map((tag) => (
                <span key={tag} className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 ring-1 ring-rose-200">
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm italic text-slate-300">{isAr ? 'لا توجد مؤشرات' : 'No indicators added'}</p>
          )}
        </DetailRow>

        {/* Investigation Notes */}
        <DetailRow label={isAr ? 'ملاحظات التحقيق' : 'Investigation Notes'}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isClosed || saving}
            rows={4}
            placeholder={isClosed
              ? (isAr ? 'البلاغ مغلق' : 'Case is closed')
              : (isAr ? 'أضف ملاحظات التحقيق...' : 'Add investigation notes…')}
            className={cn(
              inputCls, 'resize-none',
              isClosed && 'cursor-not-allowed bg-slate-50 opacity-60',
            )}
            maxLength={10000}
          />
          {!isClosed && (
            <p className="mt-1 text-right text-xs text-slate-400 rtl:text-left">{notes.length}/10000</p>
          )}
        </DetailRow>

        {/* ── goAML Export ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">
                {isAr ? 'تصدير ملف goAML' : 'Export goAML XML'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {isAr
                  ? 'حمّل ملف XML وارفعه على بوابة goAML'
                  : 'Download the XML file and upload it to the goAML portal'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportGoAML}
              disabled={exporting || saving}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition',
                'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {exporting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Download className="h-4 w-4" />}
              {isAr ? 'تصدير' : 'Export'}
            </button>
          </div>

          {/* Missing fields list */}
          {missingFields && missingFields.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-200">
              <p className="font-medium text-amber-800">
                {isAr ? 'يرجى استكمال الحقول التالية قبل التصدير:' : 'Complete the following fields before exporting:'}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-amber-700">
                {missingFields.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs">
                    <span className="mt-0.5 shrink-0">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Export error */}
          {exportErr && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
              {exportErr}
            </div>
          )}
        </div>

        {/* ── Status machine ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">

          {/* Status flow diagram */}
          <div className="flex flex-wrap items-center gap-1">
            {STR_STATUSES.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span className={cn(
                  'whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
                  STATUS_BADGE[s],
                  strCase.Status === s && 'ring-2 ring-offset-1 ring-current',
                )}>
                  {statusLabel(s, isAr)}
                </span>
                {i < STR_STATUSES.length - 1 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" />
                )}
              </div>
            ))}
          </div>

          {/* Advance button — only shown if a next state exists */}
          {!isClosed && nextState ? (
            <button
              type="button"
              onClick={() => setAdvancing(!advancing)}
              disabled={saving}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left rtl:text-right transition',
                advancing
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <div className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition',
                advancing ? 'border-amber-500 bg-amber-500' : 'border-slate-300 bg-white',
              )}>
                {advancing && (
                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className={cn('text-sm font-medium', advancing ? 'text-amber-800' : 'text-slate-700')}>
                  {isAr
                    ? `تقديم إلى: ${statusLabel(nextState, true)}`
                    : `Advance to: ${statusLabel(nextState, false)}`}
                </p>
                <p className={cn('text-xs', advancing ? 'text-amber-500' : 'text-slate-400')}>
                  {isAr ? 'سيتم تحديث حالة البلاغ' : 'The case status will be updated on save'}
                </p>
              </div>
            </button>
          ) : isClosed ? (
            <p className="text-xs italic text-slate-400">
              {isAr ? 'هذا البلاغ مغلق ولا يمكن تقديمه.' : 'This case is closed and cannot be advanced.'}
            </p>
          ) : null}
        </div>

        {saveErr && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">
            {saveErr}
          </div>
        )}
      </div>

      <ModalFooter
        isAr={isAr}
        saving={saving}
        disabled={!hasChanges || saving}
        confirmLabel={isAr ? 'حفظ التغييرات' : 'Save Changes'}
        onCancel={onClose}
        onConfirm={handleSave}
      />
    </ModalShell>
  )
}

// ── RiskTagInput ───────────────────────────────────────────────────────────

function RiskTagInput({ tags, onChange, isAr, disabled }: {
  tags: string[]; onChange: (tags: string[]) => void; isAr: boolean; disabled: boolean
}) {
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const trimmed = raw.trim().toLowerCase().replace(/\s+/g, '_')
    if (trimmed.length < 2) return
    if (tags.includes(trimmed)) { setInputVal(''); return }
    onChange([...tags, trimmed])
    setInputVal('')
  }

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal); return }
    if (e.key === 'Backspace' && inputVal === '' && tags.length > 0) removeTag(tags[tags.length - 1])
  }

  const PRESETS = [
    'structuring', 'cash_intensive', 'pep_involvement',
    'rapid_movement', 'cross_border', 'shell_company', 'round_amounts',
  ]
  const unusedPresets = PRESETS.filter((p) => !tags.includes(p))

  return (
    <div className="space-y-3">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 transition',
          'focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20',
          disabled && 'opacity-60',
        )}
      >
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-rose-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-rose-600 ring-1 ring-rose-200 rtl:pl-1 rtl:pr-2.5">
            {tag}
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
                className="rounded-full p-0.5 hover:bg-rose-100">
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputVal.trim().length >= 2) addTag(inputVal) }}
          disabled={disabled}
          placeholder={tags.length === 0 ? (isAr ? 'اكتب مؤشراً واضغط Enter...' : 'Type and press Enter…') : ''}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>
      {unusedPresets.length > 0 && !disabled && (
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-slate-400">{isAr ? 'أضف سريعاً:' : 'Quick-add:'}</span>
          {unusedPresets.slice(0, 5).map((p) => (
            <button key={p} type="button" onClick={() => onChange([...tags, p])}
              className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600">
              + {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared modal primitives ────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose?: () => void; children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
          </div>
          {onClose && (
            <button onClick={onClose}
              className="ml-3 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 rtl:ml-0 rtl:mr-3">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({ isAr, saving, disabled, confirmLabel, onCancel, onConfirm }: {
  isAr: boolean; saving: boolean; disabled: boolean
  confirmLabel: string; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
      <button onClick={onCancel} disabled={saving}
        className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
        {isAr ? 'إغلاق' : 'Close'}
      </button>
      <button onClick={onConfirm} disabled={disabled}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      {children}
    </div>
  )
}

// ── Shared style constants ─────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5',
  'text-sm text-slate-800 placeholder-slate-400 outline-none transition',
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
  'disabled:bg-slate-50 disabled:opacity-60',
)

const selectCls = cn(
  'w-full appearance-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5',
  'text-sm text-slate-800 outline-none transition cursor-pointer',
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
  'disabled:bg-slate-50 disabled:opacity-60',
)

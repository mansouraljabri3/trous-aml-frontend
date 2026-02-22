'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Plus,
  Eye,
  Edit2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
  AlertCircle,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type PolicyStatus = 'Draft' | 'Approved' | 'Superseded'

interface Policy {
  ID:           number
  CreatedAt:    string
  CreatedByID:  number
  Title:        string
  TitleAr:      string
  Content:      string
  ContentAr:    string
  Version:      string
  Status:       PolicyStatus
  ApprovedByID: number | null
  ApprovedAt:   string | null
}

interface PolicyForm {
  title:     string
  titleAr:   string
  content:   string
  contentAr: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUSES: PolicyStatus[] = ['Draft', 'Approved', 'Superseded']

const STATUS_BADGE: Record<PolicyStatus, string> = {
  Draft:      'bg-amber-100   text-amber-700',
  Approved:   'bg-emerald-100 text-emerald-700',
  Superseded: 'bg-slate-100   text-slate-500',
}

const STATUS_LABEL: Record<PolicyStatus, { en: string; ar: string }> = {
  Draft:      { en: 'Draft',      ar: 'مسودة'   },
  Approved:   { en: 'Approved',   ar: 'معتمدة'  },
  Superseded: { en: 'Superseded', ar: 'مستبدلة' },
}

const EMPTY_FORM: PolicyForm = { title: '', titleAr: '', content: '', contentAr: '' }

const PAGE_SIZE = 15

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status, isAr }: { status: PolicyStatus; isAr: boolean }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_BADGE[status])}>
      {isAr ? STATUS_LABEL[status].ar : STATUS_LABEL[status].en}
    </span>
  )
}

// ── PolicyFormModal — create & edit ────────────────────────────────────────

function PolicyFormModal({
  isAr,
  initial,
  editId,
  onClose,
  onSaved,
}: {
  isAr:    boolean
  initial: PolicyForm
  editId:  number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form,   setForm]   = useState<PolicyForm>(initial)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  function field(k: keyof PolicyForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const allFilled =
    form.title.trim().length >= 2 &&
    form.titleAr.trim().length >= 2 &&
    form.content.trim().length >= 10 &&
    form.contentAr.trim().length >= 10

  async function handleSave() {
    if (!allFilled) { setErr(isAr ? 'جميع الحقول مطلوبة.' : 'All fields are required.'); return }
    setSaving(true)
    setErr('')
    try {
      const body = {
        title:      form.title.trim(),
        title_ar:   form.titleAr.trim(),
        content:    form.content.trim(),
        content_ar: form.contentAr.trim(),
      }
      if (editId) {
        await api.put(`/policies/${editId}`, body)
      } else {
        await api.post('/policies', body)
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.error ?? (isAr ? 'حدث خطأ.' : 'An error occurred.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-500" />
            <h2 className="text-base font-semibold text-slate-900">
              {editId
                ? (isAr ? 'تعديل السياسة' : 'Edit Policy')
                : (isAr ? 'إنشاء سياسة جديدة' : 'Create New Policy')}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[72vh] space-y-5 overflow-y-auto px-6 py-5">

          {/* Title EN */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {isAr ? 'عنوان السياسة (إنجليزي) *' : 'Policy Title — English *'}
            </label>
            <input
              dir="ltr"
              value={form.title}
              onChange={(e) => field('title', e.target.value)}
              maxLength={300}
              placeholder="AML Compliance Policy"
              disabled={saving}
              className={fieldCls}
            />
          </div>

          {/* Title AR */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              {isAr ? 'عنوان السياسة (عربي) *' : 'Policy Title — Arabic *'}
            </label>
            <input
              dir="rtl"
              value={form.titleAr}
              onChange={(e) => field('titleAr', e.target.value)}
              maxLength={300}
              placeholder="سياسة الامتثال لمكافحة غسيل الأموال"
              disabled={saving}
              className={fieldCls}
            />
          </div>

          {/* Content EN */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>{isAr ? 'نص السياسة (إنجليزي) *' : 'Policy Content — English *'}</span>
              <span className="font-normal text-slate-400">{form.content.length.toLocaleString()} / 50,000</span>
            </label>
            <textarea
              dir="ltr"
              value={form.content}
              onChange={(e) => field('content', e.target.value)}
              maxLength={50000}
              rows={9}
              placeholder="This policy establishes the framework for anti-money laundering compliance…"
              disabled={saving}
              className={cn(fieldCls, 'resize-y')}
            />
          </div>

          {/* Content AR */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>{isAr ? 'نص السياسة (عربي) *' : 'Policy Content — Arabic *'}</span>
              <span className="font-normal text-slate-400">{form.contentAr.length.toLocaleString()} / 50,000</span>
            </label>
            <textarea
              dir="rtl"
              value={form.contentAr}
              onChange={(e) => field('contentAr', e.target.value)}
              maxLength={50000}
              rows={9}
              placeholder="تحدد هذه السياسة الإطار العام لمكافحة غسيل الأموال وتمويل الإرهاب…"
              disabled={saving}
              className={cn(fieldCls, 'resize-y')}
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
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!allFilled || saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ViewPolicyModal ────────────────────────────────────────────────────────

function ViewPolicyModal({
  policy,
  isAr,
  userId,
  isAdmin,
  onClose,
  onEdit,
  onRefresh,
}: {
  policy:    Policy
  isAr:      boolean
  userId:    number
  isAdmin:   boolean
  onClose:   () => void
  onEdit:    () => void
  onRefresh: () => void
}) {
  const [lang,      setLang]      = useState<'en' | 'ar'>(isAr ? 'ar' : 'en')
  const [approving, setApproving] = useState(false)
  const [approveErr, setApproveErr] = useState('')

  const isDraft   = policy.Status === 'Draft'
  const isCreator = policy.CreatedByID === userId
  const canEdit   = isAdmin && isDraft
  const canApprove = isAdmin && isDraft && !isCreator

  async function handleApprove() {
    setApproveErr('')
    setApproving(true)
    try {
      await api.patch(`/policies/${policy.ID}/approve`)
      onRefresh()
      onClose()
    } catch (e: any) {
      setApproveErr(e?.response?.data?.error ?? (isAr ? 'فشل الاعتماد.' : 'Approval failed.'))
    } finally {
      setApproving(false)
    }
  }

  const displayTitle   = lang === 'ar' ? policy.TitleAr   : policy.Title
  const displayContent = lang === 'ar' ? policy.ContentAr : policy.Content

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !approving) onClose() }}
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {isAr ? policy.TitleAr : policy.Title}
              </h2>
              <StatusBadge status={policy.Status} isAr={isAr} />
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {isAr ? 'الإصدار' : 'Version'} {policy.Version}
              {' · '}
              {new Date(policy.CreatedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={approving}
            className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40 rtl:ml-0 rtl:mr-3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Language toggle */}
        <div className="flex gap-2 px-6 pt-4">
          {(['en', 'ar'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                lang === l
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-100',
              )}
            >
              {l === 'en' ? 'English' : 'العربية'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto px-6 py-4">
          <h3
            className="mb-3 text-sm font-semibold text-slate-800"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {displayTitle}
          </h3>
          <p
            className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600"
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
          >
            {displayContent}
          </p>
        </div>

        {/* Info banners */}
        {isAdmin && isDraft && isCreator && (
          <div className="mx-6 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 ring-1 ring-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {isAr
              ? 'أنشأت هذه السياسة — يجب أن يقوم مسؤول آخر باعتمادها (مبدأ الرقابة المزدوجة).'
              : 'You created this policy — another admin must approve it (4-eyes principle).'}
          </div>
        )}
        {approveErr && (
          <div className="mx-6 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 ring-1 ring-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {approveErr}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={approving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
          {canEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Edit2 className="h-4 w-4" />
              {isAr ? 'تعديل' : 'Edit'}
            </button>
          )}
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {approving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Check   className="h-4 w-4" />}
              {isAr ? 'اعتماد السياسة' : 'Approve Policy'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const { user, language } = useAuthStore()
  const isAr    = language === 'ar'
  const isAdmin = user?.role === 'admin'

  // List state
  const [policies,     setPolicies]     = useState<Policy[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [filter,       setFilter]       = useState<'' | PolicyStatus>('')
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')

  // Modal state
  const [showCreate,   setShowCreate]   = useState(false)
  const [editTarget,   setEditTarget]   = useState<Policy | null>(null)
  const [viewTarget,   setViewTarget]   = useState<Policy | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) })
      const res = await api.get(`/policies?${params}`)
      const all: Policy[] = res.data.data.items ?? []
      const filtered = filter ? all.filter((p) => p.Status === filter) : all
      setPolicies(filtered)
      setTotal(res.data.data.total ?? 0)
    } catch {
      setError(isAr ? 'فشل تحميل السياسات.' : 'Failed to load policies.')
    } finally {
      setLoading(false)
    }
  }, [page, filter, isAr])

  useEffect(() => { load() }, [load])

  function applyFilter(f: '' | PolicyStatus) {
    setFilter(f)
    setPage(1)
  }

  function openEdit(policy: Policy) {
    setViewTarget(null)
    setEditTarget(policy)
  }

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            {isAr ? 'سياسات مكافحة غسيل الأموال' : 'AML Policies'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {isAr ? 'إدارة السياسات واعتمادها' : 'Manage and approve compliance policies'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            {isAr ? 'إنشاء سياسة' : 'New Policy'}
          </button>
        )}
      </div>

      {/* ── Filter pills ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {([{ key: '' as const, en: 'All', ar: 'الكل' }, ...STATUSES.map((s) => ({ key: s, en: STATUS_LABEL[s].en, ar: STATUS_LABEL[s].ar }))]).map(({ key, en, ar }) => (
          <button
            key={key}
            onClick={() => applyFilter(key)}
            className={cn(
              'rounded-full border px-3.5 py-1 text-xs font-medium transition-colors',
              filter === key
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            {isAr ? ar : en}
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto rounded-full border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 rtl:ml-0 rtl:mr-auto"
          title={isAr ? 'تحديث' : 'Refresh'}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400 rtl:text-right">
              <tr>
                <th className="px-4 py-3 sm:px-6">{isAr ? 'العنوان' : 'Title'}</th>
                <th className="hidden px-4 py-3 sm:table-cell sm:px-6">{isAr ? 'الإصدار' : 'Version'}</th>
                <th className="px-4 py-3 sm:px-6">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="hidden px-4 py-3 md:table-cell md:px-6">{isAr ? 'التاريخ' : 'Date'}</th>
                <th className="px-4 py-3 sm:px-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400" />
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <FileText className="mx-auto mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm text-slate-400">
                      {filter
                        ? (isAr ? 'لا توجد سياسات بهذه الحالة.' : 'No policies with this status.')
                        : (isAr ? 'لا توجد سياسات بعد.' : 'No policies yet — create your first one.')}
                    </p>
                  </td>
                </tr>
              ) : (
                policies.map((pol) => (
                  <tr
                    key={pol.ID}
                    className="group cursor-pointer transition-colors hover:bg-slate-50"
                    onClick={() => setViewTarget(pol)}
                  >
                    <td className="px-4 py-3.5 sm:px-6">
                      <p className="font-medium text-slate-900">{isAr ? pol.TitleAr : pol.Title}</p>
                      <p className="text-xs text-slate-400">{isAr ? pol.Title : pol.TitleAr}</p>
                    </td>
                    <td className="hidden px-4 py-3.5 font-mono text-xs text-slate-500 sm:table-cell sm:px-6">
                      v{pol.Version}
                    </td>
                    <td className="px-4 py-3.5 sm:px-6">
                      <StatusBadge status={pol.Status} isAr={isAr} />
                    </td>
                    <td className="hidden px-4 py-3.5 text-xs text-slate-400 md:table-cell md:px-6">
                      {new Date(pol.CreatedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')}
                    </td>
                    <td className="px-4 py-3.5 sm:px-6">
                      <Eye className="ml-auto h-4 w-4 text-slate-200 transition group-hover:text-indigo-400 rtl:ml-0 rtl:mr-auto" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-6">
            <p className="text-xs text-slate-400">
              {isAr
                ? `الصفحة ${page} من ${totalPages} · الإجمالي ${total}`
                : `Page ${page} of ${totalPages} · ${total} total`}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              >
                {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              >
                {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────── */}

      {showCreate && (
        <PolicyFormModal
          isAr={isAr}
          initial={EMPTY_FORM}
          editId={null}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}

      {editTarget && (
        <PolicyFormModal
          isAr={isAr}
          initial={{
            title:     editTarget.Title,
            titleAr:   editTarget.TitleAr,
            content:   editTarget.Content,
            contentAr: editTarget.ContentAr,
          }}
          editId={editTarget.ID}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load() }}
        />
      )}

      {viewTarget && (
        <ViewPolicyModal
          policy={viewTarget}
          isAr={isAr}
          userId={user?.id ?? 0}
          isAdmin={isAdmin}
          onClose={() => setViewTarget(null)}
          onEdit={() => openEdit(viewTarget)}
          onRefresh={() => { setViewTarget(null); load() }}
        />
      )}

    </div>
  )
}

// ── Shared field style ─────────────────────────────────────────────────────

const fieldCls =
  'w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 ' +
  'outline-none transition placeholder:text-slate-400 ' +
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 ' +
  'disabled:bg-slate-50 disabled:opacity-60'

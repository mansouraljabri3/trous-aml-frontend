'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Users,
  Loader2,
  Send,
  UserX,
  CheckCircle2,
  Mail,
} from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface OrgData {
  ID:            number
  NameAr:        string
  NameEn:        string
  GoAMLEntityID: string
  CommercialRecord: string
}

interface UserRow {
  ID:        number
  FullName:  string
  Email:     string
  Role:      string
  IsActive:  boolean
  CreatedAt: string
}

interface Invitation {
  ID:        number
  Email:     string
  Role:      string
  IsUsed:    boolean
  ExpiresAt: string
  CreatedAt: string
}

// ── Role badge styles ──────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  admin:   'bg-indigo-100 text-indigo-700',
  officer: 'bg-blue-100 text-blue-700',
  viewer:  'bg-slate-100 text-slate-600',
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, language, login, token, org } = useAuthStore()
  const isAr    = language === 'ar'
  const isAdmin = user?.role === 'admin'

  const [tab, setTab] = useState<'org' | 'team'>('org')

  // ── Organisation tab state ───────────────────────────────────────────────
  const [orgData,    setOrgData]    = useState<OrgData | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [orgSaving,  setOrgSaving]  = useState(false)
  const [orgError,   setOrgError]   = useState('')
  const [orgSuccess, setOrgSuccess] = useState(false)

  const [nameEn,    setNameEn]    = useState('')
  const [nameAr,    setNameAr]    = useState('')
  const [goamlId,   setGoamlId]   = useState('')

  // ── Team tab state ───────────────────────────────────────────────────────
  const [users,       setUsers]       = useState<UserRow[]>([])
  const [usersTotal,  setUsersTotal]  = useState(0)
  const [usersPage,   setUsersPage]   = useState(1)
  const [usersLoading, setUsersLoading] = useState(false)

  const [invites,       setInvites]       = useState<Invitation[]>([])
  const [invitesLoading, setInvitesLoading] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState<'admin' | 'officer' | 'viewer'>('officer')
  const [inviting,    setInviting]    = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteOk,    setInviteOk]    = useState(false)

  const usersPageSize = 10

  // ── Load org ─────────────────────────────────────────────────────────────
  const loadOrg = useCallback(async () => {
    setOrgLoading(true)
    try {
      const { data } = await api.get('/organization')
      const o = data.data as OrgData
      setOrgData(o)
      setNameEn(o.NameEn  ?? '')
      setNameAr(o.NameAr  ?? '')
      setGoamlId(o.GoAMLEntityID ?? '')
    } catch { /* silently swallow */ } finally {
      setOrgLoading(false)
    }
  }, [])

  // ── Load users ────────────────────────────────────────────────────────────
  const loadUsers = useCallback(async (p: number) => {
    if (!isAdmin) return
    setUsersLoading(true)
    try {
      const { data } = await api.get('/users', { params: { page: p, page_size: usersPageSize } })
      setUsers(data.data?.items ?? [])
      setUsersTotal(data.data?.total ?? 0)
    } catch { /* silently swallow */ } finally {
      setUsersLoading(false)
    }
  }, [isAdmin])

  // ── Load invitations ──────────────────────────────────────────────────────
  const loadInvites = useCallback(async () => {
    if (!isAdmin) return
    setInvitesLoading(true)
    try {
      const { data } = await api.get('/invitations', { params: { page_size: 20 } })
      setInvites(data.data?.items ?? [])
    } catch { /* silently swallow */ } finally {
      setInvitesLoading(false)
    }
  }, [isAdmin])

  useEffect(() => { loadOrg() }, [loadOrg])
  useEffect(() => { if (tab === 'team') { loadUsers(usersPage); loadInvites() } }, [tab, usersPage, loadUsers, loadInvites])

  // ── Save org ──────────────────────────────────────────────────────────────
  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setOrgError('')
    setOrgSuccess(false)
    setOrgSaving(true)
    try {
      const { data } = await api.patch('/organization', {
        name_en:        nameEn  || undefined,
        name_ar:        nameAr  || undefined,
        goaml_entity_id: goamlId || undefined,
      })
      const updated = data.data as OrgData
      setOrgData(updated)
      // Also refresh org name in the sidebar via auth store.
      if (token && user) {
        login(token, user, {
          id:      updated.ID,
          name_en: updated.NameEn,
          name_ar: updated.NameAr,
        })
      }
      setOrgSuccess(true)
      setTimeout(() => setOrgSuccess(false), 3000)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
      setOrgError(msg ?? (isAr ? 'فشل الحفظ.' : 'Save failed.'))
    } finally {
      setOrgSaving(false)
    }
  }

  // ── Deactivate user ───────────────────────────────────────────────────────
  const handleDeactivate = async (u: UserRow) => {
    if (!confirm(isAr
      ? `هل أنت متأكد من إلغاء تفعيل ${u.FullName || u.Email}؟`
      : `Deactivate ${u.FullName || u.Email}?`)) return

    setDeactivatingId(u.ID)
    try {
      await api.delete(`/users/${u.ID}`)
      setUsers((prev) => prev.map((x) => x.ID === u.ID ? { ...x, IsActive: false } : x))
    } catch { /* best-effort */ } finally {
      setDeactivatingId(null)
    }
  }

  // ── Send invite ───────────────────────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError('')
    setInviteOk(false)
    setInviting(true)
    try {
      await api.post('/invitations', { email: inviteEmail, role: inviteRole })
      setInviteOk(true)
      setInviteEmail('')
      loadInvites()
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 409) {
        setInviteError(isAr ? 'توجد دعوة نشطة لهذا البريد.' : 'A pending invitation already exists for this email.')
      } else {
        setInviteError(isAr ? 'فشل الإرسال.' : 'Failed to send invitation.')
      }
    } finally {
      setInviting(false)
    }
  }

  const usersTotalPages = Math.ceil(usersTotal / usersPageSize)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {isAr ? 'الإعدادات' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isAr ? 'إعدادات المنظمة وإدارة الفريق.' : 'Organisation settings and team management.'}
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setTab('org')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'org'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Building2 className="h-4 w-4" />
          {isAr ? 'المنظمة' : 'Organisation'}
        </button>
        <button
          onClick={() => setTab('team')}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'team'
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          <Users className="h-4 w-4" />
          {isAr ? 'الفريق' : 'Team'}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Organisation tab
         ════════════════════════════════════════════════════════════════════ */}
      {tab === 'org' && (
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
          {orgLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? 'جارٍ التحميل…' : 'Loading…'}
            </div>
          ) : (
            <form onSubmit={handleSaveOrg} className="space-y-5 max-w-lg">

              {/* Commercial record (read-only) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {isAr ? 'السجل التجاري' : 'Commercial record'}
                </label>
                <input
                  value={orgData?.CommercialRecord ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 cursor-default"
                />
              </div>

              {/* Name EN */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {isAr ? 'اسم المنظمة (إنجليزي)' : 'Organisation name (English)'}
                </label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  disabled={!isAdmin}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 text-sm text-slate-900 outline-none transition',
                    'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                    !isAdmin ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-default' : 'border-slate-200',
                  )}
                />
              </div>

              {/* Name AR */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {isAr ? 'اسم المنظمة (عربي)' : 'Organisation name (Arabic)'}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  disabled={!isAdmin}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 text-sm text-slate-900 outline-none transition',
                    'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                    !isAdmin ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-default' : 'border-slate-200',
                  )}
                />
              </div>

              {/* GoAML Entity ID */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {isAr ? 'معرّف الكيان في goAML' : 'goAML Entity ID'}
                </label>
                <input
                  type="text"
                  value={goamlId}
                  onChange={(e) => setGoamlId(e.target.value)}
                  placeholder={isAr ? 'اختياري' : 'Optional'}
                  disabled={!isAdmin}
                  className={cn(
                    'w-full rounded-lg border px-4 py-2.5 text-sm text-slate-900 outline-none transition',
                    'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                    !isAdmin ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-default' : 'border-slate-200',
                  )}
                />
                <p className="mt-1 text-xs text-slate-400">
                  {isAr
                    ? 'يُستخدم في تصدير تقارير goAML. اتصل بـ SAFIU للحصول عليه.'
                    : 'Used in goAML XML exports. Contact SAFIU to obtain this ID.'}
                </p>
              </div>

              {/* Feedback */}
              {orgError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
                  {orgError}
                </div>
              )}
              {orgSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  {isAr ? 'تم الحفظ بنجاح.' : 'Saved successfully.'}
                </div>
              )}

              {/* Save button — admin only */}
              {isAdmin && (
                <button
                  type="submit"
                  disabled={orgSaving}
                  className={cn(
                    'flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white',
                    'transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {orgSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isAr ? 'حفظ التغييرات' : 'Save changes'}
                </button>
              )}
            </form>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          Team tab
         ════════════════════════════════════════════════════════════════════ */}
      {tab === 'team' && (
        <div className="space-y-6">

          {/* ── Users list ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-900">
                {isAr ? 'أعضاء الفريق' : 'Team members'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {isAr ? `${usersTotal} مستخدم` : `${usersTotal} user${usersTotal !== 1 ? 's' : ''}`}
              </p>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-50 bg-slate-50/50 text-xs font-medium text-slate-400">
                      <th className="px-5 py-3 text-start">{isAr ? 'الاسم' : 'Name'}</th>
                      <th className="px-5 py-3 text-start">{isAr ? 'البريد' : 'Email'}</th>
                      <th className="px-5 py-3 text-start">{isAr ? 'الدور' : 'Role'}</th>
                      <th className="px-5 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                      {isAdmin && <th className="px-5 py-3 text-start" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((u) => (
                      <tr key={u.ID} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">
                          {u.FullName || '—'}
                          {u.ID === user?.id && (
                            <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                              {isAr ? 'أنت' : 'You'}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{u.Email}</td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            ROLE_STYLES[u.Role] ?? 'bg-slate-100 text-slate-600',
                          )}>
                            {u.Role}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            u.IsActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                          )}>
                            {u.IsActive
                              ? (isAr ? 'نشط' : 'Active')
                              : (isAr ? 'غير نشط' : 'Inactive')}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3">
                            {u.IsActive && u.ID !== user?.id && (
                              <button
                                onClick={() => handleDeactivate(u)}
                                disabled={deactivatingId === u.ID}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                              >
                                {deactivatingId === u.ID
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : <UserX className="h-3 w-3" />}
                                {isAr ? 'إلغاء التفعيل' : 'Deactivate'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {usersTotalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
                <button
                  onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                  className="rounded border border-slate-200 px-3 py-1 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  {isAr ? 'السابق' : 'Prev'}
                </button>
                <span>
                  {isAr
                    ? `الصفحة ${usersPage} من ${usersTotalPages}`
                    : `Page ${usersPage} of ${usersTotalPages}`}
                </span>
                <button
                  onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                  disabled={usersPage === usersTotalPages}
                  className="rounded border border-slate-200 px-3 py-1 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  {isAr ? 'التالي' : 'Next'}
                </button>
              </div>
            )}
          </div>

          {/* ── Invite form (admin only) ──────────────────────────────────── */}
          {isAdmin && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">
                {isAr ? 'دعوة عضو جديد' : 'Invite a new member'}
              </h2>

              <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    {isAr ? 'البريد الإلكتروني' : 'Email address'}
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={isAr ? 'colleague@company.com' : 'colleague@company.com'}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    {isAr ? 'الدور' : 'Role'}
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'officer' | 'viewer')}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
                  >
                    <option value="officer">{isAr ? 'موظف' : 'Officer'}</option>
                    <option value="admin">{isAr ? 'مدير' : 'Admin'}</option>
                    <option value="viewer">{isAr ? 'مشاهد' : 'Viewer'}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={inviting || !inviteEmail}
                  className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isAr ? 'إرسال الدعوة' : 'Send invite'}
                </button>
              </form>

              {inviteError && (
                <p className="mt-2 text-sm text-red-600">{inviteError}</p>
              )}
              {inviteOk && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {isAr ? 'تم إرسال الدعوة بنجاح.' : 'Invitation sent successfully.'}
                </div>
              )}
            </div>
          )}

          {/* ── Pending invitations (admin only) ─────────────────────────── */}
          {isAdmin && (
            <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  {isAr ? 'الدعوات المرسلة' : 'Sent invitations'}
                </h2>
              </div>

              {invitesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                </div>
              ) : invites.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Mail className="h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-400">
                    {isAr ? 'لا توجد دعوات مرسلة.' : 'No invitations sent yet.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-50 bg-slate-50/50 text-xs font-medium text-slate-400">
                        <th className="px-5 py-3 text-start">{isAr ? 'البريد' : 'Email'}</th>
                        <th className="px-5 py-3 text-start">{isAr ? 'الدور' : 'Role'}</th>
                        <th className="px-5 py-3 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                        <th className="px-5 py-3 text-start">{isAr ? 'ينتهي في' : 'Expires'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {invites.map((inv) => {
                        const expired = new Date(inv.ExpiresAt) < new Date()
                        const status  = inv.IsUsed
                          ? (isAr ? 'مستخدمة' : 'Used')
                          : expired
                            ? (isAr ? 'منتهية' : 'Expired')
                            : (isAr ? 'نشطة' : 'Pending')
                        const statusStyle = inv.IsUsed
                          ? 'bg-emerald-100 text-emerald-700'
                          : expired
                            ? 'bg-red-100 text-red-600'
                            : 'bg-amber-100 text-amber-700'

                        return (
                          <tr key={inv.ID} className="hover:bg-slate-50">
                            <td className="px-5 py-3 text-slate-800">{inv.Email}</td>
                            <td className="px-5 py-3">
                              <span className={cn(
                                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                                ROLE_STYLES[inv.Role] ?? 'bg-slate-100 text-slate-600',
                              )}>
                                {inv.Role}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusStyle)}>
                                {status}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-slate-400 text-xs">
                              {new Date(inv.ExpiresAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-GB')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

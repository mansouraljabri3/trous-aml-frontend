'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Eye, EyeOff, Loader2, Building2, User, Mail, Lock, FileText } from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { parseJWT, cn } from '@/lib/utils'

// ── Field wrapper ──────────────────────────────────────────────────────────

function Field({
  label,
  icon: Icon,
  error,
  children,
}: {
  label:    string
  icon?:    React.ElementType
  error?:   string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-indigo-200">
        {Icon && <Icon className="h-3.5 w-3.5 text-indigo-400" />}
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}

// ── Input style ────────────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
  'border-white/10 outline-none transition',
  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
  'disabled:opacity-50',
)

// ── Page ───────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { token, login, language, setLanguage } = useAuthStore()
  const router = useRouter()
  const isAr   = language === 'ar'

  // Redirect already-authenticated users
  useEffect(() => {
    if (!token) return
    const claims = parseJWT(token)
    if (typeof claims.exp === 'number' && Date.now() / 1000 < claims.exp) {
      router.replace('/dashboard')
    }
  }, [token, router])

  // Form state
  const [orgNameEn,        setOrgNameEn]        = useState('')
  const [orgNameAr,        setOrgNameAr]        = useState('')
  const [commercialRecord, setCommercialRecord] = useState('')
  const [adminName,        setAdminName]        = useState('')
  const [email,            setEmail]            = useState('')
  const [password,         setPassword]         = useState('')
  const [showPass,         setShowPass]         = useState(false)

  // UI state
  const [loading, setLoading] = useState(false)
  const [apiErr,  setApiErr]  = useState('')

  // Per-field validation errors (shown after first submit attempt)
  const [touched, setTouched] = useState(false)

  const fieldErrors = {
    orgNameEn:        orgNameEn.trim().length < 2        ? (isAr ? 'مطلوب (حرفان على الأقل)' : 'Required (min 2 chars)')        : '',
    orgNameAr:        orgNameAr.trim().length < 2        ? (isAr ? 'مطلوب (حرفان على الأقل)' : 'Required (min 2 chars)')        : '',
    commercialRecord: commercialRecord.trim().length < 3 ? (isAr ? 'مطلوب (3 أحرف على الأقل)' : 'Required (min 3 chars)')       : '',
    adminName:        adminName.trim().length < 2        ? (isAr ? 'مطلوب (حرفان على الأقل)' : 'Required (min 2 chars)')        : '',
    email:            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (isAr ? 'بريد إلكتروني غير صالح' : 'Enter a valid email')    : '',
    password:         password.length < 8               ? (isAr ? 'كلمة المرور 8 أحرف على الأقل' : 'Min 8 characters')         : '',
  }

  const hasErrors = Object.values(fieldErrors).some(Boolean)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (hasErrors) return

    setApiErr('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/register', {
        org_name_en:       orgNameEn.trim(),
        org_name_ar:       orgNameAr.trim(),
        commercial_record: commercialRecord.trim(),
        admin_name:        adminName.trim(),
        email:             email.trim(),
        password,
      })

      const { token: jwt, user, organization } = data.data as {
        token:        string
        user:         { id: number; email: string; role: string }
        organization: { id: number; name_en: string; name_ar: string }
      }

      login(
        jwt,
        { id: user.id, email: user.email, role: user.role as 'admin' | 'officer' | 'viewer' },
        { id: organization.id, name_en: organization.name_en, name_ar: organization.name_ar },
      )

      router.push('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { message?: string; response?: { status?: number; data?: { error?: string } } }
      const status   = axiosErr.response?.status
      const message  = axiosErr.response?.data?.error

      if (!axiosErr.response) {
        // No response at all — backend is unreachable or CORS blocked the preflight
        setApiErr(isAr
          ? 'تعذّر الاتصال بالخادم. تأكد من تشغيل الخادم الخلفي على المنفذ 8080.'
          : 'Cannot reach the server. Make sure the backend is running on port 8080.')
      } else if (status === 409) {
        setApiErr(message ?? (isAr ? 'المنظمة أو البريد الإلكتروني مسجل بالفعل.' : 'Organisation or email already exists.'))
      } else if (status === 422) {
        setApiErr(message ?? (isAr ? 'تحقق من البيانات المدخلة.' : 'Validation failed. Check your inputs.'))
      } else if (status === 429) {
        setApiErr(message ?? (isAr ? 'محاولات كثيرة. يرجى الانتظار.' : 'Too many attempts. Please wait and try again.'))
      } else {
        setApiErr(message ?? (isAr ? 'حدث خطأ. يرجى المحاولة مجدداً.' : `Server error${status ? ` (${status})` : ''}. Please try again.`))
      }
    } finally {
      setLoading(false)
    }
  }

  const ve = touched ? fieldErrors : { orgNameEn: '', orgNameAr: '', commercialRecord: '', adminName: '', email: '', password: '' }

  return (
    <div className="relative flex min-h-screen items-start justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 py-10">
      {/* Language toggle — top-right corner */}
      <button
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className="absolute end-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
      >
        {language === 'ar' ? 'EN' : 'عربي'}
      </button>

      <div className="w-full max-w-lg">

        {/* ── Brand ──────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Trous</h1>
          <p className="mt-1 text-sm text-indigo-300">
            {isAr ? 'منصة الامتثال لمكافحة غسيل الأموال' : 'AML Compliance Platform'}
          </p>
        </div>

        {/* ── Card ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white/5 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
          <h2 className="mb-2 text-lg font-semibold text-white">
            {isAr ? 'إنشاء حساب منظمة جديد' : 'Create your organisation account'}
          </h2>
          <p className="mb-7 text-sm text-slate-300">
            {isAr
              ? 'ستكون المسؤول الأول وبإمكانك دعوة زملائك لاحقاً.'
              : 'You will be the first admin — invite colleagues after setup.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* ── Section: Organisation ─────────────────────────────────── */}
            <div className="space-y-1 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                {isAr ? 'بيانات المنظمة' : 'Organisation Details'}
              </p>
            </div>

            {/* Org name EN + AR side by side on sm+ */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label={isAr ? 'اسم المنظمة (إنجليزي)' : 'Organisation Name (English)'} icon={Building2} error={ve.orgNameEn}>
                <input
                  dir="ltr"
                  type="text"
                  value={orgNameEn}
                  onChange={(e) => setOrgNameEn(e.target.value)}
                  placeholder="Acme Financial Co."
                  maxLength={200}
                  disabled={loading}
                  className={cn(inputCls, ve.orgNameEn && 'border-red-500/50 focus:border-red-400')}
                />
              </Field>

              <Field label={isAr ? 'اسم المنظمة (عربي)' : 'Organisation Name (Arabic)'} icon={Building2} error={ve.orgNameAr}>
                <input
                  dir="rtl"
                  type="text"
                  value={orgNameAr}
                  onChange={(e) => setOrgNameAr(e.target.value)}
                  placeholder="شركة أكمي المالية"
                  maxLength={200}
                  disabled={loading}
                  className={cn(inputCls, ve.orgNameAr && 'border-red-500/50 focus:border-red-400')}
                />
              </Field>
            </div>

            {/* Commercial record */}
            <Field label={isAr ? 'رقم السجل التجاري' : 'Commercial Record Number'} icon={FileText} error={ve.commercialRecord}>
              <input
                type="text"
                value={commercialRecord}
                onChange={(e) => setCommercialRecord(e.target.value)}
                placeholder={isAr ? '1234567890' : '1234567890'}
                maxLength={100}
                disabled={loading}
                className={cn(inputCls, ve.commercialRecord && 'border-red-500/50 focus:border-red-400')}
              />
            </Field>

            {/* ── Divider ───────────────────────────────────────────────── */}
            <div className="border-t border-white/10 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                {isAr ? 'بيانات المسؤول' : 'Administrator Account'}
              </p>
            </div>

            {/* Admin name */}
            <Field label={isAr ? 'الاسم الكامل' : 'Full Name'} icon={User} error={ve.adminName}>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder={isAr ? 'محمد العمري' : 'Jane Smith'}
                maxLength={150}
                autoComplete="name"
                disabled={loading}
                className={cn(inputCls, ve.adminName && 'border-red-500/50 focus:border-red-400')}
              />
            </Field>

            {/* Email */}
            <Field label={isAr ? 'البريد الإلكتروني' : 'Email address'} icon={Mail} error={ve.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                maxLength={255}
                autoComplete="email"
                disabled={loading}
                className={cn(inputCls, ve.email && 'border-red-500/50 focus:border-red-400')}
              />
            </Field>

            {/* Password */}
            <Field label={isAr ? 'كلمة المرور' : 'Password'} icon={Lock} error={ve.password}>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  maxLength={72}
                  autoComplete="new-password"
                  disabled={loading}
                  className={cn(
                    inputCls,
                    'pe-10',
                    ve.password && 'border-red-500/50 focus:border-red-400',
                  )}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-white/40 hover:text-white/70"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!ve.password && password && (
                <p className="mt-1 text-xs text-emerald-400">
                  {isAr ? 'قوة كلمة المرور جيدة ✓' : 'Password length is good ✓'}
                </p>
              )}
            </Field>

            {/* API error */}
            {apiErr && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
                {apiErr}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                'bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20',
                'transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? 'إنشاء الحساب' : 'Create Account'}
            </button>

          </form>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-sm text-slate-300">
          {isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
          <Link
            href="/login"
            className="font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-slate-500">
          {isAr
            ? 'منصة تروس للامتثال لمكافحة غسيل الأموال — جميع الحقوق محفوظة'
            : 'Trous AML Compliance Platform — All rights reserved'}
        </p>


      </div>
    </div>
  )
}

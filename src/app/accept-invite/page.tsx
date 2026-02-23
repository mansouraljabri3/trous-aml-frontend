'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import axios from 'axios'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

// ── Inner component needs useSearchParams which requires Suspense ──────────

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const token  = searchParams.get('token') ?? ''
  const router = useRouter()

  const { language, setLanguage, login } = useAuthStore()
  const isAr = language === 'ar'

  const [fullName,  setFullName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.')
      return
    }
    if (!token) {
      setError(isAr ? 'رابط الدعوة غير صالح.' : 'Invalid invitation link.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/accept-invite', {
        token,
        full_name: fullName,
        password,
      })
      const { token: jwt, user } = data.data as {
        token: string
        user:  { id: number; email: string; role: string }
      }

      // Fetch org details using the new JWT so the sidebar shows org name correctly.
      const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'
      let org = { id: 0, name_en: '', name_ar: '' }
      try {
        const meRes = await axios.get(`${baseURL}/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
        })
        const orgData = meRes.data?.data?.organization
        if (orgData) {
          org = { id: orgData.id, name_en: orgData.name_en, name_ar: orgData.name_ar }
        }
      } catch { /* proceed with empty org — layout will show Org #id */ }

      login(
        jwt,
        { id: user.id, email: user.email, role: user.role as 'admin' | 'officer' | 'viewer' },
        org,
      )
      router.push('/dashboard')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 404) {
        setError(isAr ? 'رابط الدعوة غير موجود.' : 'Invitation not found.')
      } else if (status === 409) {
        setError(isAr ? 'تمت دعوتك بالفعل أو البريد مسجَّل.' : 'Invitation already used or email already registered.')
      } else if (status === 410) {
        setError(isAr ? 'انتهت صلاحية رابط الدعوة.' : 'Invitation has expired.')
      } else {
        setError(isAr ? 'حدث خطأ ما. يرجى المحاولة مجدداً.' : 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      {/* Language toggle */}
      <button
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className="absolute end-4 top-4 flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm transition hover:bg-white/20 hover:text-white"
      >
        {language === 'ar' ? 'EN' : 'عربي'}
      </button>

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-500/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Trous</h1>
          <p className="mt-1 text-sm text-indigo-300">
            {isAr ? 'منصة الامتثال لمكافحة غسيل الأموال' : 'AML Compliance Platform'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/5 p-8 shadow-2xl ring-1 ring-white/10 backdrop-blur-sm">
          <h2 className="mb-2 text-lg font-semibold text-white">
            {isAr ? 'قبول الدعوة' : 'Accept invitation'}
          </h2>
          <p className="mb-6 text-sm text-indigo-300">
            {isAr
              ? 'أنشئ حسابك للانضمام إلى منظمتك على منصة Trous.'
              : 'Create your account to join your organisation on Trous.'}
          </p>

          {!token && (
            <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
              {isAr ? 'رابط الدعوة غير صالح أو مفقود.' : 'Invitation link is invalid or missing.'}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Full name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-indigo-200">
                {isAr ? 'الاسم الكامل' : 'Full name'}
              </label>
              <input
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isAr ? 'اسمك الكامل' : 'Your full name'}
                className={cn(
                  'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
                  'border-white/10 outline-none transition',
                  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                  'disabled:opacity-50',
                )}
                disabled={loading || !token}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-indigo-200">
                {isAr ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
                    'border-white/10 outline-none transition pe-10',
                    'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                    'disabled:opacity-50',
                  )}
                  disabled={loading || !token}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3 text-white/40 hover:text-white/70"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-indigo-200">
                {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
              </label>
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
                  'border-white/10 outline-none transition',
                  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                  'disabled:opacity-50',
                )}
                disabled={loading || !token}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !fullName || !password || !confirm || !token}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                'bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20',
                'transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? 'إنشاء الحساب' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-300">
          {isAr ? 'هل لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
          <Link
            href="/login"
            className="font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
          >
            {isAr ? 'تسجيل الدخول' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  )
}

// ── Page export with Suspense boundary ────────────────────────────────────

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteContent />
    </Suspense>
  )
}

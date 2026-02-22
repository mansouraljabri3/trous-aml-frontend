'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { parseJWT, cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const { token, login, language, setLanguage } = useAuthStore()
  const router = useRouter()
  const isAr = language === 'ar'

  // Redirect already-authenticated users with a valid (non-expired) token
  // directly to the dashboard — skip the login form entirely.
  useEffect(() => {
    if (!token) return
    const claims = parseJWT(token)
    if (typeof claims.exp === 'number' && Date.now() / 1000 < claims.exp) {
      router.replace('/dashboard')
    }
  }, [token, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await api.post('/auth/login', { email, password })
      // The login endpoint now returns user and organization objects directly,
      // so we no longer need to decode the JWT client-side to get these fields.
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
      const status = (err as { response?: { status?: number } }).response?.status
      if (status === 401) {
        setError(isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.')
      } else if (status === 429) {
        setError(isAr ? 'محاولات كثيرة. يرجى الانتظار ثم المحاولة مجدداً.' : 'Too many attempts. Please wait and try again.')
      } else {
        setError(isAr ? 'حدث خطأ ما. يرجى المحاولة مجدداً.' : 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      {/* Language toggle — top-right corner */}
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
          <h2 className="mb-6 text-lg font-semibold text-white">
            {isAr ? 'تسجيل الدخول' : 'Sign in to your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-indigo-200">
                {isAr ? 'البريد الإلكتروني' : 'Email address'}
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? 'example@company.com' : 'you@company.com'}
                className={cn(
                  'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
                  'border-white/10 outline-none transition',
                  'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                  'disabled:opacity-50',
                )}
                disabled={loading}
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={cn(
                    'w-full rounded-lg border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30',
                    'border-white/10 outline-none transition pe-10',
                    'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20',
                    'disabled:opacity-50',
                  )}
                  disabled={loading}
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

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                'bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20',
                'transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isAr ? 'تسجيل الدخول' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-300">
          {isAr ? 'ليس لديك حساب؟' : "Don't have an account?"}{' '}
          <Link
            href="/register"
            className="font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
          >
            {isAr ? 'إنشاء حساب' : 'Create one'}
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

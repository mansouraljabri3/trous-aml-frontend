'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import useAuthStore from '@/store/authStore'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const { language, setLanguage } = useAuthStore()
  const isAr = language === 'ar'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      setError(isAr ? 'حدث خطأ ما. يرجى المحاولة مجدداً.' : 'Something went wrong. Please try again.')
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
          {sent ? (
            /* Success state */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">
                {isAr ? 'تم الإرسال' : 'Email sent'}
              </h2>
              <p className="mt-2 text-sm text-indigo-300">
                {isAr
                  ? 'إذا كان هذا البريد الإلكتروني مسجلاً لدينا، فستصل إليك رسالة إعادة التعيين خلال لحظات.'
                  : 'If an account with that email exists, a password reset link has been sent.'}
              </p>
              <Link
                href="/login"
                className="mt-6 inline-block text-sm text-indigo-400 hover:text-indigo-300"
              >
                {isAr ? '← العودة إلى تسجيل الدخول' : '← Back to sign in'}
              </Link>
            </div>
          ) : (
            /* Form */
            <>
              <h2 className="mb-2 text-lg font-semibold text-white">
                {isAr ? 'استعادة كلمة المرور' : 'Forgot your password?'}
              </h2>
              <p className="mb-6 text-sm text-indigo-300">
                {isAr
                  ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.'
                  : "Enter your email address and we'll send you a reset link."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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

                {error && (
                  <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-500/20">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                    'bg-indigo-600 text-sm font-semibold text-white shadow-md shadow-indigo-500/20',
                    'transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isAr ? 'إرسال رابط الاستعادة' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-300">
          <Link
            href="/login"
            className="font-medium text-indigo-400 underline-offset-2 hover:text-indigo-300 hover:underline"
          >
            {isAr ? '← العودة إلى تسجيل الدخول' : '← Back to sign in'}
          </Link>
        </p>
      </div>
    </div>
  )
}

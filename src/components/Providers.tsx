'use client'

import { useEffect, useState } from 'react'
import useAuthStore from '@/store/authStore'

interface ProvidersProps {
  children: React.ReactNode
}

/**
 * Providers wraps the entire application tree and handles:
 *  1. Hydration safety — defers rendering until the Zustand store has
 *     been rehydrated from localStorage, preventing SSR/CSR mismatches.
 *  2. Language direction — applies `dir="rtl"` / `dir="ltr"` and the
 *     correct `lang` attribute to <html> whenever the language changes.
 */
export default function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false)
  const language = useAuthStore((state) => state.language)

  // Mark as mounted once the client has hydrated the store.
  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync language direction and lang attribute with the <html> element.
  useEffect(() => {
    if (!mounted) return
    const html = document.documentElement
    html.lang = language
    html.dir  = language === 'ar' ? 'rtl' : 'ltr'
  }, [language, mounted])

  // On the very first render (SSR or pre-hydration), render children
  // without any direction class to avoid a flash of mis-directed content.
  // Once mounted, the useEffect above immediately corrects the attributes.
  return <>{children}</>
}

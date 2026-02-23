import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request interceptor ────────────────────────────────────────────────────
// Reads auth state from the single Zustand persist key ('trous_auth') to
// avoid the dual-key synchronisation problem that existed when separate
// trous_token / trous_org_id / trous_lang keys were maintained alongside it.
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('trous_auth')
      if (stored) {
        const { state } = JSON.parse(stored) as {
          state: {
            token?:    string
            org?:      { id?: number }
            language?: string
          }
        }
        if (state.token)    config.headers.Authorization  = `Bearer ${state.token}`
        if (state.org?.id)  config.headers['X-Org-ID']    = String(state.org.id)
        config.headers['Accept-Language'] = state.language ?? 'en'
      }
    } catch {
      // Corrupted localStorage entry — ignore and proceed unauthenticated.
    }
  }
  return config
})

// ── Response interceptor ───────────────────────────────────────────────────
// On 401, clear the entire Zustand persist key and redirect to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('trous_auth')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api

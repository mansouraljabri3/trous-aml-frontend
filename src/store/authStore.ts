import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'officer' | 'viewer'
export type Language = 'en' | 'ar'

export interface AuthUser {
  id: number
  email: string
  role: Role
}

export interface AuthOrg {
  id: number
  name_en: string
  name_ar: string
}

interface AuthState {
  token:    string | null
  user:     AuthUser | null
  org:      AuthOrg | null
  language: Language

  login:       (token: string, user: AuthUser, org: AuthOrg) => void
  logout:      () => void
  setLanguage: (lang: Language) => void
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:    null,
      user:     null,
      org:      null,
      language: 'en',

      // All state is written through the Zustand persist layer (key: 'trous_auth').
      // The Axios interceptor reads from that same key, eliminating the previously
      // duplicated trous_token / trous_org_id / trous_lang individual keys and the
      // cross-tab synchronisation risk they introduced.
      login: (token, user, org) => {
        set({ token, user, org })
      },

      logout: () => {
        set({ token: null, user: null, org: null, language: 'en' })
      },

      setLanguage: (language) => {
        set({ language })
      },
    }),
    {
      name: 'trous_auth',
      // Only data fields are persisted. Actions are always derived from the
      // store definition and are never written to localStorage.
      partialize: (state) => ({
        token:    state.token,
        user:     state.user,
        org:      state.org,
        language: state.language,
      }),
    },
  ),
)

export default useAuthStore

import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError, setAuthToken } from './api'
import type { AuthUser } from './types'

const TOKEN_KEY = 'albumrate_auth_token'

interface AuthContextValue {
  user: AuthUser | null
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let active = true
    SecureStore.getItemAsync(TOKEN_KEY)
      .then(async (token) => {
        if (!token) return
        setAuthToken(token)
        try {
          const { user: me } = await api.me()
          if (active) setUser(me)
        } catch (err) {
          if (!active) return
          if (err instanceof ApiError && err.status === 401) {
            await SecureStore.deleteItemAsync(TOKEN_KEY)
            setAuthToken(null)
          } else {
            setAuthToken(null)
          }
        }
      })
      .finally(() => {
        if (active) setInitializing(false)
      })
    return () => {
      active = false
    }
  }, [])

  const storeSession = useCallback(async (token: string, authedUser: AuthUser) => {
    setAuthToken(token)
    setUser(authedUser)
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password)
      await storeSession(result.token, result.user)
    },
    [storeSession],
  )

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      const result = await api.register(email, password, name)
      await storeSession(result.token, result.user)
    },
    [storeSession],
  )

  const signOut = useCallback(async () => {
    setAuthToken(null)
    setUser(null)
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  }, [])

  const value = useMemo(
    () => ({ user, initializing, signIn, signUp, signOut }),
    [user, initializing, signIn, signUp, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.')
  }
  return context
}

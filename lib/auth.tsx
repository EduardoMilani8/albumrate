import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError, setAuthToken } from './api'
import { openSpotifyAuth } from './spotifyAuth'
import type { AuthUser } from './types'

const TOKEN_KEY = 'albumrate_auth_token'

export type SpotifySignInResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | {
      ok: false
      cancelled: false
      conflict: true
      existingUser: { name: string | null; email: string | null }
      pendingLinkToken: string
    }

interface AuthContextValue {
  user: AuthUser | null
  initializing: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithSpotify: () => Promise<SpotifySignInResult>
  resolveSpotifyConflict: (pendingLinkToken: string, linkMode: 'link' | 'new') => Promise<void>
  disconnectSpotify: () => Promise<void>
  refreshUser: () => Promise<void>
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

  const signInWithSpotify = useCallback(async (): Promise<SpotifySignInResult> => {
    const { state } = await api.spotifyBegin()
    const auth = await openSpotifyAuth(state)
    if (!auth) return { ok: false, cancelled: true }

    const result = await api.spotifyExchange({
      code: auth.code,
      codeVerifier: auth.codeVerifier,
      redirectUri: auth.redirectUri,
      state: auth.state,
    })
    if ('token' in result) {
      await storeSession(result.token, result.user)
      return { ok: true }
    }
    return {
      ok: false,
      cancelled: false,
      conflict: true,
      existingUser: result.existingUser,
      pendingLinkToken: result.pendingLinkToken,
    }
  }, [storeSession])

  const resolveSpotifyConflict = useCallback(
    async (pendingLinkToken: string, linkMode: 'link' | 'new') => {
      const result = await api.spotifyLink({ pendingLinkToken, linkMode })
      await storeSession(result.token, result.user)
    },
    [storeSession],
  )

  const disconnectSpotify = useCallback(async () => {
    await api.disconnectSpotify()
    const { user: me } = await api.me()
    setUser(me)
  }, [])

  const refreshUser = useCallback(async () => {
    const { user: me } = await api.me()
    setUser(me)
  }, [])

  const value = useMemo(
    () => ({
      user,
      initializing,
      signIn,
      signUp,
      signOut,
      signInWithSpotify,
      resolveSpotifyConflict,
      disconnectSpotify,
      refreshUser,
    }),
    [
      user,
      initializing,
      signIn,
      signUp,
      signOut,
      signInWithSpotify,
      resolveSpotifyConflict,
      disconnectSpotify,
      refreshUser,
    ],
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

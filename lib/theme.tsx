import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_THEME_ID,
  getTheme,
  isThemeId,
  type Theme,
  type ThemeId,
  type ThemeTokens,
} from '../constants/themes'
import { api } from './api'
import { useAuth } from './auth'
import { getStoredTheme, setStoredTheme } from './storage'

const UNSET = Symbol('theme-preference-unset')

interface ThemeContextValue {
  theme: Theme
  colors: ThemeTokens
  themeId: ThemeId
  isDark: boolean
  setTheme: (id: ThemeId) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID)
  const seenPrefRef = useRef<string | symbol | null>(UNSET)

  // 1) Aplica a preferência local (SecureStore/localStorage) o quanto antes,
  //    antes de qualquer resposta da API, para evitar flash de tema errado.
  useEffect(() => {
    let active = true
    getStoredTheme().then((stored) => {
      if (active && isThemeId(stored) && stored !== themeId) {
        setThemeId(stored)
      }
    })
    return () => {
      active = false
    }
  }, [])

  // 2) Sincroniza com o banco quando o usuário carrega: o servidor é a fonte
  //    de verdade quando tem um valor salvo. Só reage a valores novos (seenPref),
  //    para não sobrescrever uma troca local com o valor antigo ainda no contexto.
  useEffect(() => {
    const pref = user?.themePreference ?? null
    if (seenPrefRef.current === pref) return
    seenPrefRef.current = pref
    if (pref && isThemeId(pref) && pref !== themeId) {
      setThemeId(pref)
    }
  }, [user?.themePreference, themeId])

  const setTheme = useCallback(
    (id: ThemeId) => {
      setThemeId(id)
      void setStoredTheme(id)
      if (user) {
        api.updateThemePreference(id).catch(() => {})
      }
    },
    [user],
  )

  const value = useMemo(() => {
    const theme = getTheme(themeId)
    return { theme, colors: theme.colors, themeId, isDark: theme.isDark, setTheme }
  }, [themeId, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de <ThemeProvider>.')
  }
  return context
}

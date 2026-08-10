import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const THEME_KEY = 'albumrate_theme_preference'

export async function getStoredTheme(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(THEME_KEY)
    } catch {
      return null
    }
  }
  return SecureStore.getItemAsync(THEME_KEY)
}

export async function setStoredTheme(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(THEME_KEY, value)
    } catch {
      // storage indisponível (modo privado): segue sem persistir
    }
    return
  }
  await SecureStore.setItemAsync(THEME_KEY, value)
}

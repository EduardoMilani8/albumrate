export type ThemeId = 'light' | 'dark' | 'midnight' | 'sepia' | 'neon'

export interface ThemeTokens {
  background: string
  surface: string
  surfaceAlt: string
  border: string
  text: string
  textMuted: string
  accent: string
  accentMuted: string
  star: string
  success: string
  spotify: string
  onSpotify: string
  scrim: string
  shadow: string
}

export interface Theme {
  id: ThemeId
  name: string
  isDark: boolean
  colors: ThemeTokens
}

export const THEME_IDS = ['light', 'dark', 'midnight', 'sepia', 'neon'] as const

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && (THEME_IDS as readonly string[]).includes(value)
}

export const themes: Theme[] = [
  {
    id: 'light',
    name: 'Claro',
    isDark: false,
    colors: {
      background: '#FAF8F4',
      surface: '#FFFFFF',
      surfaceAlt: '#F1EDE6',
      border: '#E5E1D8',
      text: '#1C1B19',
      textMuted: '#6B6862',
      accent: '#C4443C',
      accentMuted: '#F3D6D3',
      star: '#F2B705',
      success: '#4CAF6D',
      spotify: '#1DB954',
      onSpotify: '#191414',
      scrim: 'rgba(0,0,0,0.35)',
      shadow: '#000000',
    },
  },
  {
    id: 'dark',
    name: 'Escuro',
    isDark: true,
    colors: {
      background: '#17181C',
      surface: '#1F2126',
      surfaceAlt: '#26282E',
      border: '#2C2E34',
      text: '#F2F1ED',
      textMuted: '#9B9A94',
      accent: '#C4443C',
      accentMuted: '#5A2620',
      star: '#F2B705',
      success: '#4CAF6D',
      spotify: '#1DB954',
      onSpotify: '#191414',
      scrim: 'rgba(0,0,0,0.6)',
      shadow: '#000000',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    isDark: true,
    colors: {
      background: '#0B1220',
      surface: '#131C2E',
      surfaceAlt: '#1A2540',
      border: '#1F2C42',
      text: '#E8ECF5',
      textMuted: '#8C97AD',
      accent: '#E8B84B',
      accentMuted: '#5C4A24',
      star: '#F2B705',
      success: '#4CAF6D',
      spotify: '#1DB954',
      onSpotify: '#191414',
      scrim: 'rgba(0,0,0,0.6)',
      shadow: '#000000',
    },
  },
  {
    id: 'sepia',
    name: 'Vinil Sépia',
    isDark: true,
    colors: {
      background: '#2A1F18',
      surface: '#35281F',
      surfaceAlt: '#3F3026',
      border: '#4A392C',
      text: '#F2E6D8',
      textMuted: '#B8A48C',
      accent: '#C1553C',
      accentMuted: '#6E3527',
      star: '#F2B705',
      success: '#4CAF6D',
      spotify: '#1DB954',
      onSpotify: '#191414',
      scrim: 'rgba(0,0,0,0.6)',
      shadow: '#000000',
    },
  },
  {
    id: 'neon',
    name: 'Contraste Neon',
    isDark: true,
    colors: {
      background: '#0A0A0A',
      surface: '#151515',
      surfaceAlt: '#202020',
      border: '#262626',
      text: '#F5F5F5',
      textMuted: '#999999',
      accent: '#D6FF3C',
      accentMuted: '#3A3F1E',
      star: '#F2B705',
      success: '#4CAF6D',
      spotify: '#1DB954',
      onSpotify: '#191414',
      scrim: 'rgba(0,0,0,0.7)',
      shadow: '#000000',
    },
  },
]

export const DEFAULT_THEME_ID: ThemeId = 'dark'

export function getTheme(id: ThemeId | string): Theme {
  return themes.find((theme) => theme.id === id) ?? themes[0]!
}

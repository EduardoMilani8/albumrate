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
      background: '#F4F2ED',
      surface: '#EAE7E0',
      surfaceAlt: '#E2DED5',
      border: '#D6D0C5',
      text: '#201F1D',
      textMuted: '#6E675C',
      accent: '#9A6F26',
      accentMuted: '#F4E8D0',
      star: '#9A6F26',
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
      background: '#1A1816',
      surface: '#221F1C',
      surfaceAlt: '#2A2622',
      border: '#383229',
      text: '#F2ECE2',
      textMuted: '#9E968A',
      accent: '#D6A45A',
      accentMuted: '#4F4022',
      star: '#D6A45A',
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
      background: '#0E1220',
      surface: '#161C2E',
      surfaceAlt: '#1E2740',
      border: '#27324A',
      text: '#E9ECF4',
      textMuted: '#8B95AB',
      accent: '#E0B463',
      accentMuted: '#2E3120',
      star: '#E0B463',
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
      border: '#4E3C2D',
      text: '#F2E6D8',
      textMuted: '#B49B80',
      accent: '#E0A85E',
      accentMuted: '#463219',
      star: '#E0A85E',
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
      surface: '#141414',
      surfaceAlt: '#1E1E1E',
      border: '#2A2A2A',
      text: '#F5F5F5',
      textMuted: '#8E8E8E',
      accent: '#D6FF3C',
      accentMuted: '#3A3F1E',
      star: '#D6FF3C',
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

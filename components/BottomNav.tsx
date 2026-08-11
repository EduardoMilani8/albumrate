import { Ionicons } from '@expo/vector-icons'
import { router, usePathname } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { useTheme } from '../lib/theme'

type TabIcon = keyof typeof Ionicons.glyphMap

interface BottomTab {
  key: string
  label: string
  icon: TabIcon
  iconOutline: TabIcon
  route: string
}

const TABS: BottomTab[] = [
  { key: 'home', label: 'Home', icon: 'home', iconOutline: 'home-outline', route: '/' },
  { key: 'activity', label: 'Atividade', icon: 'pulse', iconOutline: 'pulse-outline', route: '/activity' },
  { key: 'search', label: 'Busca', icon: 'search', iconOutline: 'search-outline', route: '/search' },
  { key: 'collection', label: 'Coleção', icon: 'albums', iconOutline: 'albums-outline', route: '/collection' },
  { key: 'profile', label: 'Perfil', icon: 'person', iconOutline: 'person-outline', route: '/profile' },
]

export default function BottomNav() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const pathname = usePathname()
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map((tab) => {
        const active = pathname === tab.route
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => router.navigate(tab.route)}
            hitSlop={4}
          >
            <Ionicons
              name={active ? tab.icon : tab.iconOutline}
              size={22}
              color={active ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingTop: spacing.sm,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    label: {
      fontFamily: fonts.kicker,
      fontSize: 8,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.accent,
    },
  })

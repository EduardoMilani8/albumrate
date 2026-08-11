import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import type { DailyPick } from '../lib/types'
import { useTheme } from '../lib/theme'

interface DailyPickCardProps {
  pick: DailyPick | null
  loading: boolean
  picking: boolean
  onPick: () => void
  onOpenAlbum: (pick: DailyPick) => void
}

export default function DailyPickCard({
  pick,
  loading,
  picking,
  onPick,
  onOpenAlbum,
}: DailyPickCardProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="dice-outline" size={18} color={colors.accent} />
        <Text style={styles.kicker}>Álbum do dia</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : pick ? (
        <View style={styles.picked}>
          <View style={styles.albumRow}>
            <View style={styles.coverFrame}>
              <Image
                source={pick.albumArtworkUrl ?? undefined}
                style={styles.cover}
                contentFit="cover"
                transition={150}
              />
            </View>
            <View style={styles.info}>
              <Text style={styles.albumTitle} numberOfLines={1}>
                {pick.albumTitle}
              </Text>
              <Text style={styles.albumArtist} numberOfLines={1}>
                {pick.albumArtist}
              </Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.comeBack}>Já sorteado hoje — volte amanhã</Text>
            <Pressable style={styles.openButton} onPress={() => onOpenAlbum(pick)}>
              <Ionicons name="arrow-forward" size={15} color={colors.accent} />
              <Text style={styles.openButtonText}>Ver álbum</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.pickButton, picking && styles.pickButtonDisabled]}
          onPress={onPick}
          disabled={picking}
        >
          {picking ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Ionicons name="shuffle" size={18} color={colors.accent} />
          )}
          <Text style={styles.pickButtonText}>
            {picking ? 'Sorteando...' : 'Sortear álbum do dia'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.kicker,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  center: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  picked: {
    gap: spacing.md,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  coverFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 3,
  },
  cover: {
    width: 54,
    height: 54,
    backgroundColor: colors.surfaceAlt,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  albumTitle: {
    fontFamily: fonts.heading,
    color: colors.text,
    fontSize: 18,
    lineHeight: 21,
  },
  albumArtist: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  comeBack: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  openButtonText: {
    fontFamily: fonts.heading,
    color: colors.accent,
    fontSize: 14,
  },
  pickButton: {
    height: 46,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickButtonDisabled: {
    opacity: 0.7,
  },
  pickButtonText: {
    fontFamily: fonts.heading,
    color: colors.accent,
    fontSize: 15,
  },
})

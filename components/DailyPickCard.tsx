import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import type { DailyPick } from '../lib/types'

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
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="dice-outline" size={20} color={colors.accent} />
        <Text style={styles.title}>Álbum aleatório do dia</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : pick ? (
        <View style={styles.picked}>
          <View style={styles.albumRow}>
            <Image
              source={pick.albumArtworkUrl ?? undefined}
              style={styles.cover}
              contentFit="cover"
              transition={150}
            />
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
              <Ionicons name="arrow-forward" size={16} color={colors.accent} />
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
            <ActivityIndicator color={colors.background} />
          ) : (
            <Ionicons name="shuffle" size={20} color={colors.background} />
          )}
          <Text style={styles.pickButtonText}>
            {picking ? 'Sorteando...' : 'Sortear álbum do dia'}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  albumTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  albumArtist: {
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
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  pickButton: {
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pickButtonDisabled: {
    opacity: 0.7,
  },
  pickButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
})

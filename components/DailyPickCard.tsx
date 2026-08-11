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
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable
            style={styles.info}
            onPress={pick ? () => onOpenAlbum(pick) : undefined}
            disabled={!pick}
          >
            <View style={styles.coverFrame}>
              {pick ? (
                <Image
                  source={pick.albumArtworkUrl ?? undefined}
                  style={styles.cover}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Ionicons name="disc-outline" size={22} color={colors.textMuted} />
              )}
            </View>
            <View style={styles.texts}>
              <Text style={styles.kicker}>ÁLBUM DO DIA</Text>
              {pick ? (
                <>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {pick.albumTitle}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {pick.albumArtist}
                  </Text>
                </>
              ) : (
                <Text style={styles.hint} numberOfLines={2}>
                  Toque no shuffle para sortear o álbum do dia
                </Text>
              )}
            </View>
          </Pressable>

          <Pressable
            style={[styles.shuffle, pick ? styles.shuffleDisabled : styles.shuffleEnabled]}
            onPress={onPick}
            disabled={!!pick || picking}
            hitSlop={6}
          >
            {picking ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Ionicons
                name="shuffle"
                size={18}
                color={pick ? colors.textMuted : colors.accent}
              />
            )}
          </Pressable>
        </View>
      )}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.xs,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.md,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    info: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    coverFrame: {
      width: 60,
      height: 60,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cover: {
      width: 54,
      height: 54,
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    kicker: {
      fontFamily: fonts.kicker,
      color: colors.accent,
      fontSize: 9,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 2,
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
    hint: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    shuffle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shuffleEnabled: {
      borderColor: colors.accent,
      backgroundColor: colors.accentMuted,
    },
    shuffleDisabled: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      opacity: 0.6,
    },
  })

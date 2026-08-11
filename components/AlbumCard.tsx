import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import type { LoggedAlbum } from '../lib/types'
import { useTheme } from '../lib/theme'

interface AlbumCardProps {
  album: LoggedAlbum
  rating?: number | null
  onPress: () => void
}

export default function AlbumCard({ album, rating, onPress }: AlbumCardProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear().toString()
    : null

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.coverFrame}>
        <Image
          source={album.artworkUrl ?? undefined}
          style={styles.cover}
          contentFit="cover"
          transition={150}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {album.artist}
        </Text>
        <View style={styles.footer}>
          {year ? <Text style={styles.year}>{year}</Text> : null}
          {album.status === 'logged' ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text style={styles.ratingText}>{rating?.toFixed(1) ?? '—'}</Text>
            </View>
          ) : (
            <Text style={styles.wantToListen}>Quero ouvir</Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.md,
  },
  coverFrame: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 3,
  },
  cover: {
    width: 52,
    height: 52,
    backgroundColor: colors.surfaceAlt,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fonts.heading,
    color: colors.text,
    fontSize: 16,
    lineHeight: 19,
  },
  artist: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  year: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 12,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingText: {
    fontFamily: fonts.bodySemiBold,
    color: colors.star,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  wantToListen: {
    fontFamily: fonts.kicker,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})

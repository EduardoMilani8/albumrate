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
      <Text style={styles.title} numberOfLines={1}>
        {album.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {album.artist}
      </Text>
      <View style={styles.rating}>
        <Ionicons name="star" size={11} color={colors.star} />
        <Text style={styles.ratingText}>{rating?.toFixed(1) ?? '—'}</Text>
      </View>
    </Pressable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    card: {
      flex: 1,
      gap: 3,
    },
    coverFrame: {
      width: '100%',
      aspectRatio: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cover: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surfaceAlt,
    },
    title: {
      fontFamily: fonts.heading,
      color: colors.text,
      fontSize: 13,
      lineHeight: 16,
      marginTop: spacing.xs,
    },
    artist: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 14,
    },
    rating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    ratingText: {
      fontFamily: fonts.bodySemiBold,
      color: colors.star,
      fontSize: 11,
      fontVariant: ['tabular-nums'],
    },
  })

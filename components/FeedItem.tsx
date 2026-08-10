import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import type { FeedItem } from '../lib/types'
import { useTheme } from '../lib/theme'
import StarRating from './StarRating'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days}d`
  const date = new Date(iso)
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

export default function FeedItem({ item }: { item: FeedItem }) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { user } = item

  const open = () => {
    if (item.type === 'list') {
      router.push(`/list/${item.id}`)
      return
    }
    router.push({
      pathname: '/album/[id]',
      params: {
        id: item.album.albumId,
        title: item.album.title,
        artist: item.album.artist,
        artworkUrl: item.album.artworkUrl ?? '',
        fromSearch: '0',
      },
    })
  }

  return (
    <Pressable style={styles.card} onPress={open}>
      {user.avatarUrl ? (
        <Image source={user.avatarUrl} style={styles.avatar} contentFit="cover" />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Ionicons name="person" size={16} color={colors.textMuted} />
        </View>
      )}

      {item.type === 'list' ? (
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            <Text style={styles.userName}>{user.name ?? 'Alguém'}</Text> criou a lista{' '}
            <Text style={styles.strong}>{item.list.name}</Text>
          </Text>
          <Text style={styles.meta}>
            {item.list.albumCount} álbum{item.list.albumCount === 1 ? '' : 's'} ·{' '}
            {formatRelative(item.createdAt)}
          </Text>
          {item.list.coverArtworkUrl ? (
            <Image
              source={item.list.coverArtworkUrl}
              style={styles.cover}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            <Text style={styles.userName}>{user.name ?? 'Alguém'}</Text>{' '}
            {item.type === 'review' ? 'avaliou' : 'ouviu'}{' '}
            <Text style={styles.strong}>{item.album.title}</Text>
            {'\n'}
            <Text style={styles.artist}>{item.album.artist}</Text>
          </Text>
          {item.type === 'review' ? (
            <View style={styles.ratingRow}>
              <StarRating rating={item.rating} size={12} readOnly />
            </View>
          ) : null}
          {item.type === 'review' && item.reviewText ? (
            <Text style={styles.reviewText} numberOfLines={2}>
              {item.reviewText}
            </Text>
          ) : null}
          <Text style={styles.meta}>{formatRelative(item.createdAt)}</Text>
          {item.album.artworkUrl ? (
            <Image
              source={item.album.artworkUrl}
              style={styles.cover}
              contentFit="cover"
              transition={150}
            />
          ) : null}
        </View>
      )}
    </Pressable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },
  userName: {
    fontWeight: '700',
  },
  strong: {
    fontWeight: '700',
  },
  artist: {
    color: colors.textMuted,
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
})

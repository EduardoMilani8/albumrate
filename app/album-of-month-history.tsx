import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { AlbumOfMonthHistoryItem } from '../lib/types'

function formatMonthYear(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export default function AlbumOfMonthHistoryScreen() {
  const [items, setItems] = useState<AlbumOfMonthHistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let active = true
      api
        .albumOfMonthHistory()
        .then((data) => {
          if (active) setItems(data.items)
        })
        .catch((err) => {
          console.warn(err)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      return () => {
        active = false
      }
    }, []),
  )

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.pick.id}
        renderItem={({ item }) => {
          const { pick } = item
          return (
            <View style={styles.card}>
              <Pressable
                style={styles.pickRow}
                onPress={() =>
                  router.push({
                    pathname: '/album-of-month',
                    params: { id: pick.id },
                  })
                }
              >
                {pick.albumArtworkUrl ? (
                  <Image
                    source={pick.albumArtworkUrl}
                    style={styles.cover}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Ionicons name="disc-outline" size={28} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {pick.albumTitle}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {pick.albumArtist}
                  </Text>
                  <Text style={styles.month}>{formatMonthYear(pick.month, pick.year)}</Text>
                </View>
                {pick.votes != null ? (
                  <View style={styles.votesBadge}>
                    <Ionicons name="trophy" size={12} color={colors.star} />
                    <Text style={styles.votesBadgeText}>{pick.votes}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              {item.top3.length > 0 ? (
                <View style={styles.top3}>
                  {item.top3.map((result) => (
                    <Pressable
                      key={result.id}
                      style={styles.top3Row}
                      onPress={() =>
                        router.push({
                          pathname: '/album/[id]',
                          params: {
                            id: result.albumId,
                            title: result.albumTitle,
                            artist: result.albumArtist,
                            artworkUrl: result.albumArtworkUrl ?? '',
                            fromSearch: '1',
                          },
                        })
                      }
                    >
                      <View style={[styles.rankBadge, result.rank === 1 && styles.rankBadgeFirst]}>
                        <Text
                          style={[
                            styles.rankBadgeText,
                            result.rank === 1 && styles.rankBadgeTextFirst,
                          ]}
                        >
                          {result.rank}
                        </Text>
                      </View>
                      <Text style={styles.top3Title} numberOfLines={1}>
                        {result.albumTitle}
                      </Text>
                      <Text style={styles.top3Votes}>
                        {result.votes ?? 0} {result.votes === 1 ? 'voto' : 'votos'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Nenhum álbum do mês definido ainda. Assim que o primeiro for escolhido, ele aparece aqui.
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    color: colors.textMuted,
    fontSize: 13,
  },
  month: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  votesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  votesBadgeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  top3: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
  },
  top3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  rankBadgeFirst: {
    backgroundColor: colors.star,
  },
  rankBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  rankBadgeTextFirst: {
    color: colors.background,
  },
  top3Title: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  top3Votes: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
})

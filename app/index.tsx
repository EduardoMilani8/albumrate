import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import AlbumCard from '../components/AlbumCard'
import DailyPickCard from '../components/DailyPickCard'
import FeedItem from '../components/FeedItem'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { getAllAlbums } from '../lib/db'
import { useTheme } from '../lib/theme'
import type {
  AlbumOfMonth,
  DailyPick,
  FeedItem as FeedItemType,
  LoggedAlbum,
  Review,
} from '../lib/types'

type HomeTab = 'albums' | 'feed'

export default function IndexScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const db = useSQLiteContext()
  const [albums, setAlbums] = useState<LoggedAlbum[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'want_to_listen'>('all')
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null)
  const [dailyPickLoading, setDailyPickLoading] = useState(true)
  const [dailyPicking, setDailyPicking] = useState(false)
  const [albumOfMonth, setAlbumOfMonth] = useState<AlbumOfMonth | null>(null)
  const [albumOfMonthLoading, setAlbumOfMonthLoading] = useState(true)
  const [voteOpen, setVoteOpen] = useState(false)
  const [tab, setTab] = useState<HomeTab>('albums')
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedFollowingCount, setFeedFollowingCount] = useState(0)
  const [feedNextBefore, setFeedNextBefore] = useState<string | null>(null)
  const [feedNextBeforeId, setFeedNextBeforeId] = useState<string | null>(null)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      getAllAlbums(db)
        .then((rows) => {
          if (active) setAlbums(rows)
        })
        .catch((err) => {
          console.warn(err)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      api
        .myReviews()
        .then((data) => {
          if (active) setReviews(data.reviews)
        })
        .catch((err) => {
          console.warn(err)
        })
      api
        .dailyPickToday()
        .then((data) => {
          if (active) setDailyPick(data.pick)
        })
        .catch((err) => {
          console.warn(err)
        })
        .finally(() => {
          if (active) setDailyPickLoading(false)
        })
      api
        .albumOfMonth()
        .then((data) => {
          if (active) setAlbumOfMonth(data.pick)
        })
        .catch((err) => {
          console.warn(err)
        })
        .finally(() => {
          if (active) setAlbumOfMonthLoading(false)
        })
      api
        .albumOfMonthVoteState()
        .then((state) => {
          if (active) setVoteOpen(state.upcoming.status === 'open')
        })
        .catch((err) => {
          console.warn(err)
        })
      api
        .getFeed()
        .then((data) => {
          if (!active) return
          setFeedItems(data.items)
          setFeedFollowingCount(data.followingCount)
          setFeedNextBefore(data.nextBefore)
          setFeedNextBeforeId(data.nextBeforeId)
        })
        .catch((err) => {
          console.warn(err)
        })
        .finally(() => {
          if (active) setFeedLoading(false)
        })
      return () => {
        active = false
      }
    }, [db]),
  )

  const loadMoreFeed = async () => {
    if (feedLoadingMore || !feedNextBefore || !feedNextBeforeId) return
    setFeedLoadingMore(true)
    try {
      const data = await api.getFeed(feedNextBefore, feedNextBeforeId)
      setFeedItems((current) => [...current, ...data.items])
      setFeedNextBefore(data.nextBefore)
      setFeedNextBeforeId(data.nextBeforeId)
    } catch (err) {
      console.warn(err)
    } finally {
      setFeedLoadingMore(false)
    }
  }

  const logged = albums.filter((album) => album.status === 'logged')
  const visibleAlbums =
    filter === 'want_to_listen'
      ? albums.filter((album) => album.status === 'want_to_listen')
      : albums
  const average =
    reviews.length === 0
      ? null
      : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

  const handleDailyPick = async () => {
    if (dailyPicking) return
    setDailyPicking(true)
    try {
      const data = await api.dailyPick()
      setDailyPick(data.pick)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível sortear um álbum.')
    } finally {
      setDailyPicking(false)
    }
  }

  const openDailyPickAlbum = (pick: DailyPick) => {
    router.push({
      pathname: '/album/[id]',
      params: {
        id: pick.albumId,
        title: pick.albumTitle,
        artist: pick.albumArtist,
        artworkUrl: pick.albumArtworkUrl ?? '',
        fromSearch: '1',
      },
    })
  }

  const renderFeed = () => {
    if (feedLoading) {
      return <ActivityIndicator color={colors.accent} style={styles.loading} />
    }
    return (
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.type}:${item.id}`}
        renderItem={({ item }) => <FeedItem item={item} />}
        onEndReached={loadMoreFeed}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          feedLoadingMore ? (
            <ActivityIndicator color={colors.accent} style={styles.feedFooter} />
          ) : null
        }
        contentContainerStyle={styles.feedList}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              {feedFollowingCount === 0
                ? 'Você ainda não segue ninguém. Busque pessoas para ver as atividades delas aqui.'
                : 'Nenhuma atividade recente de quem você segue.'}
            </Text>
            {feedFollowingCount === 0 ? (
              <Pressable style={styles.emptyButton} onPress={() => router.push('/search')}>
                <Text style={styles.emptyButtonText}>Buscar pessoas</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{logged.length}</Text>
          <Text style={styles.statLabel}>Álbuns</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{average !== null ? average.toFixed(1) : '—'}</Text>
          <Text style={styles.statLabel}>Nota média</Text>
        </View>
      </View>

      <DailyPickCard
        pick={dailyPick}
        loading={dailyPickLoading}
        picking={dailyPicking}
        onPick={handleDailyPick}
        onOpenAlbum={openDailyPickAlbum}
      />

      <Pressable
        style={styles.albumOfMonthCard}
        onPress={() => router.push('/album-of-month')}
      >
        <View style={styles.albumOfMonthIcon}>
          <Ionicons name="calendar" size={20} color={colors.accent} />
        </View>
        <View style={styles.albumOfMonthInfo}>
          <View style={styles.albumOfMonthTitleRow}>
            <Text style={styles.albumOfMonthTitle}>Álbum do mês</Text>
            {voteOpen ? (
              <View style={styles.voteBadge}>
                <Text style={styles.voteBadgeText}>Votação aberta</Text>
              </View>
            ) : null}
          </View>
          {albumOfMonthLoading ? null : albumOfMonth ? (
            <Text style={styles.albumOfMonthSubtitle} numberOfLines={1}>
              {albumOfMonth.albumTitle} — {albumOfMonth.albumArtist}
            </Text>
          ) : (
            <Text style={styles.albumOfMonthSubtitle} numberOfLines={1}>
              Nenhum álbum definido para este mês ainda.
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>

      <View style={styles.segmented}>
        {(['albums', 'feed'] as const).map((key) => {
          const active = tab === key
          return (
            <Pressable
              key={key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setTab(key)}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {key === 'albums' ? 'Meus Álbuns' : 'Atividade'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {tab === 'feed' ? (
        renderFeed()
      ) : (
        <>
          <View style={styles.segmented}>
            {(['all', 'want_to_listen'] as const).map((key) => {
              const active = filter === key
              return (
                <Pressable
                  key={key}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setFilter(key)}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {key === 'all' ? 'Todos' : 'Quero ouvir'}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <FlatList
              data={visibleAlbums}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const myRating = reviews.find((review) => review.albumId === item.id)?.rating ?? null
                return (
                  <AlbumCard
                    album={item}
                    rating={myRating}
                    onPress={() => router.push(`/album/${item.id}`)}
                  />
                )
              }}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="disc-outline" size={56} color={colors.textMuted} />
                  <Text style={styles.emptyText}>
                    {filter === 'want_to_listen'
                      ? 'Nenhum álbum marcado como quero ouvir ainda.'
                      : 'Nenhum álbum por aqui ainda. Toque no + para buscar e avaliar.'}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}

      {tab === 'albums' ? (
        <Pressable style={styles.fab} onPress={() => router.push('/search')}>
          <Ionicons name="add" size={28} color={colors.background} />
        </Pressable>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  albumOfMonthCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  albumOfMonthIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumOfMonthInfo: {
    flex: 1,
    gap: 2,
  },
  albumOfMonthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  albumOfMonthTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  voteBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
  },
  voteBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  albumOfMonthSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: 4,
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accentMuted,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  feedList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  feedFooter: {
    paddingVertical: spacing.md,
  },
  loading: {
    flex: 1,
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
  emptyButton: {
    height: 44,
    borderRadius: 500,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
})

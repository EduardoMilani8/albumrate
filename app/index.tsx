import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AlbumCard from '../components/AlbumCard'
import BottomNav from '../components/BottomNav'
import DailyPickCard from '../components/DailyPickCard'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { getAllAlbums } from '../lib/db'
import { useTheme } from '../lib/theme'
import type {
  AlbumOfMonth,
  AlbumOfMonthVoteStateResponse,
  DailyPick,
  LoggedAlbum,
  Review,
} from '../lib/types'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ''
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
}

export default function IndexScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const db = useSQLiteContext()
  const [albums, setAlbums] = useState<LoggedAlbum[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null)
  const [dailyPickLoading, setDailyPickLoading] = useState(true)
  const [dailyPicking, setDailyPicking] = useState(false)
  const [albumOfMonth, setAlbumOfMonth] = useState<AlbumOfMonth | null>(null)
  const [albumOfMonthLoading, setAlbumOfMonthLoading] = useState(true)
  const [voteState, setVoteState] = useState<AlbumOfMonthVoteStateResponse | null>(null)

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
          if (active) setVoteState(state)
        })
        .catch((err) => {
          console.warn(err)
        })
      return () => {
        active = false
      }
    }, [db]),
  )

  const loggedAlbums = useMemo(
    () => albums.filter((album) => album.status === 'logged'),
    [albums],
  )
  const average =
    reviews.length === 0
      ? null
      : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

  const voteOpen = voteState?.upcoming.status === 'open'
  const candidatesCount = voteState?.upcoming.candidates?.length ?? 0
  const daysLabel = voteState
    ? (() => {
        const days = daysUntil(voteState.upcoming.closesAt)
        if (days === 0) return 'ÚLTIMO DIA'
        if (days === 1) return '1 DIA'
        return `${days} DIAS`
      })()
    : null

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

  const renderAlbumOfMonth = () => {
    if (voteOpen && voteState) {
      return (
        <Pressable style={styles.aomCard} onPress={() => router.push('/album-of-month')}>
          <View style={styles.aomBody}>
            <View style={styles.aomTopRow}>
              <View style={styles.votePill}>
                <Text style={styles.votePillText}>Votação aberta</Text>
              </View>
              {daysLabel ? <Text style={styles.daysText}>{daysLabel}</Text> : null}
            </View>
            <Text style={styles.aomTitle}>
              Álbum do Mês · {monthName(voteState.upcoming.targetMonth)}
            </Text>
            <Text style={styles.aomSubtitle}>
              {candidatesCount > 0
                ? `Escolha 3 entre ${candidatesCount} indicados`
                : 'Nenhum indicado ainda'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )
    }

    return (
      <Pressable style={styles.aomCard} onPress={() => router.push('/album-of-month')}>
        <View style={styles.aomBody}>
          <Text style={styles.aomKicker}>Álbum do mês</Text>
          {albumOfMonthLoading ? null : albumOfMonth ? (
            <>
              <Text style={styles.aomTitle} numberOfLines={1}>
                {albumOfMonth.albumTitle}
              </Text>
              <Text style={styles.aomArtist} numberOfLines={1}>
                {albumOfMonth.albumArtist} · {monthName(albumOfMonth.month)}
              </Text>
            </>
          ) : (
            <Text style={styles.aomSubtitle}>Participe da próxima votação</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    )
  }

  const listHeader = (
    <View>
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statKicker}>Álbuns avaliados</Text>
          <Text style={styles.statValue}>{loggedAlbums.length}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statKicker}>Nota média</Text>
          <View style={styles.statValueRow}>
            <Text style={[styles.statValue, styles.statValueAccent]}>
              {average !== null ? average.toFixed(1) : '—'}
            </Text>
            {average !== null ? <Ionicons name="star" size={14} color={colors.accent} /> : null}
          </View>
        </View>
      </View>

      <DailyPickCard
        pick={dailyPick}
        loading={dailyPickLoading}
        picking={dailyPicking}
        onPick={handleDailyPick}
        onOpenAlbum={openDailyPickAlbum}
      />

      {renderAlbumOfMonth()}
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.logo}>albumrate.</Text>
        <View style={styles.headerIcons}>
          <Pressable hitSlop={8} style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={loggedAlbums}
        keyExtractor={(item) => item.id}
        numColumns={3}
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
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.list}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="disc-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Nenhum álbum avaliado ainda. Toque na aba Busca para encontrar álbuns.
              </Text>
            </View>
          )
        }
      />

      <BottomNav />
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    logo: {
      fontFamily: fonts.heading,
      fontSize: 28,
      color: colors.accent,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    headerIcon: {
      padding: spacing.xs,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statKicker: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: 6,
    },
    statValue: {
      fontFamily: fonts.headingRegular,
      fontSize: 32,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    statValueAccent: {
      color: colors.accent,
    },
    statValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statDivider: {
      width: 1,
      alignSelf: 'stretch',
      marginVertical: 8,
      backgroundColor: colors.border,
    },
    aomCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.md,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.xs,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    aomBody: {
      flex: 1,
      gap: 3,
    },
    aomTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 3,
    },
    votePill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 500,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    votePillText: {
      fontFamily: fonts.kicker,
      color: colors.accent,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    daysText: {
      fontFamily: fonts.kicker,
      color: colors.accent,
      fontSize: 9,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    aomKicker: {
      fontFamily: fonts.kicker,
      color: colors.accent,
      fontSize: 9,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    aomTitle: {
      fontFamily: fonts.heading,
      color: colors.text,
      fontSize: 18,
      lineHeight: 21,
    },
    aomSubtitle: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 13,
    },
    aomArtist: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 13,
    },
    list: {
      padding: spacing.md,
      paddingBottom: 104,
    },
    gridRow: {
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    loading: {
      paddingVertical: spacing.xl * 2,
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

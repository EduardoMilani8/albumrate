import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import StarRating from '../components/StarRating'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { Review } from '../lib/types'

const MONTHS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const MONTHS_LONG = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function dayOf(listenedAt: string): string {
  return listenedAt.slice(8, 10)
}

function monthShortOf(listenedAt: string): string {
  const month = Number(listenedAt.slice(5, 7))
  return MONTHS_SHORT[month - 1] ?? ''
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  const label = MONTHS_LONG[month - 1] ?? yearMonth
  return `${label.toUpperCase()} DE ${year}`
}

function formatListenedAt(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function DiaryScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [months, setMonths] = useState<{ yearMonth: string; reviews: Review[] }[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [latestYear, setLatestYear] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [menuReview, setMenuReview] = useState<Review | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      api
        .monthlyReviews()
        .then((data) => {
          if (!active) return
          setMonths(data.months)
          setNextBefore(data.nextBefore)
          setTotal(data.total)
          setLatestYear(data.latestYear)
        })
        .catch((err) => {
          if (active) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar o diário.')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      return () => {
        active = false
      }
    }, []),
  )

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await api.monthlyReviews(nextBefore)
      setMonths((current) => [...current, ...data.months])
      setNextBefore(data.nextBefore)
      setTotal(data.total)
      setLatestYear(data.latestYear)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar mais.')
    } finally {
      setLoadingMore(false)
    }
  }

  const openAlbum = (review: Review) => {
    router.push({
      pathname: '/album/[id]',
      params: {
        id: review.albumId,
        title: review.albumTitle,
        artist: review.albumArtist,
        artworkUrl: review.albumArtworkUrl ?? '',
        fromSearch: '0',
      },
    })
  }

  const handleDelete = (review: Review) => {
    Alert.alert(
      'Remover registro',
      `Remover "${review.albumTitle}" de ${formatListenedAt(review.listenedAt)} do diário?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteReview(review.albumId)
              setMonths((current) =>
                current
                  .map((month) => ({
                    ...month,
                    reviews: month.reviews.filter((item) => item.id !== review.id),
                  }))
                  .filter((month) => month.reviews.length > 0),
              )
              setTotal((current) => Math.max(0, current - 1))
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível remover.')
            }
          },
        },
      ],
    )
  }

  const sections = months.map((month) => ({ title: month.yearMonth, data: month.reviews }))

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <View>
              <Text style={styles.headerKicker}>
                {latestYear ? `${latestYear} · ` : ''}
                {total} REGISTRO{total === 1 ? '' : 'S'}
              </Text>
              <Text style={styles.headerTitle}>Diário</Text>
            </View>
          </View>
          <Ionicons name="options-outline" size={20} color={colors.textMuted} style={styles.headerIcon} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.center} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable style={styles.rowMain} onPress={() => openAlbum(item)}>
                <View style={styles.dateBlock}>
                  <Text style={styles.day}>{dayOf(item.listenedAt)}</Text>
                  <Text style={styles.month}>{monthShortOf(item.listenedAt)}</Text>
                </View>
                <View style={styles.coverFrame}>
                  <Image
                    source={item.albumArtworkUrl ?? undefined}
                    style={styles.cover}
                    contentFit="cover"
                    transition={150}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {item.albumTitle}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {item.albumArtist}
                  </Text>
                  <StarRating rating={item.rating} size={12} readOnly />
                </View>
              </Pressable>
              <View style={styles.rowActions}>
                {item.reviewText ? (
                  <MaterialCommunityIcons
                    name="format-quote-open"
                    size={14}
                    color={colors.accent}
                  />
                ) : null}
                <Pressable onPress={() => setMenuReview(item)} hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{formatMonthLabel(section.title)}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Nada por aqui ainda. Avalie um álbum para começar seu diário.
              </Text>
            </View>
          }
          ListFooterComponent={
            nextBefore ? (
              <Pressable style={styles.loadMoreButton} onPress={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.loadMoreText}>Carregar mais</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}

      <Modal
        visible={!!menuReview}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuReview(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => setMenuReview(null)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {menuReview?.albumTitle}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {menuReview ? `${menuReview.albumArtist} · ${formatListenedAt(menuReview.listenedAt)}` : ''}
            </Text>
            <Pressable
              style={styles.sheetAction}
              onPress={() => {
                const review = menuReview
                setMenuReview(null)
                if (review) handleDelete(review)
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.accent} />
              <Text style={[styles.sheetActionText, { color: colors.accent }]}>Excluir registro</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setMenuReview(null)}>
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    headerKicker: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1.6,
      color: colors.textMuted,
    },
    headerTitle: {
      fontFamily: fonts.headingRegular,
      fontSize: 32,
      lineHeight: 32,
      color: colors.text,
      marginTop: 6,
    },
    headerIcon: {
      marginBottom: 4,
    },
    list: {
      paddingHorizontal: spacing.lg,
    },
    sectionHeader: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1.6,
      color: colors.textMuted,
      textTransform: 'uppercase',
      paddingTop: spacing.lg,
      paddingBottom: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    dateBlock: {
      width: 34,
      alignItems: 'center',
    },
    day: {
      fontFamily: fonts.headingRegular,
      fontSize: 24,
      lineHeight: 24,
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    month: {
      fontFamily: fonts.kicker,
      fontSize: 8,
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginTop: 3,
    },
    coverFrame: {
      width: 48,
      height: 48,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cover: {
      width: 46,
      height: 46,
      borderWidth: 4,
      borderColor: colors.surface,
      backgroundColor: colors.surfaceAlt,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    albumTitle: {
      fontFamily: fonts.heading,
      fontSize: 16,
      lineHeight: 19,
      color: colors.text,
    },
    albumArtist: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      lineHeight: 15,
      color: colors.textMuted,
      marginTop: 2,
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    loadMoreButton: {
      alignSelf: 'stretch',
      height: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.lg,
    },
    loadMoreText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
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
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    scrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
      marginBottom: spacing.md,
    },
    sheetTitle: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.text,
    },
    sheetSubtitle: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.textMuted,
      marginTop: 3,
    },
    sheetAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sheetActionText: {
      fontSize: 15,
      fontWeight: '600',
    },
    sheetCancel: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    sheetCancelText: {
      color: colors.textMuted,
      fontSize: 15,
    },
  })

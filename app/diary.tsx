import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { ListeningLog, ListeningLogMonth } from '../lib/types'

function formatListenedAt(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  if (!year || !month) return yearMonth
  const label = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function DiaryScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [months, setMonths] = useState<ListeningLogMonth[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      api
        .myListeningLogs()
        .then((data) => {
          if (!active) return
          setMonths(data.months)
          setNextBefore(data.nextBefore)
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
      const data = await api.myListeningLogs(nextBefore)
      setMonths((current) => [...current, ...data.months])
      setNextBefore(data.nextBefore)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar mais.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleDelete = (log: ListeningLog) => {
    Alert.alert(
      'Remover registro',
      `Remover "${log.albumTitle}" de ${formatListenedAt(log.listenedAt)} do diário?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteListeningLog(log.id)
              setMonths((current) =>
                current
                  .map((month) => ({
                    ...month,
                    logs: month.logs.filter((item) => item.id !== log.id),
                  }))
                  .filter((month) => month.logs.length > 0),
              )
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível remover.')
            }
          },
        },
      ],
    )
  }

  const sections = months.map((month) => ({ title: month.yearMonth, data: month.logs }))

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.center} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Pressable
                style={styles.rowMain}
                onPress={() =>
                  router.push({
                    pathname: '/album/[id]',
                    params: {
                      id: item.albumId,
                      title: item.albumTitle,
                      artist: item.albumArtist,
                      artworkUrl: item.albumArtworkUrl ?? '',
                      fromSearch: '0',
                    },
                  })
                }
              >
                <Image
                  source={item.albumArtworkUrl ?? undefined}
                  style={styles.cover}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.info}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {item.albumTitle}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {item.albumArtist}
                  </Text>
                  <Text style={styles.listenedAt}>
                    {formatListenedAt(item.listenedAt)}
                  </Text>
                </View>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.accent} />
              </Pressable>
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{formatMonth(section.title)}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Nada por aqui ainda. Marque um álbum como ouvido para começar seu diário.
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
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  info: {
    flex: 1,
    gap: 2,
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
  listenedAt: {
    color: colors.textMuted,
    fontSize: 12,
  },
  deleteButton: {
    padding: spacing.sm,
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
    marginTop: spacing.sm,
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
})

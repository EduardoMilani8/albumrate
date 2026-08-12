import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BottomNav from '../components/BottomNav'
import FeedItem from '../components/FeedItem'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { FeedItem as FeedItemType } from '../lib/types'

export default function ActivityScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [feedItems, setFeedItems] = useState<FeedItemType[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedFollowingCount, setFeedFollowingCount] = useState(0)
  const [feedNextBefore, setFeedNextBefore] = useState<string | null>(null)
  const [feedNextBeforeId, setFeedNextBeforeId] = useState<string | null>(null)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setFeedLoading(true)
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
    }, []),
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Atividade</Text>
        </View>
      </View>

      {feedLoading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
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
      )}
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
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    headerTitle: {
      fontFamily: fonts.headingRegular,
      fontSize: 32,
      lineHeight: 32,
      color: colors.text,
    },
    feedList: {
      padding: spacing.md,
      paddingBottom: 96,
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
      borderRadius: radius.xs,
      paddingHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyButtonText: {
      fontFamily: fonts.heading,
      color: colors.accent,
      fontSize: 15,
    },
  })

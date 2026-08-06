import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import AlbumCard from '../components/AlbumCard'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import { getAllAlbums } from '../lib/db'
import type { LoggedAlbum, Review } from '../lib/types'

export default function IndexScreen() {
  const db = useSQLiteContext()
  const [albums, setAlbums] = useState<LoggedAlbum[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

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
      return () => {
        active = false
      }
    }, [db]),
  )

  const logged = albums.filter((album) => album.status === 'logged')
  const average =
    reviews.length === 0
      ? null
      : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

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

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={albums}
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
                Nenhum álbum por aqui ainda. Toque no + para buscar e avaliar.
              </Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/search')}>
        <Ionicons name="add" size={28} color={colors.background} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
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
  list: {
    padding: spacing.md,
    gap: spacing.sm,
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
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
})

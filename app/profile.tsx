import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import StarRating from '../components/StarRating'
import DiversityChart from '../components/DiversityChart'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { DiversityScoreResponse, Review } from '../lib/types'

function formatListenedAt(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [diversity, setDiversity] = useState<DiversityScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let active = true
      api
        .myReviews()
        .then((data) => {
          if (active) setReviews(data.reviews)
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      if (user?.id) {
        api
          .diversityScore(user.id)
          .then((data) => {
            if (active) setDiversity(data)
          })
          .catch((err) => {
            console.warn(err)
          })
      }
      return () => {
        active = false
      }
    }, [user?.id]),
  )

  const handleDelete = (review: Review) => {
    Alert.alert('Remover avaliação', `Excluir sua avaliação de "${review.albumTitle}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteReview(review.albumId)
            setReviews((current) => current.filter((item) => item.id !== review.id))
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível remover.')
          }
        },
      },
    ])
  }

  const handleLogout = () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/login')
        },
      },
    ])
  }

  const average =
    reviews.length === 0
      ? null
      : reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color={colors.text} />
        </View>
        <Text style={styles.name}>{user?.name ?? 'Sem nome'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{reviews.length}</Text>
            <Text style={styles.statLabel}>Avaliações</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{average !== null ? average.toFixed(1) : '—'}</Text>
            <Text style={styles.statLabel}>Sua média</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {diversity ? (
                <DiversityChart
                  score={diversity.score}
                  totalAlbums={diversity.totalAlbums}
                  genreDistribution={diversity.genreDistribution}
                  decadeDistribution={diversity.decadeDistribution}
                  countryDistribution={diversity.countryDistribution}
                />
              ) : null}

              <Pressable style={styles.diaryButton} onPress={() => router.push('/lists')}>
                <Ionicons name="list-outline" size={18} color={colors.text} />
                <Text style={styles.diaryButtonText}>Minhas listas</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              <Pressable style={styles.diaryButton} onPress={() => router.push('/diary')}>
                <Ionicons name="book-outline" size={18} color={colors.text} />
                <Text style={styles.diaryButtonText}>Meu diário</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.reviewCard}>
              <Pressable
                style={styles.reviewMain}
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
                <View style={styles.reviewInfo}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {item.albumTitle}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {item.albumArtist}
                  </Text>
                  <View style={styles.reviewFooter}>
                    <StarRating rating={item.rating} size={13} readOnly />
                    <Text style={styles.listenedAt}>Ouvido em {formatListenedAt(item.listenedAt)}</Text>
                  </View>
                  {item.reviewText ? (
                    <Text style={styles.reviewText} numberOfLines={2}>
                      {item.reviewText}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => handleDelete(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.accent} />
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>Você ainda não avaliou nenhum álbum.</Text>
            </View>
          }
        />
      )}

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color={colors.accent} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  email: {
    color: colors.textMuted,
    fontSize: 14,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: spacing.lg,
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
  loading: {
    flex: 1,
  },
  diaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  diaryButtonText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  listHeader: {
    gap: spacing.sm,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  reviewMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  reviewInfo: {
    flex: 1,
    gap: spacing.xs,
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
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  listenedAt: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reviewText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  deleteButton: {
    padding: spacing.sm,
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
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    margin: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
})

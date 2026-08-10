import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import StarRating from '../components/StarRating'
import DiversityChart from '../components/DiversityChart'
import WorldMap from '../components/WorldMap'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useTheme } from '../lib/theme'
import type { DiversityScoreResponse, Review } from '../lib/types'
import { useSpotifySignIn } from '../lib/useSpotifySignIn'

function formatListenedAt(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function ProfileScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const { user, signOut, disconnectSpotify, refreshUser } = useAuth()
  const { run: runSpotifySignIn } = useSpotifySignIn()
  const [reviews, setReviews] = useState<Review[]>([])
  const [diversity, setDiversity] = useState<DiversityScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [countryBackfillPending, setCountryBackfillPending] = useState(false)
  const [followCounts, setFollowCounts] = useState<{
    followers: number
    following: number
    collection: number
  } | null>(null)
  const backfillRunningRef = useRef(false)

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
        void (async () => {
          try {
            const profile = await api.getUserProfile(user.id)
            if (active) setFollowCounts(profile.user.counts)
          } catch (err) {
            console.warn(err)
          }
        })()
        void (async () => {
          try {
            const data = await api.diversityScore(user.id)
            if (!active) return
            setDiversity(data)
            // Se ainda há álbuns sem país de origem, resolve em background
            // (cache + MusicBrainz) e atualiza o mapa. O cache evita repetir
            // consultas ao MusicBrainz em acessos seguintes.
            const incomplete = data.albumsWithMetadata.country < data.totalAlbums
            if (incomplete && !backfillRunningRef.current) {
              backfillRunningRef.current = true
              setCountryBackfillPending(true)
              try {
                await api.backfillCountries()
                if (active) {
                  const updated = await api.diversityScore(user.id)
                  if (active) setDiversity(updated)
                }
              } catch (err) {
                console.warn(err)
              } finally {
                backfillRunningRef.current = false
                setCountryBackfillPending(false)
              }
            }
          } catch (err) {
            console.warn(err)
          }
        })()
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

  const handleSpotifyConnect = async () => {
    setSpotifyLoading(true)
    try {
      const ok = await runSpotifySignIn()
      if (ok) await refreshUser()
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível conectar.')
    } finally {
      setSpotifyLoading(false)
    }
  }

  const handleSpotifyDisconnect = () => {
    Alert.alert('Desconectar Spotify', 'Sua conta do Spotify será desvinculada deste perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          try {
            await disconnectSpotify()
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível desconectar.')
          }
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
          {user?.avatarUrl ? (
            <Image source={user.avatarUrl} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Ionicons name="person" size={28} color={colors.text} />
          )}
        </View>
        <Text style={styles.name}>{user?.name ?? 'Sem nome'}</Text>
        {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

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
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followCounts?.followers ?? '—'}</Text>
            <Text style={styles.statLabel}>Seguidores</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{followCounts?.following ?? '—'}</Text>
            <Text style={styles.statLabel}>Seguindo</Text>
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
                <>
                  <DiversityChart
                    score={diversity.score}
                    totalAlbums={diversity.totalAlbums}
                    genreDistribution={diversity.genreDistribution}
                    decadeDistribution={diversity.decadeDistribution}
                    countryDistribution={diversity.countryDistribution}
                  />
                  {diversity.totalAlbums > 0 ? (
                    <WorldMap
                      distribution={diversity.countryDistribution}
                      pending={countryBackfillPending}
                    />
                  ) : null}
                </>
              ) : null}

              {user && user.favoriteGenres.length > 0 ? (
                <View style={styles.genresCard}>
                  <Text style={styles.genresTitle}>Gêneros favoritos</Text>
                  <View style={styles.genresChips}>
                    {user.favoriteGenres.map((genre) => (
                      <View key={genre} style={styles.genreChip}>
                        <Text style={styles.genreChipText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.spotifyCard}>
                <View style={styles.spotifyHeader}>
                  <FontAwesome5 name="spotify" size={22} color={colors.spotify} />
                  <View style={styles.spotifyInfo}>
                    <Text style={styles.spotifyTitle}>Spotify</Text>
                    <Text style={styles.spotifyStatus}>
                      {user?.spotifyConnected ? 'Conectado' : 'Não conectado'}
                    </Text>
                  </View>
                </View>
                {user?.spotifyConnected ? (
                  <View style={styles.spotifyActions}>
                    <Pressable
                      style={styles.spotifyAction}
                      onPress={handleSpotifyConnect}
                      disabled={spotifyLoading}
                    >
                      <Text style={styles.spotifyActionText}>
                        {spotifyLoading ? 'Conectando…' : 'Reconectar'}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.spotifyAction} onPress={handleSpotifyDisconnect}>
                      <Text style={styles.spotifyActionDanger}>Desconectar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.spotifyConnectButton}
                    onPress={handleSpotifyConnect}
                    disabled={spotifyLoading}
                  >
                    <FontAwesome5 name="spotify" size={18} color={colors.onSpotify} />
                    <Text style={styles.spotifyConnectText}>
                      {spotifyLoading ? 'Conectando…' : 'Conectar Spotify'}
                    </Text>
                  </Pressable>
                )}
              </View>

              <Pressable style={styles.diaryButton} onPress={() => router.push('/collection')}>
                <Ionicons name="albums-outline" size={18} color={colors.text} />
                <Text style={styles.diaryButtonText}>Minha coleção</Text>
                {followCounts ? (
                  <Text style={styles.collectionCount}>{followCounts.collection}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

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

              <Pressable style={styles.diaryButton} onPress={() => router.push('/appearance')}>
                <Ionicons name="color-palette-outline" size={18} color={colors.text} />
                <Text style={styles.diaryButtonText}>Aparência</Text>
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

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
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
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
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
  genresCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  genresTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  genresChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  genreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 500,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreChipText: {
    color: colors.text,
    fontSize: 13,
  },
  spotifyCard: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  spotifyInfo: {
    flex: 1,
  },
  spotifyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  spotifyStatus: {
    color: colors.textMuted,
    fontSize: 13,
  },
  spotifyActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  spotifyAction: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyActionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  spotifyActionDanger: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  spotifyConnectButton: {
    height: 44,
    borderRadius: 500,
    backgroundColor: colors.spotify,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  spotifyConnectText: {
    color: colors.onSpotify,
    fontSize: 15,
    fontWeight: '700',
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
  collectionCount: {
    color: colors.textMuted,
    fontSize: 14,
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

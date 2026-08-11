import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import StarRating from '../components/StarRating'
import DiversityChart from '../components/DiversityChart'
import WorldMap from '../components/WorldMap'
import BottomNav from '../components/BottomNav'
import { fonts, radius, spacing } from '../constants/theme'
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

function openAlbum(review: Review) {
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

export default function ProfileScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const insets = useSafeAreaInsets()
  const { user, signOut, disconnectSpotify, refreshUser } = useAuth()
  const { run: runSpotifySignIn } = useSpotifySignIn()
  const [reviews, setReviews] = useState<Review[]>([])
  const [diversity, setDiversity] = useState<DiversityScoreResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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

  const countriesCount = diversity?.countryDistribution.length ?? 0
  const handle = user?.name
    ? `@${user.name.trim().split(/\s+/)[0]?.toUpperCase() ?? 'USUÁRIO'}`
    : '@USUÁRIO'

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={undefined}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.header}>
                <View style={styles.avatar}>
                  {user?.avatarUrl ? (
                    <Image source={user.avatarUrl} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <Text style={styles.avatarInitial}>{(user?.name?.[0] ?? '?').toUpperCase()}</Text>
                  )}
                </View>

                <View style={styles.headerInfo}>
                  <Text style={styles.name} numberOfLines={2}>
                    {user?.name ?? 'Sem nome'}
                  </Text>
                  <Text style={styles.handle} numberOfLines={1}>
                    {handle}
                    {user?.country ? ` · ${user.country}` : ''}
                  </Text>
                </View>

                <View style={styles.headerIcons}>
                  <Pressable hitSlop={8} onPress={() => router.push('/diary')}>
                    <Ionicons name="book-outline" size={22} color={colors.text} />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => router.push('/lists')}>
                    <Ionicons name="list-outline" size={22} color={colors.text} />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => setSettingsOpen(true)}>
                    <Ionicons name="settings-outline" size={22} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{reviews.length}</Text>
                  <Text style={styles.statLabel}>Avaliações</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{followCounts?.collection ?? '—'}</Text>
                  <Text style={styles.statLabel}>Coleção</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{followCounts?.followers ?? '—'}</Text>
                  <Text style={styles.statLabel}>Seguidores</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{followCounts?.following ?? '—'}</Text>
                  <Text style={styles.statLabel}>Seguindo</Text>
                </View>
              </View>

              {diversity ? (
                <>
                  <DiversityChart
                    score={diversity.score}
                    genreDistribution={diversity.genreDistribution}
                  />

                  {diversity.totalAlbums > 0 ? (
                    <View style={styles.mapSection}>
                      <Text style={styles.sectionLabel}>
                        Origem dos artistas ouvidos · {countriesCount}{' '}
                        {countriesCount === 1 ? 'país' : 'países'}
                      </Text>
                      <WorldMap
                        distribution={diversity.countryDistribution}
                        pending={countryBackfillPending}
                      />
                    </View>
                  ) : null}
                </>
              ) : null}
              {user && user.favoriteGenres.length > 0 ? (
                <View style={styles.genresSection}>
                  <Text style={styles.sectionLabel}>Gêneros favoritos</Text>
                  <View style={styles.genresChips}>
                    {user.favoriteGenres.map((genre) => (
                      <View key={genre} style={styles.genreChip}>
                        <Text style={styles.genreChipText}>{genre}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          }
          contentContainerStyle={styles.list}
          ListFooterComponent={
            reviews.length > 0 ? (
              <View style={styles.coversSection}>
                <Text style={styles.sectionLabel}>Últimas avaliações</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.coversRow}
                >
                  {reviews.slice(0, 10).map((review) => (
                    <Pressable key={review.id} onPress={() => openAlbum(review)}>
                      <Image
                        source={review.albumArtworkUrl ?? undefined}
                        style={styles.coverThumb}
                        contentFit="cover"
                        transition={150}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="star-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>Você ainda não avaliou nenhum álbum.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={settingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} />
          <View
            style={[styles.settingsSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          >
            <Text style={styles.settingsTitle}>Ajustes</Text>

            <Pressable
              style={styles.settingsRow}
              onPress={handleSpotifyConnect}
              disabled={spotifyLoading}
            >
              <FontAwesome5 name="spotify" size={20} color={colors.spotify} />
              <View style={styles.settingsBody}>
                <Text style={styles.settingsRowTitle}>Spotify</Text>
                <Text style={styles.settingsRowSubtitle}>
                  {user?.spotifyConnected ? 'Conectado' : 'Não conectado'}
                </Text>
              </View>
              <Text style={styles.settingsAction}>
                {spotifyLoading ? '…' : user?.spotifyConnected ? 'Reconectar' : 'Conectar'}
              </Text>
            </Pressable>

            {user?.spotifyConnected ? (
              <Pressable style={styles.settingsRow} onPress={handleSpotifyDisconnect}>
                <Ionicons name="link-outline" size={20} color={colors.accent} />
                <View style={styles.settingsBody}>
                  <Text style={styles.settingsRowTitle}>Desconectar Spotify</Text>
                  <Text style={styles.settingsRowSubtitle}>
                    Desvincula sua conta do Spotify
                  </Text>
                </View>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.settingsRow}
              onPress={() => {
                setSettingsOpen(false)
                handleLogout()
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.accent} />
              <View style={styles.settingsBody}>
                <Text style={styles.settingsRowTitle}>Sair da conta</Text>
                <Text style={styles.settingsRowSubtitle}>Encerrar sessão atual</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
      </Modal>

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
      gap: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    avatar: {
      width: 66,
      height: 66,
      borderRadius: 33,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    avatarInitial: {
      fontFamily: fonts.heading,
      fontSize: 28,
      color: colors.accent,
    },
    headerInfo: {
      flex: 1,
      gap: spacing.sm,
    },
    name: {
      fontFamily: fonts.heading,
      fontSize: 28,
      color: colors.text,
    },
    handle: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    headerIcons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.lg,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    statValue: {
      fontFamily: fonts.headingRegular,
      fontSize: 24,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    sectionLabel: {
      fontFamily: fonts.kicker,
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.textMuted,
      paddingBottom: 9,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mapSection: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    genresSection: {
      gap: spacing.sm,
    },
    genresChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    genreChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: 500,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    genreChipText: {
      fontFamily: fonts.body,
      color: colors.text,
      fontSize: 13,
    },
    loading: {
      flex: 1,
    },
    list: {
      paddingHorizontal: 16,
      paddingVertical: 0,
      paddingBottom: 104,
      gap: spacing.sm,
    },
    listHeader: {
      gap: spacing.xs,
      paddingBottom: 0,
      marginTop: 0,
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
      fontFamily: fonts.heading,
      color: colors.text,
      fontSize: 16,
    },
    albumArtist: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 13,
    },
    reviewFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    listenedAt: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 12,
    },
    reviewText: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 13,
    },
    deleteButton: {
      padding: spacing.sm,
    },
    coversSection: {
      gap: spacing.xs,
      marginTop: 0,
    },
    coversRow: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    coverThumb: {
      width: 64,
      height: 64,
      borderRadius: radius.xs,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    empty: {
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xl * 2,
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      fontFamily: fonts.body,
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
      margin: spacing.lg,
      marginBottom: 88,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoutText: {
      fontFamily: fonts.bodySemiBold,
      color: colors.accent,
      fontSize: 15,
    },
    modalScrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    settingsSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.xs,
    },
    settingsTitle: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginBottom: spacing.xs,
    },
    settingsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingsBody: {
      flex: 1,
      gap: 2,
    },
    settingsRowTitle: {
      fontFamily: fonts.bodySemiBold,
      color: colors.text,
      fontSize: 15,
    },
    settingsRowSubtitle: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 13,
    },
    settingsAction: {
      fontFamily: fonts.bodySemiBold,
      color: colors.accent,
      fontSize: 14,
    },
  })

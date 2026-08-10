import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import ReviewModal from '../../components/ReviewModal'
import MediaReviewCard from '../../components/MediaReviewCard'
import AddToListModal from '../../components/AddToListModal'
import StarRating from '../../components/StarRating'
import { radius, spacing } from '../../constants/theme'
import type { ThemeTokens } from '../../constants/themes'
import { useTheme } from '../../lib/theme'
import { api } from '../../lib/api'
import { deleteAlbum, getAlbumById, upsertAlbum } from '../../lib/db'
import { enrichAlbumMetadata } from '../../lib/metadata'
import type { AlbumReviewsResponse, LoggedAlbum, Review } from '../../lib/types'

function formatListenedAt(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AlbumDetailScreen() {
  const params = useLocalSearchParams<{
    id: string
    title?: string
    artist?: string
    artworkUrl?: string
    releaseDate?: string
    genre?: string
    fromSearch?: string
  }>()
  const db = useSQLiteContext()
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [album, setAlbum] = useState<LoggedAlbum | null>(null)
  const [reviewsData, setReviewsData] = useState<AlbumReviewsResponse | null>(null)
  const [metadata, setMetadata] = useState<{
    genre: string | null
    year: number | null
    country: string | null
  }>(() => ({
    genre: params.genre || null,
    year: params.releaseDate ? Number(params.releaseDate.slice(0, 4)) || null : null,
    country: null,
  }))
  const [existing, setExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [listModalVisible, setListModalVisible] = useState(false)
  const [justLogged, setJustLogged] = useState(false)

  const loadReviews = useCallback(async () => {
    try {
      const data = await api.getAlbumReviews(params.id)
      setReviewsData(data)
    } catch (err) {
      console.warn(err)
    }
  }, [params.id])

  useEffect(() => {
    let active = true
    const load = async () => {
      const found = await getAlbumById(db, params.id)
      if (!active) return
      if (found) {
        setAlbum(found)
        setExisting(true)
      } else if (params.title) {
        setAlbum({
          id: params.id,
          title: params.title ?? '',
          artist: params.artist ?? '',
          artworkUrl: params.artworkUrl || null,
          releaseDate: params.releaseDate || null,
          genre: params.genre || null,
          rating: null,
          review: null,
          loggedAt: new Date().toISOString(),
          status: 'logged',
        })
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [db, params.id])

  useEffect(() => {
    if (!album) return
    let active = true
    const releaseYear = album.releaseDate
      ? Number(album.releaseDate.slice(0, 4)) || null
      : metadata.year
    enrichAlbumMetadata({
      title: album.title,
      artist: album.artist,
      releaseYear,
    }).then((enriched) => {
      if (!active) return
      setMetadata((current) => ({
        genre: current.genre ?? enriched.genre,
        year: current.year ?? enriched.year,
        country: current.country ?? enriched.country,
      }))
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album?.id])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  const handleSaved = async (review: Review) => {
    if (album) {
      const updated: LoggedAlbum = {
        ...album,
        rating: null,
        review: null,
        loggedAt: new Date().toISOString(),
        status: 'logged',
      }
      await upsertAlbum(db, updated)
      setAlbum(updated)
      setExisting(true)
    }
    await loadReviews()
  }

  const handleDeleted = async () => {
    await loadReviews()
  }

  const handleLogListening = async () => {
    if (!album) return
    try {
      await api.createListeningLog({
        albumId: album.id,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumArtworkUrl: album.artworkUrl,
        albumGenre: metadata.genre,
        albumYear: metadata.year,
        albumCountry: metadata.country,
      })
      setJustLogged(true)
      setTimeout(() => setJustLogged(false), 2000)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível registrar.')
    }
  }

  const saveWantToListen = async () => {
    if (!album) return
    const updated: LoggedAlbum = {
      ...album,
      rating: null,
      review: null,
      loggedAt: new Date().toISOString(),
      status: 'want_to_listen',
    }
    await upsertAlbum(db, updated)
    setAlbum(updated)
    setExisting(true)
  }

  const removeAlbum = () => {
    Alert.alert('Remover da lista', 'Tem certeza que deseja remover este álbum?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteAlbum(db, params.id)
        },
      },
    ])
  }

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  if (!album) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Álbum não encontrado.</Text>
      </View>
    )
  }

  const year = album.releaseDate
    ? new Date(album.releaseDate).getFullYear().toString()
    : metadata.year
      ? String(metadata.year)
      : null
  const meta = [year, album.genre ?? metadata.genre].filter(Boolean).join(' • ')
  const myReview = reviewsData?.myReview ?? null
  const otherReviews = (reviewsData?.reviews ?? []).filter(
    (review) => review.id !== myReview?.id,
  )

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Image
        source={album.artworkUrl ?? undefined}
        style={styles.cover}
        contentFit="cover"
        transition={200}
      />
      <Text style={styles.title}>{album.title}</Text>
      <Text style={styles.artist}>{album.artist}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}

      <View style={styles.averageCard}>
        <Text style={styles.averageValue}>
          {reviewsData?.average !== null && reviewsData?.average !== undefined
            ? reviewsData.average.toFixed(1)
            : '—'}
        </Text>
        <StarRating rating={reviewsData?.average ?? null} size={18} readOnly />
        <Text style={styles.averageLabel}>
          {reviewsData && reviewsData.count > 0
            ? `${reviewsData.count} avaliação${reviewsData.count === 1 ? '' : 'ões'}`
            : 'Sem avaliações ainda'}
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => setModalVisible(true)}>
        <Ionicons name={myReview ? 'create-outline' : 'star-outline'} size={20} color={colors.background} />
        <Text style={styles.primaryButtonText}>{myReview ? 'Editar minha avaliação' : 'Avaliar álbum'}</Text>
      </Pressable>

      <Pressable style={styles.logButton} onPress={handleLogListening} disabled={justLogged}>
        <Ionicons
          name={justLogged ? 'checkmark-circle' : 'today-outline'}
          size={18}
          color={justLogged ? colors.success : colors.text}
        />
        <Text style={[styles.logButtonText, justLogged && styles.logButtonTextDone]}>
          {justLogged ? 'Registrado hoje' : 'Marcar como ouvido hoje'}
        </Text>
      </Pressable>

      <Pressable style={styles.logButton} onPress={() => setListModalVisible(true)}>
        <Ionicons name="list-outline" size={18} color={colors.text} />
        <Text style={styles.logButtonText}>Adicionar a uma lista</Text>
      </Pressable>

      {myReview ? (
        <View style={styles.myReviewCard}>
          <Text style={styles.sectionLabel}>Sua avaliação</Text>
          <View style={styles.myReviewHeader}>
            <StarRating rating={myReview.rating} size={16} readOnly />
            <Text style={styles.myReviewDate}>
              Ouvido em {formatListenedAt(myReview.listenedAt)}
            </Text>
          </View>
          {myReview.reviewText ? (
            <Text style={styles.reviewText}>{myReview.reviewText}</Text>
          ) : null}
          {myReview.mediaReview ? (
            <MediaReviewCard mediaReview={myReview.mediaReview} />
          ) : null}
          <Pressable style={styles.editLink} onPress={() => setModalVisible(true)}>
            <Ionicons name="create-outline" size={14} color={colors.accent} />
            <Text style={styles.editLinkText}>Editar</Text>
          </Pressable>
        </View>
      ) : null}

      {otherReviews.length > 0 ? (
        <View style={styles.reviewsSection}>
          <Text style={styles.sectionLabel}>Resenhas</Text>
          {otherReviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                {review.user?.id ? (
                  <Pressable onPress={() => router.push(`/user/${review.user!.id}`)} hitSlop={6}>
                    <Text style={styles.reviewAuthor}>
                      {review.user?.name || 'Anônimo'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.reviewAuthor}>{review.user?.name || 'Anônimo'}</Text>
                )}
                <Text style={styles.reviewMeta}>
                  {formatReviewDate(review.createdAt)} · {formatListenedAt(review.listenedAt)}
                </Text>
              </View>
              <StarRating rating={review.rating} size={14} readOnly />
              {review.reviewText ? (
                <Text style={styles.reviewText}>{review.reviewText}</Text>
              ) : null}
              {review.mediaReview ? (
                <MediaReviewCard mediaReview={review.mediaReview} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Na sua lista</Text>
      {!myReview ? (
        <Pressable
          style={[
            styles.secondaryButton,
            album.status === 'want_to_listen' && styles.secondaryButtonActive,
          ]}
          onPress={saveWantToListen}
        >
          <Ionicons
            name="headset-outline"
            size={18}
            color={album.status === 'want_to_listen' ? colors.accent : colors.text}
          />
          <Text
            style={[
              styles.secondaryButtonText,
              album.status === 'want_to_listen' && styles.secondaryButtonTextActive,
            ]}
          >
            {album.status === 'want_to_listen'
              ? 'Na lista: quero ouvir'
              : 'Marcar como quero ouvir'}
          </Text>
        </Pressable>
      ) : null}
      {existing ? (
        <Pressable style={styles.deleteButton} onPress={removeAlbum}>
          <Ionicons name="trash-outline" size={16} color={colors.accent} />
          <Text style={styles.deleteButtonText}>Remover da lista</Text>
        </Pressable>
      ) : null}

      <ReviewModal
        visible={modalVisible}
        albumId={album.id}
        albumTitle={album.title}
        albumArtist={album.artist}
        albumArtworkUrl={album.artworkUrl}
        albumGenre={metadata.genre}
        albumYear={metadata.year}
        albumCountry={metadata.country}
        initialReview={myReview}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />

      <AddToListModal
        visible={listModalVisible}
        album={{
          albumId: album.id,
          albumTitle: album.title,
          albumArtist: album.artist,
          albumArtworkUrl: album.artworkUrl,
        }}
        onClose={() => setListModalVisible(false)}
      />
    </ScrollView>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  cover: {
    width: 180,
    height: 180,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  artist: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  averageCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  averageValue: {
    color: colors.star,
    fontSize: 32,
    fontWeight: '800',
  },
  averageLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  logButton: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  logButtonTextDone: {
    color: colors.success,
  },
  myReviewCard: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  myReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  myReviewDate: {
    color: colors.textMuted,
    fontSize: 13,
  },
  editLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  editLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reviewsSection: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  reviewCard: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewAuthor: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  reviewMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reviewText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  secondaryButtonTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  deleteButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 44,
  },
  deleteButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 15,
  },
})

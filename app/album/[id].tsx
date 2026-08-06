import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import ReviewModal from '../../components/ReviewModal'
import StarRating from '../../components/StarRating'
import { colors, radius, spacing } from '../../constants/theme'
import { api } from '../../lib/api'
import { deleteAlbum, getAlbumById, upsertAlbum } from '../../lib/db'
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

  const [album, setAlbum] = useState<LoggedAlbum | null>(null)
  const [reviewsData, setReviewsData] = useState<AlbumReviewsResponse | null>(null)
  const [existing, setExisting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)

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
    loadReviews()
  }, [loadReviews])

  const handleSaved = async (review: Review) => {
    if (album) {
      await upsertAlbum(db, {
        ...album,
        rating: null,
        review: null,
        loggedAt: new Date().toISOString(),
        status: 'logged',
      })
    }
    await loadReviews()
  }

  const handleDeleted = async () => {
    await loadReviews()
  }

  const saveWantToListen = async () => {
    if (!album) return
    await upsertAlbum(db, {
      ...album,
      rating: null,
      review: null,
      loggedAt: new Date().toISOString(),
      status: 'want_to_listen',
    })
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

  const year = album.releaseDate ? new Date(album.releaseDate).getFullYear().toString() : null
  const meta = [year, album.genre].filter(Boolean).join(' • ')
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
                <Text style={styles.reviewAuthor}>
                  {review.user?.name || review.user?.email || 'Anônimo'}
                </Text>
                <Text style={styles.reviewMeta}>
                  {formatReviewDate(review.createdAt)} · {formatListenedAt(review.listenedAt)}
                </Text>
              </View>
              <StarRating rating={review.rating} size={14} readOnly />
              {review.reviewText ? (
                <Text style={styles.reviewText}>{review.reviewText}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Na sua lista</Text>
      <Pressable style={styles.secondaryButton} onPress={saveWantToListen}>
        <Ionicons name="headset-outline" size={18} color={colors.text} />
        <Text style={styles.secondaryButtonText}>
          {album.status === 'want_to_listen' ? 'Marcado: quero ouvir' : 'Marcar como quero ouvir'}
        </Text>
      </Pressable>
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
        initialReview={myReview}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
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

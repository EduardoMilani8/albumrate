import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AddToListModal from '../../components/AddToListModal'
import ReviewModal from '../../components/ReviewModal'
import StarRating from '../../components/StarRating'
import { fonts, radius, spacing } from '../../constants/theme'
import type { ThemeTokens } from '../../constants/themes'
import { useTheme } from '../../lib/theme'
import { api } from '../../lib/api'
import { getAlbumById, upsertAlbum } from '../../lib/db'
import { enrichAlbumMetadata } from '../../lib/metadata'
import type { AlbumReviewsResponse, LoggedAlbum, Review } from '../../lib/types'

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function formatCapsDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day} ${MONTHS[Number(month) - 1] ?? month} ${year}`
}

function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toFixed(1).replace('.', ',')
}

function initialOf(name: string | null | undefined): string {
  const clean = (name ?? '').trim()
  return clean ? clean.charAt(0).toUpperCase() : '?'
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
  const insets = useSafeAreaInsets()
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
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [listModalVisible, setListModalVisible] = useState(false)

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
    }
    await loadReviews()
  }

  const openSpotify = () => {
    Linking.openURL(`https://open.spotify.com/album/${album?.id}`).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o Spotify.'),
    )
  }

  const shareAlbum = () => {
    if (!album) return
    const average = formatRating(reviewsData?.average ?? null)
    Share.share({
      message: `${album.title} — ${album.artist}${average !== '—' ? ` — ${average}/5` : ''}`,
    })
  }

  const shareReview = () => {
    if (!album || !myReview) return
    const text = myReview.reviewText ? `\n"${myReview.reviewText}"` : ''
    Share.share({
      message: `${album.title} — ${album.artist} — ${formatRating(myReview.rating)}/5${text}`,
    })
  }

  const showMoreOptions = () => {
    Alert.alert('Mais opções', undefined, [
      { text: 'Abrir no Spotify', onPress: openSpotify },
      { text: 'Adicionar a uma lista', onPress: () => setListModalVisible(true) },
      { text: 'Cancelar', style: 'cancel' },
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
  const metaKicker = [year, album.genre ?? metadata.genre, metadata.country]
    .filter(Boolean)
    .join(' · ')
  const myReview = reviewsData?.myReview ?? null
  const otherReviews = (reviewsData?.reviews ?? []).filter(
    (review) => review.id !== myReview?.id,
  )
  const ratingKicker = [
    reviewsData && reviewsData.count > 0 ? `${reviewsData.count} AVALIAÇÕES` : null,
    reviewsData && reviewsData.collectionCount > 0
      ? `${reviewsData.collectionCount} NA COLEÇÃO`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {album.artworkUrl ? (
          <Image
            source={album.artworkUrl}
            style={styles.heroCover}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.heroCover, styles.heroPlaceholder]} />
        )}

        <LinearGradient
          colors={['rgba(10,9,8,0.55)', 'rgba(10,9,8,0)']}
          locations={[0, 1]}
          style={styles.heroTopScrim}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(10,9,8,0)', colors.background]}
          locations={[0, 1]}
          style={styles.heroBottomScrim}
          pointerEvents="none"
        />

        <View style={[styles.heroBar, { top: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.heroIconButton}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <View style={styles.heroBarRight}>
            <Pressable onPress={shareAlbum} hitSlop={8} style={styles.heroIconButton}>
              <Ionicons name="share-outline" size={21} color={colors.text} />
            </Pressable>
            <Pressable onPress={showMoreOptions} hitSlop={8} style={styles.heroIconButton}>
              <Ionicons name="ellipsis-horizontal" size={21} color={colors.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroText}>
          {metaKicker ? (
            <Text style={styles.heroKicker}>{metaKicker.toUpperCase()}</Text>
          ) : null}
          <Text style={styles.heroTitle}>{album.title}</Text>
          <Text style={styles.heroArtist}>{album.artist}</Text>
        </View>
      </View>

      <View style={styles.ratingRow}>
        <Text style={styles.ratingValue}>{formatRating(reviewsData?.average ?? null)}</Text>
        <View style={styles.ratingBlock}>
          <StarRating rating={reviewsData?.average ?? null} size={18} readOnly />
          {ratingKicker ? <Text style={styles.ratingKicker}>{ratingKicker}</Text> : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.rateButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="star-outline" size={16} color={colors.accent} />
          <Text style={styles.rateButtonText}>Avaliar álbum</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={openSpotify} hitSlop={4}>
          <Ionicons name="headset-outline" size={19} color={colors.textMuted} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => setListModalVisible(true)} hitSlop={4}>
          <Ionicons name="list-outline" size={19} color={colors.textMuted} />
        </Pressable>
      </View>

      {myReview ? (
        <View style={styles.myReviewCard}>
          <View style={styles.myReviewTop}>
            <Text style={styles.myReviewLabel}>Sua avaliação</Text>
            <Text style={styles.myReviewDate}>{formatCapsDate(myReview.listenedAt)}</Text>
          </View>
          <View style={styles.myReviewRatingRow}>
            <StarRating rating={myReview.rating} size={13} readOnly />
            <Text style={styles.myReviewValue}>{formatRating(myReview.rating)}</Text>
          </View>
          {myReview.reviewText ? (
            <Text style={styles.reviewText}>{myReview.reviewText}</Text>
          ) : null}
          <View style={styles.myReviewLinks}>
            <Pressable style={styles.myReviewLink} onPress={() => setModalVisible(true)}>
              <Ionicons name="pencil-outline" size={13} color={colors.textMuted} />
              <Text style={styles.myReviewLinkText}>Editar</Text>
            </Pressable>
            <Pressable style={styles.myReviewLink} onPress={shareReview}>
              <Ionicons name="share-outline" size={13} color={colors.accent} />
              <Text style={[styles.myReviewLinkText, styles.myReviewShareText]}>
                Compartilhar
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {otherReviews.length > 0 ? (
        <View style={styles.communitySection}>
          <Text style={styles.communityLabel}>Resenhas da comunidade</Text>
          {otherReviews.map((review) => (
            <View key={review.id} style={styles.communityRow}>
              <View style={styles.communityAvatar}>
                <Text style={styles.communityInitial}>{initialOf(review.user?.name)}</Text>
              </View>
              <View style={styles.communityBody}>
                <View style={styles.communityHeader}>
                  <Pressable
                    onPress={() => {
                      if (review.user?.id) router.push(`/user/${review.user.id}`)
                    }}
                  >
                    <Text style={styles.communityName}>
                      {review.user?.name || 'Anônimo'}
                    </Text>
                  </Pressable>
                  <StarRating rating={review.rating} size={10} readOnly />
                </View>
                {review.reviewText ? (
                  <Text style={styles.communityText} numberOfLines={4}>
                    {review.reviewText}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
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
        onDeleted={loadReviews}
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
      paddingBottom: spacing.xl,
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
    hero: {
      width: '100%',
      height: 330,
    },
    heroCover: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    heroPlaceholder: {
      backgroundColor: colors.surfaceAlt,
    },
    heroTopScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 140,
    },
    heroBottomScrim: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 190,
    },
    heroBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    heroBarRight: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    heroIconButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroText: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.md,
    },
    heroKicker: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1.8,
      color: colors.accent,
      marginBottom: 8,
    },
    heroTitle: {
      fontFamily: fonts.heading,
      fontSize: 34,
      lineHeight: 36,
      letterSpacing: -0.3,
      color: colors.text,
    },
    heroArtist: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.textMuted,
      marginTop: 6,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingTop: 15,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ratingValue: {
      fontFamily: fonts.headingRegular,
      fontSize: 40,
      color: colors.accent,
      fontVariant: ['tabular-nums'],
    },
    ratingBlock: {
      flex: 1,
      gap: 6,
    },
    ratingKicker: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: 14,
    },
    rateButton: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    rateButtonText: {
      fontFamily: fonts.heading,
      fontSize: 15,
      letterSpacing: 0.3,
      color: colors.accent,
    },
    iconButton: {
      width: 44,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    myReviewCard: {
      marginTop: spacing.md,
      marginHorizontal: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 2,
      borderLeftColor: colors.accent,
      borderTopRightRadius: radius.xs,
      borderBottomRightRadius: radius.xs,
      backgroundColor: colors.surface,
      padding: 14,
    },
    myReviewTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    myReviewLabel: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.accent,
      textTransform: 'uppercase',
    },
    myReviewDate: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.2,
      color: colors.textMuted,
    },
    myReviewRatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    myReviewValue: {
      fontFamily: fonts.headingRegular,
      fontSize: 17,
      color: colors.accent,
    },
    reviewText: {
      fontFamily: fonts.italic,
      fontSize: 13.5,
      lineHeight: 21,
      color: colors.text,
      marginTop: spacing.sm,
    },
    myReviewLinks: {
      flexDirection: 'row',
      gap: 18,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    myReviewLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    myReviewLinkText: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.2,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    myReviewShareText: {
      color: colors.accent,
    },
    communitySection: {
      marginTop: 18,
      paddingHorizontal: spacing.lg,
    },
    communityLabel: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textMuted,
      textTransform: 'uppercase',
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    communityRow: {
      flexDirection: 'row',
      gap: 11,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    communityAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    communityInitial: {
      fontFamily: fonts.heading,
      fontSize: 13,
      color: colors.accent,
    },
    communityBody: {
      flex: 1,
      minWidth: 0,
    },
    communityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    communityName: {
      fontFamily: fonts.heading,
      fontSize: 14,
      color: colors.text,
    },
    communityText: {
      fontFamily: fonts.italic,
      fontSize: 12.5,
      lineHeight: 19,
      color: colors.textMuted,
      marginTop: 5,
    },
  })

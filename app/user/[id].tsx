import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import StarRating from '../../components/StarRating'
import { colors, radius, spacing } from '../../constants/theme'
import { api } from '../../lib/api'
import type { Review, UserProfile } from '../../lib/types'

function formatListenedAt(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id: string }>()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      const userId = params.id
      api
        .getUserProfile(userId)
        .then((data) => {
          if (!active) return
          if (data.user.isSelf) {
            router.replace('/profile')
            return
          }
          setProfile(data.user)
        })
        .catch((err) => {
          if (!active) return
          Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
      api
        .getUserReviews(userId)
        .then((data) => {
          if (active) setReviews(data.reviews)
        })
        .catch((err) => {
          console.warn(err)
        })
      return () => {
        active = false
      }
    }, [params.id]),
  )

  const handleFollow = async () => {
    if (!profile || followLoading) return
    setFollowLoading(true)
    const wasFollowing = profile.isFollowing
    setProfile((current) =>
      current
        ? {
            ...current,
            isFollowing: !wasFollowing,
            counts: {
              ...current.counts,
              followers: current.counts.followers + (wasFollowing ? -1 : 1),
            },
          }
        : current,
    )
    try {
      if (wasFollowing) {
        await api.unfollowUser(profile.id)
      } else {
        await api.followUser(profile.id)
      }
    } catch (err) {
      setProfile((current) =>
        current
          ? {
              ...current,
              isFollowing: wasFollowing,
              counts: {
                ...current.counts,
                followers: current.counts.followers + (wasFollowing ? 1 : -1),
              },
            }
          : current,
      )
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível seguir.')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Perfil não encontrado.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.avatar}>
              {profile.avatarUrl ? (
                <Image source={profile.avatarUrl} style={styles.avatarImage} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={28} color={colors.text} />
              )}
            </View>
            <Text style={styles.name}>{profile.name ?? 'Sem nome'}</Text>
            {profile.country ? <Text style={styles.country}>{profile.country}</Text> : null}

            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.counts.reviews}</Text>
                <Text style={styles.statLabel}>Avaliações</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.counts.followers}</Text>
                <Text style={styles.statLabel}>Seguidores</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.counts.following}</Text>
                <Text style={styles.statLabel}>Seguindo</Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.followButton,
                profile.isFollowing && styles.followButtonActive,
              ]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              <Ionicons
                name={profile.isFollowing ? 'checkmark' : 'person-add-outline'}
                size={18}
                color={profile.isFollowing ? colors.text : colors.background}
              />
              <Text
                style={[
                  styles.followButtonText,
                  profile.isFollowing && styles.followButtonTextActive,
                ]}
              >
                {profile.isFollowing ? 'Seguindo' : 'Seguir'}
              </Text>
            </Pressable>

            {profile.favoriteGenres.length > 0 ? (
              <View style={styles.genresCard}>
                <Text style={styles.genresTitle}>Gêneros favoritos</Text>
                <View style={styles.genresChips}>
                  {profile.favoriteGenres.map((genre) => (
                    <View key={genre} style={styles.genreChip}>
                      <Text style={styles.genreChipText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {reviews.length > 0 ? (
              <Text style={styles.sectionLabel}>Avaliações recentes</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.reviewCard}
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
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyText}>{profile.name ?? 'Essa pessoa'} ainda não avaliou nada.</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
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
  country: {
    color: colors.textMuted,
    fontSize: 13,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
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
    fontSize: 20,
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
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    alignSelf: 'stretch',
    marginHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  followButtonActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  followButtonTextActive: {
    color: colors.text,
  },
  genresCard: {
    alignSelf: 'stretch',
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
  sectionLabel: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  list: {
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    gap: spacing.sm,
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

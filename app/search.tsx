import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import { searchAlbums } from '../lib/spotify'
import type { SpotifyAlbumResult, UserSearchResult } from '../lib/types'

type SearchTab = 'albums' | 'users'

export default function SearchScreen() {
  const params = useLocalSearchParams<{ listId?: string }>()
  const listId = params.listId
  const navigation = useNavigation()
  const [tab, setTab] = useState<SearchTab>('albums')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyAlbumResult[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [followingUserId, setFollowingUserId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({ title: listId ? 'Adicionar à lista' : 'Buscar' })
  }, [navigation, listId])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = query.trim()
    if (!trimmed || tab !== 'albums') {
      setResults([])
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    timerRef.current = setTimeout(() => {
      searchAlbums(trimmed)
        .then(setResults)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Não foi possível buscar. Tente novamente.'),
        )
        .finally(() => setLoading(false))
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, tab])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = query.trim()
    if (!trimmed || tab !== 'users') {
      setUserResults([])
      setUserError(null)
      setUserLoading(false)
      return
    }
    setUserLoading(true)
    setUserError(null)
    timerRef.current = setTimeout(() => {
      api
        .searchUsers(trimmed)
        .then((data) => setUserResults(data.users))
        .catch((err) =>
          setUserError(err instanceof Error ? err.message : 'Não foi possível buscar. Tente novamente.'),
        )
        .finally(() => setUserLoading(false))
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, tab])

  const handleSelect = async (album: SpotifyAlbumResult) => {
    if (!listId) {
      router.replace({
        pathname: '/album/[id]',
        params: {
          id: album.id,
          title: album.title,
          artist: album.artist,
          artworkUrl: album.artworkUrl ?? '',
          releaseDate: album.releaseDate ?? '',
          genre: album.genre ?? '',
          fromSearch: '1',
        },
      })
      return
    }

    if (addingId) return
    setAddingId(album.id)
    try {
      await api.addListAlbum(listId, {
        albumId: album.id,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumArtworkUrl: album.artworkUrl,
      })
      router.back()
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível adicionar.')
    } finally {
      setAddingId(null)
    }
  }

  const handleToggleFollow = async (user: UserSearchResult) => {
    if (followingUserId) return
    setFollowingUserId(user.id)
    try {
      if (user.isFollowing) {
        await api.unfollowUser(user.id)
      } else {
        await api.followUser(user.id)
      }
      setUserResults((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, isFollowing: !item.isFollowing } : item,
        ),
      )
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível seguir.')
    } finally {
      setFollowingUserId(null)
    }
  }

  const year = (releaseDate: string | null) =>
    releaseDate ? new Date(releaseDate).getFullYear().toString() : null

  const renderUsers = () => {
    if (userLoading) {
      return <ActivityIndicator color={colors.accent} style={styles.center} />
    }
    if (userError) {
      return (
        <View style={styles.center}>
          <Text style={styles.error}>{userError}</Text>
        </View>
      )
    }
    return (
      <FlatList
        data={userResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.userRow} onPress={() => router.push(`/user/${item.id}`)}>
            {item.avatarUrl ? (
              <Image source={item.avatarUrl} style={styles.userAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.userAvatar, styles.userAvatarPlaceholder]}>
                <Ionicons name="person" size={18} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {item.name ?? 'Sem nome'}
              </Text>
              {item.country ? <Text style={styles.subtitle}>{item.country}</Text> : null}
            </View>
            <Pressable
              style={[styles.followButton, item.isFollowing && styles.followButtonActive]}
              onPress={() => handleToggleFollow(item)}
              disabled={followingUserId === item.id}
              hitSlop={6}
            >
              {followingUserId === item.id ? (
                <ActivityIndicator
                  size="small"
                  color={item.isFollowing ? colors.text : colors.background}
                />
              ) : (
                <Text
                  style={[
                    styles.followButtonText,
                    item.isFollowing && styles.followButtonTextActive,
                  ]}
                >
                  {item.isFollowing ? 'Seguindo' : 'Seguir'}
                </Text>
              )}
            </Pressable>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim() ? (
            <View style={styles.center}>
              <Text style={styles.error}>Nenhum usuário encontrado.</Text>
            </View>
          ) : null
        }
      />
    )
  }

  return (
    <View style={styles.container}>
      {!listId ? (
        <View style={styles.segmented}>
          {(['albums', 'users'] as const).map((key) => {
            const active = tab === key
            return (
              <Pressable
                key={key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setTab(key)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {key === 'albums' ? 'Álbuns' : 'Pessoas'}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder={tab === 'users' ? 'Buscar pessoas' : 'Buscar álbum ou artista'}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {tab === 'users' && !listId ? (
        renderUsers()
      ) : loading ? (
        <ActivityIndicator color={colors.accent} style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleSelect(item)}>
              <Image
                source={item.artworkUrl ?? undefined}
                style={styles.cover}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item.artist}
                </Text>
                {year(item.releaseDate) ? (
                  <Text style={styles.subtitle}>{year(item.releaseDate)}</Text>
                ) : null}
              </View>
              {listId ? (
                addingId === item.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name="add-circle-outline" size={22} color={colors.textMuted} />
                )
              ) : null}
            </Pressable>
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  segmented: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    padding: 4,
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.accentMuted,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
  },
  userAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  followButton: {
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 500,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonActive: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  followButtonTextActive: {
    color: colors.text,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  error: {
    color: colors.accent,
    fontSize: 15,
    textAlign: 'center',
  },
})

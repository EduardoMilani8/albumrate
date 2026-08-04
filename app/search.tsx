import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { searchAlbums } from '../lib/itunes'
import type { ItunesAlbumResult } from '../lib/types'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ItunesAlbumResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
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
        .catch(() => setError('Não foi possível buscar. Tente novamente.'))
        .finally(() => setLoading(false))
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  const handleSelect = (album: ItunesAlbumResult) => {
    router.replace({
      pathname: '/album/[id]',
      params: {
        id: String(album.collectionId),
        title: album.collectionName,
        artist: album.artistName,
        artworkUrl: album.artworkUrl100 ?? '',
        releaseDate: album.releaseDate ?? '',
        genre: album.primaryGenreName ?? '',
        fromSearch: '1',
      },
    })
  }

  const year = (releaseDate: string | null) =>
    releaseDate ? new Date(releaseDate).getFullYear().toString() : null

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Buscar álbum ou artista"
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

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.collectionId)}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleSelect(item)}>
              <Image
                source={item.artworkUrl100 ?? undefined}
                style={styles.cover}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.collectionName}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {item.artistName}
                </Text>
                {year(item.releaseDate) ? (
                  <Text style={styles.subtitle}>{year(item.releaseDate)}</Text>
                ) : null}
              </View>
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
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
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

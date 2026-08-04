import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import StarRating from '../../components/StarRating'
import { colors, radius, spacing } from '../../constants/theme'
import { deleteAlbum, getAlbumById, upsertAlbum } from '../../lib/db'
import type { LoggedAlbum } from '../../lib/types'

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
  const [rating, setRating] = useState<number | null>(null)
  const [review, setReview] = useState('')
  const [existing, setExisting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      const found = await getAlbumById(db, params.id)
      if (!active) return
      if (found) {
        setAlbum(found)
        setRating(found.rating)
        setReview(found.review ?? '')
        setExisting(true)
      } else if (params.fromSearch === '1') {
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

  const saveLogged = async () => {
    if (rating === null) {
      Alert.alert('Nota obrigatória', 'Selecione uma nota de 0,5 a 5 estrelas antes de salvar.')
      return
    }
    if (!album) return
    await upsertAlbum(db, {
      ...album,
      rating,
      review: review.trim() || null,
      loggedAt: new Date().toISOString(),
      status: 'logged',
    })
    router.replace('/')
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
    router.replace('/')
  }

  const removeAlbum = () => {
    Alert.alert('Remover da lista', 'Tem certeza que deseja remover este álbum?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          await deleteAlbum(db, params.id)
          router.replace('/')
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

      <Text style={styles.sectionLabel}>Sua nota</Text>
      <View style={styles.ratingRow}>
        <StarRating rating={rating} onChange={setRating} size={36} />
        {rating !== null ? <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text> : null}
      </View>

      <Text style={styles.sectionLabel}>Anotação</Text>
      <TextInput
        style={styles.input}
        value={review}
        onChangeText={setReview}
        placeholder="Escreva sua opinião sobre o álbum (opcional)"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      <Pressable style={styles.primaryButton} onPress={saveLogged}>
        <Text style={styles.primaryButtonText}>Salvar avaliação</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={saveWantToListen}>
        <Text style={styles.secondaryButtonText}>Marcar como quero ouvir</Text>
      </Pressable>
      {existing ? (
        <Pressable style={styles.deleteButton} onPress={removeAlbum}>
          <Ionicons name="trash-outline" size={16} color={colors.accent} />
          <Text style={styles.deleteButtonText}>Remover da lista</Text>
        </Pressable>
      ) : null}
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
  sectionLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  ratingValue: {
    color: colors.star,
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    alignSelf: 'stretch',
    minHeight: 120,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
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

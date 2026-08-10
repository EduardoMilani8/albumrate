import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ListFormModal from '../../components/ListFormModal'
import { radius, spacing } from '../../constants/theme'
import type { ThemeTokens } from '../../constants/themes'
import { api } from '../../lib/api'
import { useTheme } from '../../lib/theme'
import type { AlbumListSummary, ListAlbum } from '../../lib/types'

export default function ListDetailScreen() {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const params = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()
  const [list, setList] = useState<AlbumListSummary | null>(null)
  const [albums, setAlbums] = useState<ListAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [editVisible, setEditVisible] = useState(false)
  const [reordering, setReordering] = useState(false)

  const load = useCallback(() => {
    let active = true
    api
      .getPublicList(params.id)
      .then((data) => {
        if (!active) return
        setList(data.list)
        setAlbums(data.albums)
      })
      .catch((err) => {
        console.warn(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [params.id])

  useFocusEffect(load)

  useLayoutEffect(() => {
    navigation.setOptions({ title: list?.name ?? 'Lista' })
  }, [navigation, list?.name])

  const commitReorder = async (ordered: ListAlbum[]) => {
    setAlbums(ordered)
    setReordering(true)
    try {
      const { albums: updated } = await api.reorderListAlbums(
        params.id,
        ordered.map((album) => album.albumId),
      )
      setAlbums(updated)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível reordenar.')
      load()
    } finally {
      setReordering(false)
    }
  }

  const moveUp = (index: number) => {
    if (index <= 0) return
    const next = [...albums]
    const [item] = next.splice(index, 1)
    if (item) next.splice(index - 1, 0, item)
    commitReorder(next)
  }

  const moveDown = (index: number) => {
    if (index >= albums.length - 1) return
    const next = [...albums]
    const [item] = next.splice(index, 1)
    if (item) next.splice(index + 1, 0, item)
    commitReorder(next)
  }

  const removeAlbum = (album: ListAlbum) => {
    Alert.alert('Remover da lista', `Remover "${album.albumTitle}" desta lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.removeListAlbum(params.id, album.albumId)
            setAlbums((current) => current.filter((item) => item.albumId !== album.albumId))
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível remover.')
          }
        },
      },
    ])
  }

  const deleteList = () => {
    if (!list) return
    Alert.alert('Excluir lista', `Excluir a lista "${list.name}"? Os álbuns dela serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteList(list.id)
            router.back()
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível excluir.')
          }
        },
      },
    ])
  }

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  if (!list) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Lista não encontrada.</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.albumId}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              {list.coverArtworkUrl ? (
                <Image
                  source={list.coverArtworkUrl}
                  style={styles.cover}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Ionicons name="disc-outline" size={36} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.title}>{list.name}</Text>
              {list.description ? (
                <Text style={styles.description}>{list.description}</Text>
              ) : null}
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Ionicons
                    name={list.isPublic ? 'eye-outline' : 'lock-closed-outline'}
                    size={13}
                    color={colors.textMuted}
                  />
                  <Text style={styles.badgeText}>
                    {list.isPublic ? 'Pública' : 'Privada'}
                  </Text>
                </View>
                <Text style={styles.count}>
                  {list.albumCount} álbum{list.albumCount === 1 ? '' : 's'}
                </Text>
              </View>

              <View style={styles.headerActions}>
                {list.isOwner ? (
                  <Pressable style={styles.secondaryButton} onPress={() => setEditVisible(true)}>
                    <Ionicons name="create-outline" size={16} color={colors.text} />
                    <Text style={styles.secondaryButtonText}>Editar lista</Text>
                  </Pressable>
                ) : null}
                {list.isOwner ? (
                  <Pressable style={styles.deleteListButton} onPress={deleteList} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.accent} />
                  </Pressable>
                ) : null}
              </View>

              {list.isOwner ? (
                <Pressable style={styles.addButton} onPress={() => router.push(`/search?listId=${list.id}`)}>
                  <Ionicons name="add" size={20} color={colors.background} />
                  <Text style={styles.addButtonText}>Adicionar álbum</Text>
                </Pressable>
              ) : null}

              {reordering ? (
                <ActivityIndicator color={colors.accent} style={styles.reordering} />
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.albumRow}>
            <Pressable
              style={styles.albumMain}
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
                style={styles.albumCover}
                contentFit="cover"
                transition={150}
              />
              <View style={styles.albumInfo}>
                <Text style={styles.albumTitle} numberOfLines={1}>
                  {item.albumTitle}
                </Text>
                <Text style={styles.albumArtist} numberOfLines={1}>
                  {item.albumArtist}
                </Text>
              </View>
            </Pressable>
            {list.isOwner ? (
              <View style={styles.albumActions}>
                <Pressable
                  onPress={() => moveUp(index)}
                  disabled={index === 0 || reordering}
                  hitSlop={6}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={index === 0 || reordering ? colors.textMuted : colors.text}
                  />
                </Pressable>
                <Pressable
                  onPress={() => moveDown(index)}
                  disabled={index === albums.length - 1 || reordering}
                  hitSlop={6}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={index === albums.length - 1 || reordering ? colors.textMuted : colors.text}
                  />
                </Pressable>
                <Pressable onPress={() => removeAlbum(item)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={18} color={colors.accent} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="disc-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Nenhum álbum nesta lista ainda. Toque em "Adicionar álbum" para buscar e incluir.
            </Text>
          </View>
        }
      />

      <ListFormModal
        visible={editVisible}
        list={list}
        onClose={() => setEditVisible(false)}
        onSaved={(updated) =>
          setList((current) =>
            current
              ? {
                  ...updated,
                  albumCount: current.albumCount,
                  coverArtworkUrl: current.coverArtworkUrl,
                }
              : updated,
          )
        }
      />
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
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
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cover: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.sm,
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  count: {
    color: colors.textMuted,
    fontSize: 13,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    flex: 1,
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
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteListButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  reordering: {
    marginTop: spacing.xs,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  albumMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  albumCover: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  albumInfo: {
    flex: 1,
    gap: 2,
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
  albumActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { AlbumListSummary } from '../lib/types'
import ListFormModal from './ListFormModal'

interface AddToListAlbum {
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
}

interface AddToListModalProps {
  visible: boolean
  album: AddToListAlbum
  onClose: () => void
}

export default function AddToListModal({ visible, album, onClose }: AddToListModalProps) {
  const [lists, setLists] = useState<AlbumListSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [addingId, setAddingId] = useState<string | null>(null)
  const [createVisible, setCreateVisible] = useState(false)

  useEffect(() => {
    if (visible) {
      setAddedIds(new Set())
      setAddingId(null)
      setLoading(true)
      api
        .myLists()
        .then((data) => setLists(data.lists))
        .catch((err) =>
          Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.'),
        )
        .finally(() => setLoading(false))
    }
  }, [visible])

  const handleAdd = async (list: AlbumListSummary) => {
    if (addedIds.has(list.id) || addingId !== null) return
    setAddingId(list.id)
    try {
      await api.addListAlbum(list.id, album)
      setAddedIds((current) => new Set(current).add(list.id))
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível adicionar.')
    } finally {
      setAddingId(null)
    }
  }

  const handleCreate = async (created: AlbumListSummary) => {
    try {
      await api.addListAlbum(created.id, album)
      setLists((current) => [created, ...current])
      setAddedIds((current) => new Set(current).add(created.id))
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível adicionar.')
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Adicionar a uma lista</Text>

          <View style={styles.albumRow}>
            <Image
              source={album.albumArtworkUrl ?? undefined}
              style={styles.cover}
              contentFit="cover"
              transition={150}
            />
            <View style={styles.albumInfo}>
              <Text style={styles.albumTitle} numberOfLines={1}>
                {album.albumTitle}
              </Text>
              <Text style={styles.albumArtist} numberOfLines={1}>
                {album.albumArtist}
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loading} />
          ) : (
            <FlatList
              data={lists}
              keyExtractor={(item) => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const added = addedIds.has(item.id)
                const adding = addingId === item.id
                return (
                  <Pressable
                    style={styles.listRow}
                    onPress={() => handleAdd(item)}
                    disabled={added}
                  >
                    <Image
                      source={item.coverArtworkUrl ?? undefined}
                      style={styles.listCover}
                      contentFit="cover"
                      transition={150}
                    />
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.listMeta} numberOfLines={1}>
                        {item.albumCount} álbum{item.albumCount === 1 ? '' : 's'} ·{' '}
                        {item.isPublic ? 'Pública' : 'Privada'}
                      </Text>
                    </View>
                    {adding ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : added ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={22} color={colors.textMuted} />
                    )}
                  </Pressable>
                )
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="list-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.emptyText}>
                    Você ainda não tem listas. Crie uma para guardar este álbum.
                  </Text>
                </View>
              }
            />
          )}

          <Pressable style={styles.createButton} onPress={() => setCreateVisible(true)}>
            <Ionicons name="add" size={20} color={colors.accent} />
            <Text style={styles.createButtonText}>Criar nova lista</Text>
          </Pressable>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Concluir</Text>
          </Pressable>
        </View>

        <ListFormModal
          visible={createVisible}
          onClose={() => setCreateVisible(false)}
          onSaved={handleCreate}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  cover: {
    width: 48,
    height: 48,
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
  loading: {
    paddingVertical: spacing.lg,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  listCover: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  listInfo: {
    flex: 1,
    gap: 2,
  },
  listName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  listMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  createButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  doneButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  doneButtonText: {
    color: colors.textMuted,
    fontSize: 15,
  },
})

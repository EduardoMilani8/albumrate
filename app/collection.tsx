import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import CollectionFormModal from '../components/CollectionFormModal'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { CollectionItem, MediaType, PublicCollectionItem } from '../lib/types'

const MEDIA_FILTERS: { value: MediaType | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'vinil', label: 'Vinil' },
  { value: 'cd', label: 'CD' },
  { value: 'cassete', label: 'Cassete' },
  { value: 'digital', label: 'Digital' },
]

const MEDIA_LABELS: Record<MediaType, string> = {
  vinil: 'Vinil',
  cd: 'CD',
  cassete: 'Cassete',
  digital: 'Digital',
}

const CONDITION_LABELS: Record<CollectionItem['condition'], string> = {
  novo: 'Novo',
  usado: 'Usado',
  desgastado: 'Desgastado',
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function CollectionScreen() {
  const params = useLocalSearchParams<{ userId?: string }>()
  const userId = params.userId
  const isOwn = !userId
  const navigation = useNavigation()
  const [items, setItems] = useState<CollectionItem[]>([])
  const [publicItems, setPublicItems] = useState<PublicCollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [mediaFilter, setMediaFilter] = useState<MediaType | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useLayoutEffect(() => {
    navigation.setOptions({ title: isOwn ? 'Minha Coleção' : 'Coleção' })
  }, [navigation, isOwn])

  const loadItems = useCallback(() => {
    let active = true
    if (isOwn) {
      api
        .myCollection({ q: debouncedQuery || undefined, mediaType: mediaFilter ?? undefined })
        .then((data) => {
          if (active) setItems(data.items)
        })
        .catch((err) => {
          console.warn(err)
          if (active) Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    } else {
      api
        .userCollection(userId)
        .then((data) => {
          if (active) setPublicItems(data.items)
        })
        .catch((err) => {
          console.warn(err)
          if (active) Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível carregar.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    return () => {
      active = false
    }
  }, [isOwn, userId, debouncedQuery, mediaFilter])

  useFocusEffect(loadItems)

  const handleDelete = (item: CollectionItem) => {
    Alert.alert('Remover item', `Excluir "${item.albumTitle}" da sua coleção?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCollectionItem(item.id)
            setItems((current) => current.filter((it) => it.id !== item.id))
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível remover.')
          }
        },
      },
    ])
  }

  const openCreate = () => {
    setEditingItem(null)
    setFormVisible(true)
  }

  const openEdit = (item: CollectionItem) => {
    setEditingItem(item)
    setFormVisible(true)
  }

  const ownCount = items.length
  const totalSpent = useMemo(
    () =>
      items.reduce((sum, item) => {
        if (!item.pricePaid) return sum
        const value = Number(item.pricePaid.replace(',', '.'))
        return Number.isFinite(value) ? sum + value : sum
      }, 0),
    [items],
  )

  const renderItem = ({ item }: { item: CollectionItem | PublicCollectionItem }) => {
    const isFull = 'condition' in item
    return (
      <Pressable
        style={styles.card}
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
        {item.albumArtworkUrl ? (
          <Image source={item.albumArtworkUrl} style={styles.cover} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="disc-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.albumTitle}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item.albumArtist}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.badge}>{MEDIA_LABELS[item.mediaType]}</Text>
            {isFull ? (
              <Text style={styles.metaText}>{CONDITION_LABELS[item.condition]}</Text>
            ) : null}
            {isFull && item.pricePaid ? <Text style={styles.metaText}>R$ {item.pricePaid}</Text> : null}
            <Text style={styles.metaText}>
              {isFull ? 'Adquirido em ' : ''}
              {formatDate(item.acquiredAt)}
            </Text>
          </View>
          {isFull && item.editionNote ? (
            <Text style={styles.edition} numberOfLines={1}>
              {item.editionNote}
            </Text>
          ) : null}
        </View>
        {isOwn ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => openEdit(item as CollectionItem)}
              hitSlop={8}
              style={styles.actionButton}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => handleDelete(item as CollectionItem)}
              hitSlop={8}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={18} color={colors.accent} />
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={isOwn ? items : publicItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.header}>
              {isOwn ? (
                <>
                  <View style={styles.inputRow}>
                    <Ionicons name="search" size={18} color={colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Buscar na sua coleção"
                      placeholderTextColor={colors.textMuted}
                      value={query}
                      onChangeText={setQuery}
                    />
                    {query.length > 0 ? (
                      <Pressable onPress={() => setQuery('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.chipRow}>
                    {MEDIA_FILTERS.map((filter) => {
                      const selected = mediaFilter === filter.value
                      return (
                        <Pressable
                          key={filter.value ?? 'all'}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => setMediaFilter(filter.value)}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                            {filter.label}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>

                  {items.length > 0 ? (
                    <Text style={styles.summary}>
                      {ownCount} item{ownCount === 1 ? '' : 's'}
                      {totalSpent > 0 ? ` · R$ ${totalSpent.toFixed(2)} no total` : ''}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {isOwn
                  ? 'Sua coleção está vazia. Toque no + para adicionar seu primeiro vinil, CD ou cassete.'
                  : 'Esta pessoa ainda não adicionou itens à coleção.'}
              </Text>
            </View>
          }
        />
      )}

      {isOwn ? (
        <Pressable style={styles.fab} onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.background} />
        </Pressable>
      ) : null}

      <CollectionFormModal
        visible={formVisible}
        item={editingItem}
        onClose={() => setFormVisible(false)}
        onSaved={(saved) => {
          setItems((current) => {
            const exists = current.some((it) => it.id === saved.id)
            return exists
              ? current.map((it) => (it.id === saved.id ? saved : it))
              : [saved, ...current]
          })
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  summary: {
    color: colors.textMuted,
    fontSize: 13,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  cover: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  coverPlaceholder: {
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
  artist: {
    color: colors.textMuted,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  badge: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.accentMuted,
    overflow: 'hidden',
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  edition: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
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
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
})

import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import BottomNav from '../components/BottomNav'
import CollectionFormModal from '../components/CollectionFormModal'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { CollectionItem, MediaType, PublicCollectionItem } from '../lib/types'

const MEDIA_FILTERS: { value: MediaType | null; label: string }[] = [
  { value: null, label: 'TODOS' },
  { value: 'vinil', label: 'VINIL' },
  { value: 'cd', label: 'CD' },
  { value: 'cassete', label: 'FITA CASSETE' },
  { value: 'digital', label: 'DIGITAL' },
]

const MEDIA_LABELS: Record<MediaType, string> = {
  vinil: 'VINIL',
  cd: 'CD',
  cassete: 'FITA CASSETE',
  digital: 'DIGITAL',
}

const CONDITION_LABELS: Record<CollectionItem['condition'], string> = {
  novo: 'Novo',
  usado: 'Usado',
  desgastado: 'Desgastado',
}

function formatMonthYear(value: string): string {
  const [year, month] = value.split('-')
  if (!year || !month) return value
  return `${month}/${year}`
}

function parsePrice(value: string | null): number {
  if (!value) return 0
  const num = Number(value.replace(',', '.'))
  return Number.isFinite(num) ? num : 0
}

function formatBRL(value: number): string {
  const rounded = Math.round(value)
  const digits = String(Math.abs(rounded))
  const parts: string[] = []
  for (let i = digits.length; i > 0; i -= 3) {
    parts.unshift(digits.slice(Math.max(0, i - 3), i))
  }
  return `${rounded < 0 ? '-' : ''}R$ ${parts.join('.')}`
}

function conditionText(item: CollectionItem): string {
  const parts = [CONDITION_LABELS[item.condition].toUpperCase()]
  if (item.editionNote) parts.push(item.editionNote.toUpperCase())
  return parts.join(' · ')
}

export default function CollectionScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors), [colors])
  const params = useLocalSearchParams<{ userId?: string }>()
  const userId = params.userId
  const isOwn = !userId
  const [items, setItems] = useState<CollectionItem[]>([])
  const [publicItems, setPublicItems] = useState<PublicCollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [mediaFilter, setMediaFilter] = useState<MediaType | null>(null)
  const [formVisible, setFormVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null)
  const [menuItem, setMenuItem] = useState<CollectionItem | null>(null)
  const canGoBack = router.canGoBack()

  const loadItems = useCallback(() => {
    let active = true
    if (isOwn) {
      api
        .myCollection({ mediaType: mediaFilter ?? undefined })
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
  }, [isOwn, userId, mediaFilter])

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

  const openAlbum = (item: CollectionItem | PublicCollectionItem) => {
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

  const ownCount = items.length
  const totalSpent = useMemo(
    () => items.reduce((sum, item) => sum + parsePrice(item.pricePaid), 0),
    [items],
  )

  const renderItem = ({ item }: { item: CollectionItem | PublicCollectionItem }) => {
    const isFull = 'condition' in item
    return (
      <View style={styles.row}>
        <Pressable style={styles.rowMain} onPress={() => openAlbum(item)}>
          <View style={styles.coverFrame}>
            {item.albumArtworkUrl ? (
              <Image source={item.albumArtworkUrl} style={styles.cover} contentFit="cover" transition={150} />
            ) : (
              <View style={styles.cover}>
                <Ionicons name="disc-outline" size={22} color={colors.textMuted} />
              </View>
            )}
          </View>
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
                <Text style={styles.condText} numberOfLines={1}>
                  {conditionText(item)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.rightCol}>
            {isFull && item.pricePaid ? (
              <Text style={styles.price}>{formatBRL(parsePrice(item.pricePaid))}</Text>
            ) : null}
            <Text style={styles.date}>{formatMonthYear(item.acquiredAt)}</Text>
          </View>
        </Pressable>
        {isOwn ? (
          <Pressable onPress={() => setMenuItem(item as CollectionItem)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{isOwn ? 'Minha coleção' : 'Coleção'}</Text>
        </View>
      </View>

      {isOwn && !loading ? (
        <>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>ITENS</Text>
              <Text style={styles.statValue}>{ownCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat, styles.statPadded]}>
              <Text style={styles.statLabel}>GASTO TOTAL</Text>
              <Text style={[styles.statValue, { color: colors.accent }]}>{formatBRL(totalSpent)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat, styles.statPadded]}>
              <Text style={styles.statLabel}>MÉDIA</Text>
              <Text style={styles.statValue}>{ownCount > 0 ? formatBRL(totalSpent / ownCount) : 'R$ 0'}</Text>
            </View>
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
        </>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.center} />
      ) : (
        <FlatList
          data={isOwn ? items : publicItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: isOwn ? 104 : insets.bottom + spacing.lg }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {isOwn
                  ? 'Sua coleção está vazia. Toque no + para adicionar seu primeiro vinil, CD ou fita cassete.'
                  : 'Esta pessoa ainda não adicionou itens à coleção.'}
              </Text>
            </View>
          }
        />
      )}

      {isOwn ? (
        <Pressable style={styles.fab} onPress={openCreate}>
          <Ionicons name="add" size={28} color={colors.accent} />
        </Pressable>
      ) : null}

      {isOwn ? <BottomNav /> : null}

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

      <Modal
        visible={!!menuItem}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuItem(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.scrim} onPress={() => setMenuItem(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {menuItem?.albumTitle}
            </Text>
            <Text style={styles.sheetSubtitle}>{menuItem?.albumArtist}</Text>
            <Pressable
              style={styles.sheetAction}
              onPress={() => {
                const item = menuItem
                setMenuItem(null)
                if (item) openEdit(item)
              }}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.text} />
              <Text style={styles.sheetActionText}>Editar item</Text>
            </Pressable>
            <Pressable
              style={styles.sheetAction}
              onPress={() => {
                const item = menuItem
                setMenuItem(null)
                if (item) handleDelete(item)
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.accent} />
              <Text style={[styles.sheetActionText, { color: colors.accent }]}>Remover da coleção</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setMenuItem(null)}>
              <Text style={styles.sheetCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    headerTitle: {
      fontFamily: fonts.headingRegular,
      fontSize: 32,
      lineHeight: 32,
      color: colors.text,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
    },
    stat: {
      flex: 1,
      paddingLeft: 14,
    },
    statPadded: {
      paddingLeft: 14,
    },
    statLabel: {
      fontFamily: fonts.kicker,
      fontSize: 8,
      letterSpacing: 1.4,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    statValue: {
      fontFamily: fonts.headingRegular,
      fontSize: 22,
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    statDivider: {
      width: 1,
      height: 30,
      backgroundColor: colors.border,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: 13,
      paddingBottom: 2,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 2,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    chipSelected: {
      borderColor: colors.accent,
      backgroundColor: 'transparent',
    },
    chipText: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    chipTextSelected: {
      color: colors.accent,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    coverFrame: {
      width: 60,
      height: 60,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cover: {
      width: 58,
      height: 58,
      borderWidth: 4,
      borderColor: colors.surface,
      backgroundColor: colors.surfaceAlt,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 16,
      lineHeight: 19,
      color: colors.text,
    },
    artist: {
      fontFamily: fonts.body,
      fontSize: 11.5,
      lineHeight: 15,
      color: colors.textMuted,
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    badge: {
      fontFamily: fonts.kicker,
      fontSize: 8,
      letterSpacing: 1,
      color: colors.accent,
      borderWidth: 1,
      borderColor: colors.accent,
      paddingHorizontal: 5,
      paddingVertical: 3,
      borderRadius: 2,
    },
    condText: {
      fontFamily: fonts.kicker,
      fontSize: 8,
      letterSpacing: 1,
      color: colors.textMuted,
      flexShrink: 1,
    },
    rightCol: {
      alignItems: 'flex-end',
    },
    price: {
      fontFamily: fonts.headingRegular,
      fontSize: 16,
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    date: {
      fontFamily: fonts.kicker,
      fontSize: 8,
      color: colors.textMuted,
      marginTop: 5,
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
      bottom: 96,
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    scrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
      marginBottom: spacing.md,
    },
    sheetTitle: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.text,
    },
    sheetSubtitle: {
      fontFamily: fonts.body,
      fontSize: 12.5,
      color: colors.textMuted,
      marginTop: 3,
    },
    sheetAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    sheetActionText: {
      fontSize: 15,
      fontWeight: '600',
    },
    sheetCancel: {
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    sheetCancelText: {
      color: colors.textMuted,
      fontSize: 15,
    },
  })

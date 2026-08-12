import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ListFormModal from '../components/ListFormModal'
import { fonts, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { AlbumListSummary } from '../lib/types'

const COLLAGE_CELLS = 4

export default function ListsScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [lists, setLists] = useState<AlbumListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [createVisible, setCreateVisible] = useState(false)

  const loadLists = useCallback(() => {
    let active = true
    api
      .myLists()
      .then((data) => {
        if (active) setLists(data.lists)
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
  }, [])

  useFocusEffect(loadLists)

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Listas</Text>
          </View>
          <Pressable onPress={() => setCreateVisible(true)} hitSlop={8}>
            <Text style={styles.headerAction}>+ Nova</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => <ListCard item={item} onPress={() => router.push(`/list/${item.id}`)} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Nenhuma lista ainda. Toque em "+ Nova" para criar sua primeira lista temática.
              </Text>
            </View>
          }
        />
      )}

      <ListFormModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onSaved={(created) => {
          setLists((current) => [created, ...current])
        }}
      />
    </View>
  )
}

function ListCard({ item, onPress }: { item: AlbumListSummary; onPress: () => void }) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const covers = useMemo(() => {
    const cells = [...(item.covers ?? [])]
    while (cells.length < COLLAGE_CELLS) cells.push(null)
    return cells.slice(0, COLLAGE_CELLS)
  }, [item.covers])

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.collageFrame}>
        {[0, 1].map((row) => (
          <View key={row} style={styles.collageRow}>
            {[0, 1].map((col) => {
              const cover = covers[row * 2 + col]
              return (
                <View key={col} style={styles.collageCell}>
                  {cover ? (
                    <Image
                      source={cover}
                      style={styles.collageCover}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : null}
                </View>
              )
            })}
          </View>
        ))}
      </View>
      <View style={styles.metaRow}>
        <Ionicons
          name={item.isPublic ? 'globe-outline' : 'lock-closed-outline'}
          size={12}
          color={colors.textMuted}
        />
        <Text style={styles.metaText}>
          {item.isPublic ? 'PÚBLICA' : 'PRIVADA'} · {item.albumCount}
        </Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {item.name}
      </Text>
    </Pressable>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      marginHorizontal: 20,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    headerTitle: {
      fontFamily: fonts.headingRegular,
      color: colors.text,
      fontSize: 32,
      lineHeight: 32,
    },
    headerAction: {
      fontFamily: fonts.kicker,
      color: colors.accent,
      fontSize: 9,
      letterSpacing: 1.4,
      marginBottom: 5,
    },
    loading: {
      flex: 1,
    },
    list: {
      paddingHorizontal: 20,
      paddingTop: 15,
      paddingBottom: spacing.xl,
      rowGap: 16,
      columnGap: 13,
    },
    card: {
      width: '100%',
    },
    collageFrame: {
      width: '100%',
      aspectRatio: 1,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 4,
      gap: 1,
    },
    collageRow: {
      flex: 1,
      flexDirection: 'row',
      gap: 1,
    },
    collageCell: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
    },
    collageCover: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surfaceAlt,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    metaText: {
      fontFamily: fonts.kicker,
      color: colors.textMuted,
      fontSize: 9,
      letterSpacing: 1.2,
    },
    name: {
      fontFamily: fonts.heading,
      color: colors.text,
      fontSize: 16,
      lineHeight: 19,
      marginTop: 4,
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

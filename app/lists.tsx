import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useNavigation } from 'expo-router'
import { useCallback, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import ListFormModal from '../components/ListFormModal'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { AlbumListSummary } from '../lib/types'

export default function ListsScreen() {
  const navigation = useNavigation()
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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setCreateVisible(true)} hitSlop={8}>
          <Ionicons name="add" size={26} color={colors.accent} />
        </Pressable>
      ),
    })
  }, [navigation])

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/list/${item.id}`)}>
              {item.coverArtworkUrl ? (
                <Image
                  source={item.coverArtworkUrl}
                  style={styles.cover}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]}>
                  <Ionicons name="disc-outline" size={28} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Ionicons
                    name={item.isPublic ? 'eye-outline' : 'lock-closed-outline'}
                    size={14}
                    color={colors.textMuted}
                  />
                </View>
                {item.description ? (
                  <Text style={styles.description} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {item.albumCount} álbum{item.albumCount === 1 ? '' : 's'} ·{' '}
                  {item.isPublic ? 'Pública' : 'Privada'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={56} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                Nenhuma lista ainda. Toque no + para criar sua primeira lista temática.
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
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

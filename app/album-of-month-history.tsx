import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { AlbumOfMonth } from '../lib/types'

function formatMonthYear(pick: AlbumOfMonth): string {
  return new Date(pick.year, pick.month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

export default function AlbumOfMonthHistoryScreen() {
  const [items, setItems] = useState<AlbumOfMonth[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(
    useCallback(() => {
      let active = true
      api
        .albumOfMonthHistory()
        .then((data) => {
          if (active) setItems(data.items)
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
    }, []),
  )

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: '/album-of-month',
                params: { id: item.id },
              })
            }
          >
            {item.albumArtworkUrl ? (
              <Image
                source={item.albumArtworkUrl}
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
              <Text style={styles.name} numberOfLines={1}>
                {item.albumTitle}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.albumArtist}
              </Text>
              <Text style={styles.month}>{formatMonthYear(item)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyText}>
              Nenhum álbum do mês definido ainda. Assim que o primeiro for escolhido, ele aparece aqui.
            </Text>
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
    backgroundColor: colors.background,
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
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    color: colors.textMuted,
    fontSize: 13,
  },
  month: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'capitalize',
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

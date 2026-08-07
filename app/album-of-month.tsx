import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import AlbumOfMonthAdminModal from '../components/AlbumOfMonthAdminModal'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { AlbumOfMonth, AlbumOfMonthComment } from '../lib/types'

function formatMonthYear(pick: AlbumOfMonth): string {
  return new Date(pick.year, pick.month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
}

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function nowMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export default function AlbumOfMonthScreen() {
  const { user } = useAuth()
  const params = useLocalSearchParams<{ id?: string }>()
  const pickId = params.id

  const [pick, setPick] = useState<AlbumOfMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<AlbumOfMonthComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [adminModalVisible, setAdminModalVisible] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      const loadPick = pickId ? api.albumOfMonthById(pickId) : api.albumOfMonth()

      loadPick
        .then((data) => {
          if (!active) return
          setPick(data.pick)
          if (data.pick) {
            api
              .albumOfMonthComments(data.pick.id)
              .then((commentsData) => {
                if (active) setComments(commentsData.comments)
              })
              .catch((err) => {
                console.warn(err)
              })
          }
        })
        .catch((err) => {
          if (active) {
            Alert.alert(
              'Erro',
              err instanceof Error ? err.message : 'Não foi possível carregar o álbum do mês.',
            )
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })

      return () => {
        active = false
      }
    }, [pickId]),
  )

  const openAlbum = (album: AlbumOfMonth) => {
    router.push({
      pathname: '/album/[id]',
      params: {
        id: album.albumId,
        title: album.albumTitle,
        artist: album.albumArtist,
        artworkUrl: album.albumArtworkUrl ?? '',
        fromSearch: '1',
      },
    })
  }

  const handlePostComment = async () => {
    const trimmed = commentText.trim()
    if (!pick || !trimmed || posting) return
    setPosting(true)
    try {
      const { comment } = await api.postAlbumOfMonthComment(pick.id, trimmed)
      setComments((current) => [...current, comment])
      setCommentText('')
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível enviar o comentário.')
    } finally {
      setPosting(false)
    }
  }

  const handleAdminSaved = (saved: AlbumOfMonth) => {
    setPick(saved)
    setComments([])
  }

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {pick ? (
          <>
            <Text style={styles.monthLabel}>{formatMonthYear(pick)}</Text>
            <Image
              source={pick.albumArtworkUrl ?? undefined}
              style={styles.cover}
              contentFit="cover"
              transition={200}
            />
            <Text style={styles.title}>{pick.albumTitle}</Text>
            <Text style={styles.artist}>{pick.albumArtist}</Text>

            <Pressable style={styles.openButton} onPress={() => openAlbum(pick)}>
              <Ionicons name="arrow-forward" size={18} color={colors.background} />
              <Text style={styles.openButtonText}>Ver álbum</Text>
            </Pressable>

            <Pressable style={styles.historyLink} onPress={() => router.push('/album-of-month-history')}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.historyLinkText}>Ver álbuns de meses anteriores</Text>
            </Pressable>

            {user?.isAdmin ? (
              <Pressable style={styles.adminButton} onPress={() => setAdminModalVisible(true)}>
                <Ionicons name="create-outline" size={16} color={colors.text} />
                <Text style={styles.adminButtonText}>Definir álbum do mês</Text>
              </Pressable>
            ) : null}

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>
              Discussão{comments.length > 0 ? ` (${comments.length})` : ''}
            </Text>

            {comments.length === 0 ? (
              <Text style={styles.emptyComments}>
                Ninguém comentou ainda. Seja a primeira pessoa a dizer o que achou.
              </Text>
            ) : (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Pressable
                      onPress={() => router.push(`/user/${comment.user.id}`)}
                      hitSlop={6}
                      style={styles.commentAuthorWrap}
                    >
                      {comment.user.avatarUrl ? (
                        <Image
                          source={comment.user.avatarUrl}
                          style={styles.commentAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
                          <Ionicons name="person" size={14} color={colors.textMuted} />
                        </View>
                      )}
                      <Text style={styles.commentAuthor}>
                        {comment.user.name ?? 'Anônimo'}
                      </Text>
                    </Pressable>
                    <Text style={styles.commentDate}>{formatCommentDate(comment.createdAt)}</Text>
                  </View>
                  <Text style={styles.commentText}>{comment.commentText}</Text>
                </View>
              ))
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum álbum definido para este mês ainda.</Text>
            <Pressable style={styles.historyLink} onPress={() => router.push('/album-of-month-history')}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.historyLinkText}>Ver álbuns de meses anteriores</Text>
            </Pressable>
            {user?.isAdmin ? (
              <Pressable style={styles.adminButton} onPress={() => setAdminModalVisible(true)}>
                <Ionicons name="create-outline" size={16} color={colors.text} />
                <Text style={styles.adminButtonText}>Definir álbum do mês</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      {pick ? (
        <View style={styles.commentBar}>
          <TextInput
            style={styles.commentInput}
            placeholder="O que achou do álbum do mês?"
            placeholderTextColor={colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={1000}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!commentText.trim() || posting) && styles.sendButtonDisabled]}
            onPress={handlePostComment}
            disabled={!commentText.trim() || posting}
            hitSlop={6}
          >
            {posting ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={colors.background} />
            )}
          </Pressable>
        </View>
      ) : null}

      <AlbumOfMonthAdminModal
        visible={adminModalVisible}
        currentMonth={nowMonthYear().month}
        currentYear={nowMonthYear().year}
        onClose={() => setAdminModalVisible(false)}
        onSaved={handleAdminSaved}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  monthLabel: {
    color: colors.textMuted,
    fontSize: 14,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  cover: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
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
  openButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  openButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  historyLinkText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  adminButton: {
    alignSelf: 'stretch',
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
  adminButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyComments: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  commentCard: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  commentAuthorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  commentAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAuthor: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  commentDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  commentText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  commentBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
})

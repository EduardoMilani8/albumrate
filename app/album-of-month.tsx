import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { useTheme } from '../lib/theme'
import { api } from '../lib/api'
import type {
  AlbumOfMonth,
  AlbumOfMonthCandidate,
  AlbumOfMonthComment,
  AlbumOfMonthVoteStateResponse,
} from '../lib/types'

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ''
}

function formatMonthYear(month: number, year: number): string {
  return `${monthName(month)} de ${year}`
}

function formatDayMonth(iso: string): string {
  const date = new Date(iso)
  return `${date.getDate()} de ${monthName(date.getMonth() + 1)}`
}

function formatCommentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function formatRating(value: number | null): string {
  return value == null ? '—' : value.toFixed(1)
}

export default function AlbumOfMonthScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const pickId = params.id
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])

  const [pick, setPick] = useState<AlbumOfMonth | null>(null)
  const [top3, setTop3] = useState<AlbumOfMonthCandidate[]>([])
  const [voteState, setVoteState] = useState<AlbumOfMonthVoteStateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<AlbumOfMonthComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  const [selected, setSelected] = useState<string[]>([])
  const [votedAlbumIds, setVotedAlbumIds] = useState<string[]>([])
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setLoading(true)
      setSelected([])

      const loadComments = (album: AlbumOfMonth) => {
        api
          .albumOfMonthComments(album.id)
          .then((commentsData) => {
            if (active) setComments(commentsData.comments)
          })
          .catch((err) => {
            console.warn(err)
          })
      }

      if (pickId) {
        api
          .albumOfMonthById(pickId)
          .then((data) => {
            if (!active) return
            setPick(data.pick)
            setTop3(data.top3)
            if (data.pick) loadComments(data.pick)
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
      }

      Promise.all([api.albumOfMonthVoteState(), api.albumOfMonth()])
        .then(([state, album]) => {
          if (!active) return
          setVoteState(state)
          setVotedAlbumIds(state.upcoming.myVotes)
          setPick(album.pick)
          if (album.pick) loadComments(album.pick)
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

  const candidates = voteState?.upcoming.candidates ?? null
  const isVotingOpen = voteState?.upcoming.status === 'open'
  const isAwaitingReveal = voteState?.current.status === 'awaiting_reveal'
  const results = voteState?.current.results ?? null
  const alreadyVoted = votedAlbumIds.length === 3

  const remaining = useMemo(() => Math.max(0, 3 - selected.length), [selected.length])

  const openAlbum = (album: { albumId: string; albumTitle: string; albumArtist: string; albumArtworkUrl: string | null }) => {
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

  const toggleCandidate = (albumId: string) => {
    if (alreadyVoted) return
    setSelected((current) => {
      if (current.includes(albumId)) {
        return current.filter((id) => id !== albumId)
      }
      if (current.length >= 3) return current
      return [...current, albumId]
    })
  }

  const handleConfirmVote = async () => {
    if (selected.length !== 3 || submitting) return
    setSubmitting(true)
    try {
      const { albumIds } = await api.submitAlbumOfMonthVote(selected)
      setVotedAlbumIds(albumIds)
      setSelected([])
      setConfirmVisible(false)
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível registrar o voto.')
    } finally {
      setSubmitting(false)
    }
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

  if (loading) {
    return <ActivityIndicator color={colors.accent} style={styles.center} />
  }

  const showComments = !!pick

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {isAwaitingReveal ? (
          <View style={styles.revealBanner}>
            <Ionicons name="hourglass-outline" size={28} color={colors.accent} />
            <Text style={styles.revealBannerTitle}>Votação encerrada!</Text>
            <Text style={styles.revealBannerText}>
              A apuração está em andamento. O resultado sai hoje às 8h.
            </Text>
          </View>
        ) : null}

        {isVotingOpen && candidates ? (
          <View style={styles.votingSection}>
            <Text style={styles.votingTitle}>
              Vote no álbum do mês de{' '}
              {voteState
                ? formatMonthYear(voteState.upcoming.targetMonth, voteState.upcoming.targetYear)
                : ''}
            </Text>
            <Text style={styles.votingDeadline}>
              Você pode votar até {voteState ? formatDayMonth(voteState.upcoming.closesAt) : ''} às
              23:59. Escolha 3 álbuns diferentes.
            </Text>

            {alreadyVoted ? (
              <View style={styles.votedCard}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text style={styles.votedTitle}>Seu voto foi registrado!</Text>
                <Text style={styles.votedText}>
                  Você votou em 3 álbuns. O voto é definitivo e não pode ser alterado.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.counterRow}>
                  <Text style={styles.counterText}>
                    Selecionados: {selected.length}/3
                  </Text>
                  <Text style={styles.remainingText}>
                    {remaining > 0 ? `Faltam ${remaining}` : 'Complete o voto'}
                  </Text>
                </View>

                {candidates.length === 0 ? (
                  <Text style={styles.emptyCandidates}>
                    Nenhum álbum foi avaliado este mês ainda, então não há candidatos para votar.
                  </Text>
                ) : (
                  <View style={styles.candidateList}>
                    {candidates.map((candidate) => {
                      const index = selected.indexOf(candidate.albumId)
                      const isSelected = index !== -1
                      return (
                        <Pressable
                          key={candidate.id}
                          style={[styles.candidateRow, isSelected && styles.candidateRowSelected]}
                          onPress={() => toggleCandidate(candidate.albumId)}
                        >
                          <View
                            style={[
                              styles.candidateBadge,
                              isSelected && styles.candidateBadgeSelected,
                            ]}
                          >
                            {isSelected ? (
                              <Text style={styles.candidateBadgeText}>{index + 1}</Text>
                            ) : (
                              <Ionicons name="ellipse-outline" size={18} color={colors.textMuted} />
                            )}
                          </View>
                          <Image
                            source={candidate.albumArtworkUrl ?? undefined}
                            style={styles.candidateCover}
                            contentFit="cover"
                            transition={150}
                          />
                          <View style={styles.candidateInfo}>
                            <Text style={styles.candidateTitle} numberOfLines={1}>
                              {candidate.albumTitle}
                            </Text>
                            <Text style={styles.candidateArtist} numberOfLines={1}>
                              {candidate.albumArtist}
                            </Text>
                            <Text style={styles.candidateMeta}>
                              {candidate.reviewCount}{' '}
                              {candidate.reviewCount === 1 ? 'avaliação' : 'avaliações'} · nota{' '}
                              {formatRating(candidate.averageRating)}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                )}

                <Pressable
                  style={[
                    styles.primaryButton,
                    selected.length !== 3 && styles.primaryButtonDisabled,
                  ]}
                  onPress={() => setConfirmVisible(true)}
                  disabled={selected.length !== 3}
                >
                  <Text style={styles.primaryButtonText}>Confirmar voto</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : !pickId && voteState?.upcoming.status === 'pending' ? (
          <View style={styles.teaserCard}>
            <Ionicons name="megaphone-outline" size={22} color={colors.accent} />
            <View style={styles.teaserInfo}>
              <Text style={styles.teaserTitle}>
                Votação do álbum de{' '}
                {formatMonthYear(voteState.upcoming.targetMonth, voteState.upcoming.targetYear)}
              </Text>
              <Text style={styles.teaserText}>
                Abre dia {formatDayMonth(voteState.upcoming.opensAt)}. Cada pessoa escolhe 3 álbuns e
                o mais votado vira o álbum do mês.
              </Text>
            </View>
          </View>
        ) : null}

        {results && results.length > 0 && !pickId ? (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionLabel}>Resultado da votação</Text>
            {results.map((result) => (
              <Pressable
                key={result.id}
                style={styles.resultRow}
                onPress={() => openAlbum(result)}
              >
                <View
                  style={[
                    styles.rankBadge,
                    result.rank === 1 && styles.rankBadgeFirst,
                  ]}
                >
                  <Text
                    style={[
                      styles.rankBadgeText,
                      result.rank === 1 && styles.rankBadgeTextFirst,
                    ]}
                  >
                    {result.rank}
                  </Text>
                </View>
                <Image
                  source={result.albumArtworkUrl ?? undefined}
                  style={styles.resultCover}
                  contentFit="cover"
                />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {result.albumTitle}
                  </Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>
                    {result.albumArtist}
                  </Text>
                </View>
                <Text style={styles.resultVotes}>
                  {result.votes ?? 0} {result.votes === 1 ? 'voto' : 'votos'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {pick ? (
          <>
            <Text style={styles.monthLabel}>{formatMonthYear(pick.month, pick.year)}</Text>
            <Image
              source={pick.albumArtworkUrl ?? undefined}
              style={styles.cover}
              contentFit="cover"
              transition={200}
            />
            <Text style={styles.title}>{pick.albumTitle}</Text>
            <Text style={styles.artist}>{pick.albumArtist}</Text>
            {pick.votes != null ? (
              <View style={styles.votesBadge}>
                <Ionicons name="trophy" size={14} color={colors.star} />
                <Text style={styles.votesBadgeText}>
                  {pick.votes} {pick.votes === 1 ? 'voto' : 'votos'} · 1º lugar
                </Text>
              </View>
            ) : null}

            <Pressable style={styles.openButton} onPress={() => openAlbum(pick)}>
              <Ionicons name="arrow-forward" size={18} color={colors.background} />
              <Text style={styles.openButtonText}>Ver álbum</Text>
            </Pressable>

            <Pressable
              style={styles.historyLink}
              onPress={() => router.push('/album-of-month-history')}
            >
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.historyLinkText}>Ver álbuns de meses anteriores</Text>
            </Pressable>
          </>
        ) : !pickId && !isVotingOpen ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={56} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              Ainda não há um álbum do mês definido. Participe da próxima votação!
            </Text>
            <Pressable
              style={styles.historyLink}
              onPress={() => router.push('/album-of-month-history')}
            >
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.historyLinkText}>Ver álbuns de meses anteriores</Text>
            </Pressable>
          </View>
        ) : null}

        {top3.length > 0 ? (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionLabel}>Pódio do mês</Text>
            {top3.map((result) => (
              <Pressable
                key={result.id}
                style={styles.resultRow}
                onPress={() => openAlbum(result)}
              >
                <View style={[styles.rankBadge, result.rank === 1 && styles.rankBadgeFirst]}>
                  <Text
                    style={[
                      styles.rankBadgeText,
                      result.rank === 1 && styles.rankBadgeTextFirst,
                    ]}
                  >
                    {result.rank}
                  </Text>
                </View>
                <Image
                  source={result.albumArtworkUrl ?? undefined}
                  style={styles.resultCover}
                  contentFit="cover"
                />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {result.albumTitle}
                  </Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>
                    {result.albumArtist}
                  </Text>
                </View>
                <Text style={styles.resultVotes}>
                  {result.votes ?? 0} {result.votes === 1 ? 'voto' : 'votos'}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {showComments ? (
          <>
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
        ) : null}
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

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="warning-outline" size={36} color={colors.star} />
            <Text style={styles.modalTitle}>Confirmar voto</Text>
            <Text style={styles.modalText}>
              Você está votando em 3 álbuns. Depois de confirmado, o voto é definitivo e não pode ser
              alterado. Confirma?
            </Text>
            <Pressable
              style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={handleConfirmVote}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Sim, confirmar</Text>
              )}
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setConfirmVisible(false)}>
              <Text style={styles.cancelButtonText}>Ainda não</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  content: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  revealBanner: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  revealBannerTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  revealBannerText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  teaserCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teaserInfo: {
    flex: 1,
    gap: 4,
  },
  teaserTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  teaserText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  votingSection: {
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  votingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  votingDeadline: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  remainingText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  candidateList: {
    gap: spacing.sm,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  candidateRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  candidateBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  candidateBadgeSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  candidateBadgeText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  candidateCover: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  candidateInfo: {
    flex: 1,
    gap: 2,
  },
  candidateTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  candidateArtist: {
    color: colors.textMuted,
    fontSize: 12,
  },
  candidateMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  emptyCandidates: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  votedCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.success,
  },
  votedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  votedText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  resultsSection: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  rankBadgeFirst: {
    backgroundColor: colors.star,
  },
  rankBadgeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rankBadgeTextFirst: {
    color: colors.background,
  },
  resultCover: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  resultArtist: {
    color: colors.textMuted,
    fontSize: 12,
  },
  resultVotes: {
    color: colors.textMuted,
    fontSize: 12,
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
  votesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  votesBadgeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
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
  divider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 15,
  },
})

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { MediaCondition, MediaType, Review } from '../lib/types'
import StarRating from './StarRating'

const MEDIA_OPTIONS = [
  { value: 'vinil', label: 'Vinil' },
  { value: 'cd', label: 'CD' },
  { value: 'cassete', label: 'Cassete' },
  { value: 'digital', label: 'Digital' },
] as const

const CONDITION_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'usado', label: 'Usado' },
  { value: 'desgastado', label: 'Desgastado' },
] as const

interface ReviewModalProps {
  visible: boolean
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  albumGenre?: string | null
  albumYear?: number | null
  albumCountry?: string | null
  initialReview: Review | null
  onClose: () => void
  onSaved: (review: Review) => void
  onDeleted: () => void
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseListenedAt(value: string | null | undefined): Date {
  if (!value) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

export default function ReviewModal({
  visible,
  albumId,
  albumTitle,
  albumArtist,
  albumArtworkUrl,
  albumGenre,
  albumYear,
  albumCountry,
  initialReview,
  onClose,
  onSaved,
  onDeleted,
}: ReviewModalProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [rating, setRating] = useState<number | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [listenedAt, setListenedAt] = useState<Date>(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMedia, setHasMedia] = useState(false)
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [mediaQuality, setMediaQuality] = useState<number | null>(null)
  const [editionNote, setEditionNote] = useState('')
  const [mediaCondition, setMediaCondition] = useState<MediaCondition | null>(null)

  const editing = initialReview !== null

  useEffect(() => {
    if (visible) {
      setRating(initialReview?.rating ?? null)
      setReviewText(initialReview?.reviewText ?? '')
      setListenedAt(parseListenedAt(initialReview?.listenedAt))
      setShowPicker(false)
      setError(null)
      setSaving(false)
      setHasMedia(initialReview?.mediaReview != null)
      setMediaType(initialReview?.mediaReview?.mediaType ?? null)
      setMediaQuality(initialReview?.mediaReview?.pressingQualityRating ?? null)
      setEditionNote(initialReview?.mediaReview?.editionNote ?? '')
      setMediaCondition(initialReview?.mediaReview?.condition ?? null)
    }
  }, [visible, initialReview])

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (event.type === 'dismissed') return
    if (date) setListenedAt(date)
  }

  const handleSave = async () => {
    if (rating === null) {
      setError('Escolha uma nota de 0,5 a 5 estrelas.')
      return
    }
    if (hasMedia) {
      if (!mediaType) {
        setError('Escolha o tipo de mídia física.')
        return
      }
      if (mediaQuality === null) {
        setError('Dê uma nota de 1 a 5 para a qualidade do master/prensagem.')
        return
      }
      if (!mediaCondition) {
        setError('Escolha a condição da mídia física.')
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const { review } = await api.saveReview(albumId, {
        rating,
        reviewText: reviewText.trim() || null,
        listenedAt: formatDate(listenedAt),
        albumTitle,
        albumArtist,
        albumArtworkUrl,
        albumGenre: albumGenre ?? null,
        albumYear: albumYear ?? null,
        albumCountry: albumCountry ?? null,
        mediaReview:
          hasMedia && mediaType && mediaQuality !== null && mediaCondition
            ? {
                mediaType,
                pressingQualityRating: mediaQuality,
                editionNote: editionNote.trim() || null,
                condition: mediaCondition,
              }
            : null,
      })
      onSaved(review)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    Alert.alert('Remover avaliação', 'Tem certeza que deseja remover sua avaliação?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteReview(albumId)
            onDeleted()
            onClose()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível remover.')
          }
        },
      },
    ])
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{editing ? 'Editar avaliação' : 'Avaliar álbum'}</Text>

          <View style={styles.ratingRow}>
            <StarRating rating={rating} onChange={setRating} size={36} />
            {rating !== null ? <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text> : null}
          </View>

          <TextInput
            style={styles.input}
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Escreva sua resenha (opcional)"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.sectionLabel}>Quando você ouviu?</Text>
          <Pressable style={styles.dateRow} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateText}>{formatDate(listenedAt)}</Text>
          </Pressable>
          {showPicker && Platform.OS === 'android' ? (
            <DateTimePicker
              value={listenedAt}
              mode="date"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          ) : null}
          {showPicker && Platform.OS === 'ios' ? (
            <View style={styles.iosPicker}>
              <DateTimePicker
                value={listenedAt}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleDateChange}
              />
              <Pressable style={styles.doneButton} onPress={() => setShowPicker(false)}>
                <Text style={styles.doneButtonText}>Concluir</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.mediaSection}>
            <Text style={styles.sectionLabel}>Avaliar mídia física (opcional)</Text>
            <Pressable style={styles.mediaToggle} onPress={() => setHasMedia((value) => !value)}>
              <Ionicons
                name={hasMedia ? 'checkbox' : 'square-outline'}
                size={20}
                color={hasMedia ? colors.accent : colors.textMuted}
              />
              <Text style={styles.mediaToggleText}>Tenho a mídia física deste álbum</Text>
            </Pressable>

            {hasMedia ? (
              <View style={styles.mediaFields}>
                <Text style={styles.subLabel}>Tipo de mídia</Text>
                <View style={styles.chipRow}>
                  {MEDIA_OPTIONS.map((option) => {
                    const selected = mediaType === option.value
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setMediaType(option.value)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>

                <Text style={styles.subLabel}>Qualidade do master/prensagem</Text>
                <View style={styles.qualityRow}>
                  <StarRating
                    rating={mediaQuality}
                    onChange={(value) => setMediaQuality(Math.max(1, value))}
                    size={28}
                  />
                  {mediaQuality !== null ? (
                    <Text style={styles.mediaQualityValue}>{mediaQuality.toFixed(1)}</Text>
                  ) : null}
                </View>

                <TextInput
                  style={styles.editionInput}
                  value={editionNote}
                  onChangeText={setEditionNote}
                  placeholder="Edição/prensagem (ex.: 1ª prensagem 1979, reedição colorida)"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.subLabel}>Condição</Text>
                <View style={styles.chipRow}>
                  {CONDITION_OPTIONS.map((option) => {
                    const selected = mediaCondition === option.value
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.chip, selected && styles.chipSelected]}
                        onPress={() => setMediaCondition(option.value)}
                      >
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.primaryButton} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>{editing ? 'Salvar alterações' : 'Salvar avaliação'}</Text>
            )}
          </Pressable>

          {editing ? (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>Excluir avaliação</Text>
            </Pressable>
          ) : null}

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'flex-end',
    },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  ratingValue: {
    color: colors.star,
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    alignSelf: 'stretch',
    minHeight: 90,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  dateRow: {
    alignSelf: 'stretch',
    height: 44,
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  dateText: {
    color: colors.text,
    fontSize: 15,
  },
  iosPicker: {
    gap: spacing.sm,
  },
  doneButton: {
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  doneButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  mediaSection: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  mediaToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  mediaToggleText: {
    color: colors.text,
    fontSize: 15,
  },
  mediaFields: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  subLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mediaQualityValue: {
    color: colors.star,
    fontSize: 16,
    fontWeight: '700',
  },
  editionInput: {
    alignSelf: 'stretch',
    minHeight: 44,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
  },
  error: {
    color: colors.accent,
    fontSize: 14,
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
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deleteButtonText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
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

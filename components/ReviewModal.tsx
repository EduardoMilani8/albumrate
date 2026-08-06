import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useEffect, useState } from 'react'
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
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { Review } from '../lib/types'
import StarRating from './StarRating'

interface ReviewModalProps {
  visible: boolean
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
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
  initialReview,
  onClose,
  onSaved,
  onDeleted,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [reviewText, setReviewText] = useState('')
  const [listenedAt, setListenedAt] = useState<Date>(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editing = initialReview !== null

  useEffect(() => {
    if (visible) {
      setRating(initialReview?.rating ?? null)
      setReviewText(initialReview?.reviewText ?? '')
      setListenedAt(parseListenedAt(initialReview?.listenedAt))
      setShowPicker(false)
      setError(null)
      setSaving(false)
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

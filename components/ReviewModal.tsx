import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { api } from '../lib/api'
import { useTheme } from '../lib/theme'
import type { MediaCondition, MediaType, Review } from '../lib/types'
import StarRating from './StarRating'

const MEDIA_OPTIONS: { value: MediaType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'vinil', label: 'Vinil', icon: 'disc-outline' },
  { value: 'cd', label: 'CD', icon: 'disc' },
  { value: 'cassete', label: 'Fita cassete', icon: 'albums-outline' },
  { value: 'digital', label: 'Digital', icon: 'cloud-outline' },
]

const CONDITION_OPTIONS: { value: MediaCondition; label: string }[] = [
  { value: 'usado', label: 'Usado' },
  { value: 'novo', label: 'Novo' },
  { value: 'desgastado', label: 'Desgastado' },
]

const PRICE_REGEX = /^\d{1,8}([.,]\d{1,2})?$/

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

function formatDateBR(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day} / ${month} / ${date.getFullYear()}`
}

function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',')
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
  const insets = useSafeAreaInsets()
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
  const [mediaCondition, setMediaCondition] = useState<MediaCondition | null>(null)
  const [pricePaid, setPricePaid] = useState('')

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
      setMediaCondition(initialReview?.mediaReview?.condition ?? null)
      setPricePaid((initialReview?.mediaReview?.pricePaid ?? '').replace('.', ','))
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
        setError('Dê uma nota de 1 a 5 para a qualidade da prensagem.')
        return
      }
      if (!mediaCondition) {
        setError('Escolha a condição da mídia física.')
        return
      }
      const price = pricePaid.trim()
      if (price && !PRICE_REGEX.test(price)) {
        setError('Valor pago inválido.')
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
                condition: mediaCondition,
                pricePaid: pricePaid.trim() || null,
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Pressable onPress={onClose} hitSlop={8} style={styles.headerButton}>
                <Text style={styles.headerCancel}>Cancelar</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Avaliar</Text>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                hitSlop={8}
                style={styles.headerButton}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={styles.headerSave}>Salvar</Text>
                )}
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
            >
              <View style={styles.albumCard}>
                <View style={styles.albumCoverWrap}>
                  {albumArtworkUrl ? (
                    <Image
                      source={albumArtworkUrl}
                      style={styles.albumCover}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.albumCover, styles.albumCoverPlaceholder]} />
                  )}
                </View>
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {albumTitle}
                  </Text>
                  <Text style={styles.albumMeta} numberOfLines={1}>
                    {[albumArtist, albumYear ? String(albumYear) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
              </View>

              <View style={styles.ratingSection}>
                <Text style={styles.ratingHint}>
                  Sua nota — toque na metade para meia estrela
                </Text>
                <View style={styles.ratingStars}>
                  <StarRating rating={rating} onChange={setRating} size={38} />
                </View>
                <Text style={styles.ratingValue}>
                  {rating !== null ? `${formatRating(rating)} / 5` : '— / 5'}
                </Text>
              </View>

              <View style={styles.dateRow}>
                <Text style={styles.rowLabel}>Ouvi em</Text>
                <Pressable style={styles.dateButton} onPress={() => setShowPicker(true)}>
                  <Ionicons name="calendar-outline" size={15} color={colors.accent} />
                  <Text style={styles.dateText}>{formatDateBR(listenedAt)}</Text>
                </Pressable>
              </View>
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

              <TextInput
                style={styles.reviewInput}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Escreve aí. Ninguém precisa de resenha bonita — só da tua."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.mediaSection}>
                <View style={styles.mediaHeader}>
                  <Text style={styles.mediaLabel}>Mídia física · opcional</Text>
                  <Switch
                    value={hasMedia}
                    onValueChange={setHasMedia}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={hasMedia ? colors.text : colors.surfaceAlt}
                  />
                </View>

                {hasMedia ? (
                  <View style={styles.mediaFields}>
                    <View style={styles.segRow}>
                      {MEDIA_OPTIONS.map((option) => {
                        const selected = mediaType === option.value
                        return (
                          <Pressable
                            key={option.value}
                            style={[styles.segCell, selected && styles.segCellSelected]}
                            onPress={() => setMediaType(option.value)}
                          >
                            <Ionicons
                              name={option.icon}
                              size={18}
                              color={selected ? colors.accent : colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.segCellText,
                                selected && styles.segCellTextSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </Pressable>
                        )
                      })}
                    </View>

                    <View style={styles.mediaRow}>
                      <Text style={styles.rowLabel}>Qualidade da prensagem</Text>
                      <StarRating
                        rating={mediaQuality}
                        onChange={(value) => setMediaQuality(Math.max(1, value))}
                        size={13}
                      />
                    </View>

                    <View style={styles.mediaRow}>
                      <Text style={styles.rowLabel}>Condição</Text>
                      <View style={styles.conditionRow}>
                        {CONDITION_OPTIONS.map((option) => {
                          const selected = mediaCondition === option.value
                          return (
                            <Pressable
                              key={option.value}
                              style={[
                                styles.conditionTag,
                                selected && styles.conditionTagSelected,
                              ]}
                              onPress={() => setMediaCondition(option.value)}
                            >
                              <Text
                                style={[
                                  styles.conditionTagText,
                                  selected && styles.conditionTagTextSelected,
                                ]}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    </View>

                    <View style={styles.mediaRow}>
                      <Text style={styles.rowLabel}>Paguei</Text>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceSymbol}>R$</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={pricePaid}
                          onChangeText={setPricePaid}
                          keyboardType="decimal-pad"
                          placeholder="0,00"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>

              {editing ? (
                <Pressable style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>Excluir avaliação</Text>
                </Pressable>
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    sheetWrapper: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '92%',
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      opacity: 0.5,
      alignSelf: 'center',
      marginTop: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
    },
    headerButton: {
      minWidth: 72,
    },
    headerCancel: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1.4,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    headerTitle: {
      fontFamily: fonts.heading,
      fontSize: 19,
      color: colors.text,
    },
    headerSave: {
      fontFamily: fonts.kicker,
      fontSize: 10,
      letterSpacing: 1.4,
      color: colors.accent,
      textTransform: 'uppercase',
      textAlign: 'right',
    },
    albumCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    albumCoverWrap: {
      width: 60,
      height: 60,
      padding: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    albumCover: {
      width: '100%',
      height: '100%',
      borderRadius: 2,
    },
    albumCoverPlaceholder: {
      backgroundColor: colors.surfaceAlt,
    },
    albumInfo: {
      flex: 1,
      minWidth: 0,
    },
    albumTitle: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.text,
    },
    albumMeta: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    ratingSection: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ratingHint: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.6,
      color: colors.textMuted,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: 14,
    },
    ratingStars: {
      flexDirection: 'row',
    },
    ratingValue: {
      fontFamily: fonts.headingRegular,
      fontSize: 30,
      color: colors.accent,
      marginTop: 12,
      fontVariant: ['tabular-nums'],
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    dateText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.text,
    },
    iosPicker: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
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
    reviewInput: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      fontFamily: fonts.italic,
      fontSize: 14.5,
      lineHeight: 23,
      color: colors.text,
      minHeight: 64,
    },
    mediaSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    mediaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    mediaLabel: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.accent,
      textTransform: 'uppercase',
    },
    mediaFields: {
      gap: 0,
    },
    segRow: {
      flexDirection: 'row',
      gap: 7,
      marginBottom: 13,
    },
    segCell: {
      flex: 1,
      height: 56,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    segCellSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceAlt,
    },
    segCellText: {
      fontFamily: fonts.kicker,
      fontSize: 8.5,
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    segCellTextSelected: {
      color: colors.accent,
    },
    mediaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.md,
    },
    conditionRow: {
      flexDirection: 'row',
      gap: 6,
    },
    conditionTag: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 2,
    },
    conditionTagSelected: {
      borderColor: colors.accent,
    },
    conditionTagText: {
      fontFamily: fonts.kicker,
      fontSize: 9,
      letterSpacing: 1,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    conditionTagTextSelected: {
      color: colors.accent,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    priceSymbol: {
      fontFamily: fonts.headingRegular,
      fontSize: 17,
      color: colors.textMuted,
    },
    priceInput: {
      fontFamily: fonts.headingRegular,
      fontSize: 17,
      color: colors.accent,
      minWidth: 80,
      textAlign: 'right',
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    deleteButton: {
      alignSelf: 'center',
      paddingVertical: spacing.md,
    },
    deleteButtonText: {
      color: colors.accent,
      fontSize: 14,
      fontFamily: fonts.kicker,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    error: {
      color: colors.accent,
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
  })

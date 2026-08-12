import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import { searchAlbums } from '../lib/spotify'
import type { CollectionItem, MediaCondition, MediaType, SpotifyAlbumResult } from '../lib/types'
import { useTheme } from '../lib/theme'

const MEDIA_OPTIONS = [
  { value: 'vinil', label: 'Vinil' },
  { value: 'cd', label: 'CD' },
  { value: 'cassete', label: 'Fita cassete' },
  { value: 'digital', label: 'Digital' },
] as const

const CONDITION_OPTIONS = [
  { value: 'novo', label: 'Novo' },
  { value: 'usado', label: 'Usado' },
  { value: 'desgastado', label: 'Desgastado' },
] as const

interface CollectionFormModalProps {
  visible: boolean
  item?: CollectionItem | null
  onClose: () => void
  onSaved: (item: CollectionItem) => void
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseAcquiredAt(value: string | null | undefined): Date {
  if (!value) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return new Date()
  return new Date(year, month - 1, day)
}

export default function CollectionFormModal({
  visible,
  item,
  onClose,
  onSaved,
}: CollectionFormModalProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const editing = item !== null && item !== undefined
  const [album, setAlbum] = useState<SpotifyAlbumResult | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyAlbumResult[]>([])
  const [searching, setSearching] = useState(false)
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [editionNote, setEditionNote] = useState('')
  const [condition, setCondition] = useState<MediaCondition | null>(null)
  const [pricePaid, setPricePaid] = useState('')
  const [acquiredAt, setAcquiredAt] = useState<Date>(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      setAlbum(
        item
          ? {
              id: item.albumId,
              title: item.albumTitle,
              artist: item.albumArtist,
              artworkUrl: item.albumArtworkUrl,
              releaseDate: null,
              genre: null,
            }
          : null,
      )
      setQuery('')
      setResults([])
      setMediaType(item?.mediaType ?? null)
      setEditionNote(item?.editionNote ?? '')
      setCondition(item?.condition ?? null)
      setPricePaid(item?.pricePaid ?? '')
      setAcquiredAt(parseAcquiredAt(item?.acquiredAt))
      setShowPicker(false)
      setSaving(false)
      setError(null)
    }
  }, [visible, item])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!visible || editing) return
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    timerRef.current = setTimeout(() => {
      searchAlbums(trimmed)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query, visible, editing])

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false)
    if (event.type === 'dismissed') return
    if (date) setAcquiredAt(date)
  }

  const handleSave = async () => {
    if (!album) {
      setError('Busque e selecione um álbum.')
      return
    }
    if (!mediaType) {
      setError('Escolha o tipo de mídia.')
      return
    }
    if (!condition) {
      setError('Escolha a condição da mídia.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const base = {
        mediaType,
        editionNote: editionNote.trim() || null,
        condition,
        pricePaid: pricePaid.trim() || null,
        acquiredAt: formatDate(acquiredAt),
      }
      const { item: saved } = editing
        ? await api.updateCollectionItem(item!.id, base)
        : await api.createCollectionItem({
            ...base,
            albumId: album.id,
            albumTitle: album.title,
            albumArtist: album.artist,
            albumArtworkUrl: album.artworkUrl,
          })
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {editing ? 'Editar item' : 'Adicionar à coleção'}
          </Text>

          {!editing ? (
            <View style={styles.searchSection}>
              <View style={styles.inputRow}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar álbum ou artista"
                  placeholderTextColor={colors.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {searching ? (
                <ActivityIndicator color={colors.accent} style={styles.searching} />
              ) : results.length > 0 ? (
                <View style={styles.results}>
                  {results.slice(0, 5).map((result) => {
                    const selected = album?.id === result.id
                    return (
                      <Pressable
                        key={result.id}
                        style={[styles.resultRow, selected && styles.resultRowSelected]}
                        onPress={() => setAlbum(result)}
                      >
                        <Image
                          source={result.artworkUrl ?? undefined}
                          style={styles.resultCover}
                          contentFit="cover"
                        />
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultTitle} numberOfLines={1}>
                            {result.title}
                          </Text>
                          <Text style={styles.resultArtist} numberOfLines={1}>
                            {result.artist}
                          </Text>
                        </View>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                          size={22}
                          color={selected ? colors.accent : colors.textMuted}
                        />
                      </Pressable>
                    )
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

          {album ? (
            <View style={styles.albumPill}>
              <Image source={album.artworkUrl ?? undefined} style={styles.albumCover} contentFit="cover" />
              <View style={styles.albumInfo}>
                <Text style={styles.albumTitle} numberOfLines={1}>
                  {album.title}
                </Text>
                <Text style={styles.albumArtist} numberOfLines={1}>
                  {album.artist}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.hint}>Busque o álbum que você possui para começar.</Text>
          )}

          <Text style={styles.sectionLabel}>Tipo de mídia</Text>
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

          <TextInput
            style={styles.editionInput}
            value={editionNote}
            onChangeText={setEditionNote}
            placeholder="Edição/prensagem (ex.: 1ª prensagem, reedição colorida)"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />

          <Text style={styles.sectionLabel}>Condição</Text>
          <View style={styles.chipRow}>
            {CONDITION_OPTIONS.map((option) => {
              const selected = condition === option.value
              return (
                <Pressable
                  key={option.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setCondition(option.value)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <TextInput
            style={styles.priceInput}
            value={pricePaid}
            onChangeText={setPricePaid}
            placeholder="Valor pago (opcional, ex.: 149,90)"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            maxLength={12}
          />

          <Text style={styles.sectionLabel}>Quando você adquiriu?</Text>
          <Pressable style={styles.dateRow} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateText}>{formatDate(acquiredAt)}</Text>
          </Pressable>
          {showPicker && Platform.OS === 'android' ? (
            <DateTimePicker
              value={acquiredAt}
              mode="date"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          ) : null}
          {showPicker && Platform.OS === 'ios' ? (
            <View style={styles.iosPicker}>
              <DateTimePicker
                value={acquiredAt}
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
              <Text style={styles.primaryButtonText}>
                {editing ? 'Salvar alterações' : 'Adicionar à coleção'}
              </Text>
            )}
          </Pressable>

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
  searchSection: {
    gap: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  searching: {
    paddingVertical: spacing.sm,
  },
  results: {
    maxHeight: 240,
    gap: spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  resultRowSelected: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  resultCover: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  resultInfo: {
    flex: 1,
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
  albumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  albumCover: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  albumInfo: {
    flex: 1,
  },
  albumTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  albumArtist: {
    color: colors.textMuted,
    fontSize: 12,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xs,
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
  priceInput: {
    alignSelf: 'stretch',
    height: 44,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 15,
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

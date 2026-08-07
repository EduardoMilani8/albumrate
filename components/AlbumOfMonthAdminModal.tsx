import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import { searchAlbums } from '../lib/spotify'
import type { AlbumOfMonth, SpotifyAlbumResult } from '../lib/types'

interface AlbumOfMonthAdminModalProps {
  visible: boolean
  currentMonth: number
  currentYear: number
  onClose: () => void
  onSaved: (pick: AlbumOfMonth) => void
}

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

export default function AlbumOfMonthAdminModal({
  visible,
  currentMonth,
  currentYear,
  onClose,
  onSaved,
}: AlbumOfMonthAdminModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyAlbumResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SpotifyAlbumResult | null>(null)
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      setQuery('')
      setResults([])
      setSelected(null)
      setMonth(currentMonth)
      setYear(currentYear)
      setSaving(false)
      setError(null)
    }
  }, [visible, currentMonth, currentYear])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearching(false)
      setError(null)
      return
    }
    setSearching(true)
    setError(null)
    timerRef.current = setTimeout(() => {
      searchAlbums(trimmed)
        .then(setResults)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Não foi possível buscar. Tente novamente.'),
        )
        .finally(() => setSearching(false))
    }, 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [query])

  const changeMonth = (delta: number) => {
    let newMonth = month + delta
    let newYear = year
    if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    } else if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    }
    setMonth(newMonth)
    setYear(newYear)
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const { pick } = await api.setAlbumOfMonth({
        albumId: selected.id,
        albumTitle: selected.title,
        albumArtist: selected.artist,
        albumArtworkUrl: selected.artworkUrl,
        month,
        year,
      })
      onSaved(pick)
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
          <Text style={styles.title}>Definir álbum do mês</Text>

          <View style={styles.inputRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.input}
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

          <View style={styles.resultsBox}>
            {searching ? (
              <ActivityIndicator color={colors.accent} style={styles.centerBox} />
            ) : error ? (
              <View style={styles.centerBox}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const active = selected?.id === item.id
                  return (
                    <Pressable style={styles.resultRow} onPress={() => setSelected(item)}>
                      <Image
                        source={item.artworkUrl ?? undefined}
                        style={styles.cover}
                        contentFit="cover"
                        transition={150}
                      />
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.resultSubtitle} numberOfLines={1}>
                          {item.artist}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={active ? colors.accent : colors.textMuted}
                      />
                    </Pressable>
                  )
                }}
                ListEmptyComponent={
                  query.trim() ? null : (
                    <View style={styles.centerBox}>
                      <Text style={styles.hint}>Busque um álbum para escolher.</Text>
                    </View>
                  )
                }
              />
            )}
          </View>

          <View style={styles.monthRow}>
            <Pressable style={styles.stepButton} onPress={() => changeMonth(-1)} hitSlop={6}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Text style={styles.monthLabel}>
              {MONTH_NAMES[month - 1]} de {year}
            </Text>
            <Pressable style={styles.stepButton} onPress={() => changeMonth(1)} hitSlop={6}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>

          {selected ? (
            <Text style={styles.selectedInfo} numberOfLines={1}>
              {selected.title} — {selected.artist}
            </Text>
          ) : null}

          <Pressable
            style={[styles.primaryButton, (!selected || saving) && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={!selected || saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Salvar álbum do mês</Text>
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
    maxHeight: '90%',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  resultsBox: {
    maxHeight: 280,
    minHeight: 120,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
  },
  error: {
    color: colors.accent,
    fontSize: 14,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  resultSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  selectedInfo: {
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
    opacity: 0.5,
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

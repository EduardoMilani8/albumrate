import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api } from '../lib/api'
import type { AlbumListSummary } from '../lib/types'

interface ListFormModalProps {
  visible: boolean
  list?: AlbumListSummary | null
  onClose: () => void
  onSaved: (list: AlbumListSummary) => void
}

export default function ListFormModal({
  visible,
  list,
  onClose,
  onSaved,
}: ListFormModalProps) {
  const editing = list !== null && list !== undefined
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setName(list?.name ?? '')
      setDescription(list?.description ?? '')
      setIsPublic(list?.isPublic ?? false)
      setError(null)
      setSaving(false)
    }
  }, [visible, list])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Dê um nome para a lista.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: trimmed,
        description: description.trim() || null,
        isPublic,
      }
      const { list: saved } = editing
        ? await api.updateList(list.id, payload)
        : await api.createList(payload)
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
            {editing ? 'Editar lista' : 'Nova lista'}
          </Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nome da lista"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />

          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Descrição (opcional)"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />

          <Pressable style={styles.toggle} onPress={() => setIsPublic((value) => !value)}>
            <Ionicons
              name={isPublic ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={isPublic ? colors.accent : colors.textMuted}
            />
            <View style={styles.toggleTextBlock}>
              <Text style={styles.toggleTitle}>
                {isPublic ? 'Lista pública' : 'Lista privada'}
              </Text>
              <Text style={styles.toggleHint}>
                {isPublic
                  ? 'Qualquer pessoa poderá ver esta lista.'
                  : 'Só você vê esta lista.'}
              </Text>
            </View>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={styles.primaryButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {editing ? 'Salvar alterações' : 'Criar lista'}
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
  input: {
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
  textArea: {
    alignSelf: 'stretch',
    minHeight: 80,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: 15,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  toggleTextBlock: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    color: colors.text,
    fontSize: 15,
  },
  toggleHint: {
    color: colors.textMuted,
    fontSize: 12,
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

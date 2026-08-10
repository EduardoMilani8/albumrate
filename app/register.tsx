import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { Link, router } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { useTheme } from '../lib/theme'
import { useAuth } from '../lib/auth'
import { useSpotifySignIn } from '../lib/useSpotifySignIn'

export default function RegisterScreen() {
  const { signUp } = useAuth()
  const { run: runSpotifySignIn } = useSpotifySignIn()
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [spotifyLoading, setSpotifyLoading] = useState(false)

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.')
      return
    }
    if (password.length < 6) {
      setError('A senha precisa de pelo menos 6 caracteres.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signUp(email.trim(), password, name.trim() || undefined)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível cadastrar.')
    } finally {
      setLoading(false)
    }
  }

  const handleSpotify = async () => {
    setError(null)
    setSpotifyLoading(true)
    try {
      const ok = await runSpotifySignIn()
      if (ok) router.replace('/spotify-onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar com o Spotify.')
    } finally {
      setSpotifyLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Ionicons name="disc" size={56} color={colors.accent} />
        <Text style={styles.title}>Criar conta</Text>

        <Pressable style={styles.spotifyButton} onPress={handleSpotify} disabled={spotifyLoading}>
          {spotifyLoading ? (
            <ActivityIndicator color={colors.spotify} />
          ) : (
            <>
              <FontAwesome5 name="spotify" size={20} color={colors.onSpotify} />
              <Text style={styles.spotifyButtonText}>Criar conta com Spotify</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Nome (opcional)"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="E-mail"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Senha (mínimo 6 caracteres)"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Cadastrar</Text>
          )}
        </Pressable>

        <Link href="/login" style={styles.link}>
          <Text style={styles.linkText}>Já tem conta? Entre</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  spotifyButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 500,
    backgroundColor: colors.spotify,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  spotifyButtonText: {
    color: colors.onSpotify,
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  input: {
    alignSelf: 'stretch',
    height: 48,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  error: {
    alignSelf: 'stretch',
    color: colors.accent,
    fontSize: 14,
  },
  button: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.textMuted,
    fontSize: 14,
  },
})

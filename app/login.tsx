import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { Link, router } from 'expo-router'
import { useState } from 'react'
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
import { colors, radius, spacing } from '../constants/theme'
import { useAuth } from '../lib/auth'
import { useSpotifySignIn } from '../lib/useSpotifySignIn'

export default function LoginScreen() {
  const { signIn } = useAuth()
  const { run: runSpotifySignIn } = useSpotifySignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [spotifyLoading, setSpotifyLoading] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      router.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
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
        <Text style={styles.title}>albumrate</Text>
        <Text style={styles.subtitle}>Entre para avaliar seus álbuns</Text>

        <Pressable style={styles.spotifyButton} onPress={handleSpotify} disabled={spotifyLoading}>
          {spotifyLoading ? (
            <ActivityIndicator color={colors.spotify} />
          ) : (
            <>
              <FontAwesome5 name="spotify" size={20} color="#191414" />
              <Text style={styles.spotifyButtonText}>Entrar com Spotify</Text>
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
          placeholder="Senha"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>

        <Link href="/register" style={styles.link}>
          <Text style={styles.linkText}>Não tem conta? Cadastre-se</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
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
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
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
    color: '#191414',
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

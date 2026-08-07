import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useAuth } from './auth'

export function useSpotifySignIn() {
  const { signInWithSpotify, resolveSpotifyConflict } = useAuth()

  const run = useCallback(async (): Promise<boolean> => {
    const result = await signInWithSpotify()
    if (result.ok) return true
    if (result.cancelled) return false

    const existing = result.existingUser?.email ?? result.existingUser?.name
    const finish = async (linkMode: 'link' | 'new') => {
      try {
        await resolveSpotifyConflict(result.pendingLinkToken, linkMode)
        return true
      } catch (err) {
        Alert.alert('Erro', err instanceof Error ? err.message : 'Não foi possível vincular.')
        return false
      }
    }
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Conta existente encontrada',
        `Já existe uma conta local${existing ? ` para ${existing}` : ''}. Quer vincular sua conta do Spotify a ela?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Criar conta nova',
            style: 'destructive',
            onPress: () => {
              finish('new').then(resolve)
            },
          },
          {
            text: 'Vincular',
            onPress: () => {
              finish('link').then(resolve)
            },
          },
        ],
      )
    })
  }, [signInWithSpotify, resolveSpotifyConflict])

  return { run }
}

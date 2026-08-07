import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { api, ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { SpotifyRecentAlbum, SpotifyTopArtist } from '../lib/types'
import { useSpotifySignIn } from '../lib/useSpotifySignIn'

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export default function SpotifyOnboardingScreen() {
  const { user, refreshUser } = useAuth()
  const { run: runSpotifySignIn } = useSpotifySignIn()
  const [step, setStep] = useState(0)
  const [finished, setFinished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reconnectNeeded, setReconnectNeeded] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [topArtists, setTopArtists] = useState<SpotifyTopArtist[]>([])
  const [recentAlbums, setRecentAlbums] = useState<SpotifyRecentAlbum[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set())
  const [importingRecent, setImportingRecent] = useState(false)
  const [importingSaved, setImportingSaved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const genreCandidates = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    for (const artist of topArtists) {
      for (const genre of artist.genres ?? []) {
        const trimmed = genre.trim()
        if (!trimmed) continue
        const key = trimmed.toLowerCase()
        const existing = counts.get(key)
        if (existing) {
          existing.count += 1
        } else {
          counts.set(key, { label: trimmed, count: 1 })
        }
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 15)
  }, [topArtists])

  useEffect(() => {
    if (selectedGenres.size === 0 && genreCandidates.length > 0) {
      setSelectedGenres(new Set(genreCandidates.slice(0, 5).map((genre) => genre.label.toLowerCase())))
    }
  }, [genreCandidates, selectedGenres.size])

  const loadData = useCallback(async () => {
    setLoading(true)
    setReconnectNeeded(false)
    try {
      const [recent, top] = await Promise.all([
        api.spotifyRecentlyPlayed(),
        api.spotifyTopArtists(),
      ])
      setRecentAlbums(recent.albums)
      setTopArtists(top.artists)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'spotify_reconnect_required') {
        setReconnectNeeded(true)
      } else {
        console.warn(err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleReconnect = async () => {
    setReconnecting(true)
    try {
      const ok = await runSpotifySignIn()
      if (ok) await loadData()
    } catch (err) {
      console.warn(err)
    } finally {
      setReconnecting(false)
    }
  }

  const toggleAlbum = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGenre = (key: string) => {
    setSelectedGenres((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else {
        if (next.size >= 5) return current
        next.add(key)
      }
      return next
    })
  }

  const handleContinue = async () => {
    if (topArtists.length > 0) {
      try {
        await api.updateFavoriteGenres([...selectedGenres])
        await refreshUser()
      } catch (err) {
        console.warn(err)
      }
    }
    setStep(1)
  }

  const handleImportRecent = async () => {
    if (selected.size === 0) return
    setImportingRecent(true)
    setMessage(null)
    try {
      const result = await api.importRecentlyPlayed([...selected])
      setMessage(`${result.imported} álbum(ns) adicionado(s) ao seu diário de escuta.`)
      setStep(2)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'spotify_reconnect_required') {
        setReconnectNeeded(true)
      } else {
        setMessage('Não foi possível importar. Tente novamente.')
      }
    } finally {
      setImportingRecent(false)
    }
  }

  const handleImportSaved = async () => {
    setImportingSaved(true)
    setMessage(null)
    try {
      const result = await api.importSavedAlbums()
      setMessage(
        result.imported > 0
          ? `${result.imported} álbum(ns) salvos adicionados à lista "Importado do Spotify".`
          : 'Nenhum álbum novo para importar.',
      )
      setFinished(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'spotify_reconnect_required') {
        setReconnectNeeded(true)
      } else {
        setMessage('Não foi possível importar. Tente novamente.')
      }
    } finally {
      setImportingSaved(false)
    }
  }

  if (finished) {
    return (
      <View style={styles.contentCenter}>
        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        <Text style={styles.title}>Tudo pronto!</Text>
        {message ? <Text style={styles.subtitle}>{message}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/')}>
          <Text style={styles.primaryButtonText}>Começar a usar</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[styles.dot, index === step ? styles.dotActive : null]}
          />
        ))}
      </View>

      {reconnectNeeded ? (
        <View style={styles.contentCenter}>
          <FontAwesome5 name="spotify" size={56} color={colors.spotify} />
          <Text style={styles.title}>Conexão com o Spotify expirada</Text>
          <Text style={styles.subtitle}>Reconecte sua conta para importar seus dados.</Text>
          <Pressable
            style={styles.spotifyButton}
            onPress={handleReconnect}
            disabled={reconnecting}
          >
            {reconnecting ? (
              <ActivityIndicator color="#191414" />
            ) : (
              <>
                <FontAwesome5 name="spotify" size={20} color="#191414" />
                <Text style={styles.spotifyButtonText}>Reconectar Spotify</Text>
              </>
            )}
          </Pressable>
          <Pressable style={styles.skipButton} onPress={() => router.replace('/')}>
            <Text style={styles.skipButtonText}>Pular por enquanto</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={styles.contentCenter}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : step === 0 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.avatar}>
            {user?.avatarUrl ? (
              <Image source={user.avatarUrl} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <FontAwesome5 name="spotify" size={40} color={colors.spotify} />
            )}
          </View>
          <Text style={styles.title}>Conectado com sucesso!</Text>
          <Text style={styles.subtitle}>
            {user?.name ?? 'Conta do Spotify'}
            {user?.country ? ` · ${user.country}` : ''}
          </Text>

          {topArtists.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seus artistas favoritos</Text>
              <View style={styles.chips}>
                {topArtists.slice(0, 12).map((artist) => (
                  <View key={artist.id} style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>
                      {artist.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {genreCandidates.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gêneros favoritos</Text>
              <Text style={styles.sectionHint}>
                Detectamos os gêneros dos seus artistas. Toque para escolher até 5.
              </Text>
              <View style={styles.chips}>
                {genreCandidates.map((genre) => {
                  const active = selectedGenres.has(genre.label.toLowerCase())
                  return (
                    <Pressable
                      key={genre.label.toLowerCase()}
                      onPress={() => toggleGenre(genre.label.toLowerCase())}
                      style={[styles.chip, active ? styles.genreChipActive : null]}
                    >
                      <Text
                        style={[styles.chipText, active ? styles.genreChipTextActive : null]}
                        numberOfLines={1}
                      >
                        {genre.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}

          <Pressable style={styles.primaryButton} onPress={handleContinue}>
            <Text style={styles.primaryButtonText}>Continuar</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={() => router.replace('/')}>
            <Text style={styles.skipButtonText}>Pular</Text>
          </Pressable>
        </ScrollView>
      ) : step === 1 ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Importar seus últimos álbuns ouvidos?</Text>
          <Text style={styles.subtitle}>
            Selecione os álbuns detectados nas suas faixas recentes para registrar no seu diário
            de escuta.
          </Text>

          {recentAlbums.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="headset-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum álbum recente encontrado no Spotify.</Text>
            </View>
          ) : (
            recentAlbums.map((album) => (
              <Pressable
                key={album.albumId}
                style={styles.albumRow}
                onPress={() => toggleAlbum(album.albumId)}
              >
                <Image
                  source={album.artworkUrl ?? undefined}
                  style={styles.albumCover}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={1}>
                    {album.title}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {album.artist}
                  </Text>
                  <Text style={styles.albumDate}>Ouvido em {formatDate(album.lastPlayedAt)}</Text>
                </View>
                <Ionicons
                  name={selected.has(album.albumId) ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={selected.has(album.albumId) ? colors.accent : colors.textMuted}
                />
              </Pressable>
            ))
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            style={[
              styles.primaryButton,
              (selected.size === 0 || importingRecent) ? styles.buttonDisabled : null,
            ]}
            disabled={selected.size === 0 || importingRecent}
            onPress={handleImportRecent}
          >
            {importingRecent ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>
                Importar selecionados ({selected.size})
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.skipButton} onPress={() => setStep(2)}>
            <Text style={styles.skipButtonText}>Pular</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Ionicons name="albums-outline" size={48} color={colors.spotify} />
          <Text style={styles.title}>Importar álbuns salvos do Spotify?</Text>
          <Text style={styles.subtitle}>
            Criaremos a lista "Importado do Spotify" com os álbuns da sua biblioteca salva. Você
            pode organizar depois nas suas listas.
          </Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            style={[styles.primaryButton, importingSaved ? styles.buttonDisabled : null]}
            disabled={importingSaved}
            onPress={handleImportSaved}
          >
            {importingSaved ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Importar álbuns salvos</Text>
            )}
          </Pressable>
          <Pressable style={styles.skipButton} onPress={() => router.replace('/')}>
            <Text style={styles.skipButtonText}>Pular</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
    alignItems: 'center',
  },
  contentCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  section: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    maxWidth: '45%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 500,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  genreChipActive: {
    backgroundColor: colors.spotify,
    borderColor: colors.spotify,
  },
  genreChipTextActive: {
    color: '#191414',
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  albumCover: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  albumInfo: {
    flex: 1,
    gap: 2,
  },
  albumTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  albumArtist: {
    color: colors.textMuted,
    fontSize: 13,
  },
  albumDate: {
    color: colors.textMuted,
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  message: {
    alignSelf: 'stretch',
    color: colors.success,
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  skipButton: {
    alignSelf: 'stretch',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
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
    marginTop: spacing.md,
  },
  spotifyButtonText: {
    color: '#191414',
    fontSize: 16,
    fontWeight: '700',
  },
})

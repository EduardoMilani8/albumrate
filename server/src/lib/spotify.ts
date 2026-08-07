import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { users } from '../schema.js'

export const SPOTIFY_SCOPES =
  'user-read-email user-read-private user-top-read user-read-recently-played user-library-read user-follow-read'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_URL = 'https://api.spotify.com/v1'

export class SpotifyError extends Error {
  status: number
  code: string

  constructor(status: number, message: string, code = 'spotify_api_error') {
    super(message)
    this.status = status
    this.code = code
  }
}

export class SpotifyReconnectRequiredError extends SpotifyError {
  constructor(message = 'A conexão com o Spotify expirou. Reconecte para continuar.') {
    super(401, message, 'spotify_reconnect_required')
  }
}

function encryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('TOKEN_ENCRYPTION_KEY não definida no servidor.')
  }
  const key = Buffer.from(raw, 'hex')
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes).')
  }
  return key
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptSecret(payload: string): string {
  const [iv, tag, encrypted] = payload.split('.')
  if (!iv || !tag || !encrypted) {
    throw new Error('Segredo criptografado inválido.')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString(
    'utf8',
  )
}

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new SpotifyError(
      500,
      'Spotify não configurado no servidor.',
      'spotify_not_configured',
    )
  }
  return { clientId, clientSecret }
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

async function fetchSpotifyToken(form: Record<string, string>): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret } = clientCredentials()
  const body = new URLSearchParams(form).toString()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body,
  })
  const data = (await response.json().catch(() => null)) as SpotifyTokenResponse | null
  if (!response.ok) {
    throw new SpotifyError(
      response.status,
      'Não foi possível autenticar no Spotify. Verifique as credenciais.',
      'spotify_token_failed',
    )
  }
  return data!
}

async function spotifyGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (response.status === 401) {
    throw new SpotifyReconnectRequiredError()
  }
  if (!response.ok) {
    throw new SpotifyError(response.status, `Erro na API do Spotify (status ${response.status}).`)
  }
  return (await response.json()) as T
}

export interface SpotifyProfile {
  id: string
  displayName: string | null
  email: string | null
  country: string | null
  imageUrl: string | null
}

interface SpotifyMeResponse {
  id: string
  display_name: string | null
  email: string | null
  country: string | null
  images: { url: string }[]
}

export async function getSpotifyMe(accessToken: string): Promise<SpotifyProfile> {
  const me = await spotifyGet<SpotifyMeResponse>('/me', accessToken)
  return {
    id: me.id,
    displayName: me.display_name ?? null,
    email: me.email ?? null,
    country: me.country ?? null,
    imageUrl: me.images[0]?.url ?? null,
  }
}

export async function exchangeSpotifyCode({
  code,
  codeVerifier,
  redirectUri,
}: {
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number; profile: SpotifyProfile }> {
  const tokens = await fetchSpotifyToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })
  const profile = await getSpotifyMe(tokens.access_token)
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresIn: tokens.expires_in,
    profile,
  }
}

export async function refreshSpotifyToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
  const tokens = await fetchSpotifyToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresIn: tokens.expires_in,
  }
}

export interface SpotifyUserRow {
  id: string
  spotifyAccessToken: string | null
  spotifyRefreshToken: string | null
  spotifyTokenExpiresAt: Date | null
}

export async function getFreshAccessToken(user: SpotifyUserRow): Promise<string> {
  const expiresAt = user.spotifyTokenExpiresAt?.getTime()
  if (user.spotifyAccessToken && expiresAt && Date.now() < expiresAt - 60_000) {
    return decryptSecret(user.spotifyAccessToken)
  }

  if (!user.spotifyRefreshToken) {
    throw new SpotifyReconnectRequiredError()
  }

  let refreshed: { accessToken: string; refreshToken: string | null; expiresIn: number }
  try {
    refreshed = await refreshSpotifyToken(decryptSecret(user.spotifyRefreshToken))
  } catch (err) {
    if (err instanceof SpotifyError && err.status === 400) {
      throw new SpotifyReconnectRequiredError()
    }
    throw err
  }

  await db
    .update(users)
    .set({
      spotifyAccessToken: encryptSecret(refreshed.accessToken),
      ...(refreshed.refreshToken
        ? { spotifyRefreshToken: encryptSecret(refreshed.refreshToken) }
        : {}),
      spotifyTokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  return refreshed.accessToken
}

interface SpotifyAlbumObject {
  id: string
  name: string
  artists: { name: string }[]
  images: { url: string }[]
  release_date: string | null
}

export interface RecentAlbum {
  albumId: string
  title: string
  artist: string
  artworkUrl: string | null
  releaseDate: string | null
  lastPlayedAt: string
}

export async function getRecentlyPlayedAlbums(accessToken: string): Promise<RecentAlbum[]> {
  const data = await spotifyGet<{
    items: { track: { album: SpotifyAlbumObject }; played_at: string }[]
  }>('/me/player/recently-played?limit=50', accessToken)

  const albums = new Map<string, RecentAlbum>()
  for (const item of data.items ?? []) {
    const album = item.track?.album
    if (!album?.id) continue
    const entry: RecentAlbum = {
      albumId: album.id,
      title: album.name,
      artist: (album.artists ?? []).map((artist) => artist.name).join(', ') || 'Artista desconhecido',
      artworkUrl: album.images[0]?.url ?? null,
      releaseDate: album.release_date ?? null,
      lastPlayedAt: item.played_at,
    }
    const existing = albums.get(album.id)
    if (!existing || entry.lastPlayedAt > existing.lastPlayedAt) {
      albums.set(album.id, entry)
    }
  }

  return [...albums.values()]
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt))
    .slice(0, 30)
}

export interface TopArtist {
  id: string
  name: string
  genres: string[]
  imageUrl: string | null
}

export async function getTopArtists(
  accessToken: string,
  timeRange = 'long_term',
  limit = 20,
): Promise<TopArtist[]> {
  const data = await spotifyGet<{
    items: { id: string; name: string; genres: string[]; images: { url: string }[] }[]
  }>(`/me/top/artists?time_range=${timeRange}&limit=${limit}`, accessToken)

  return (data.items ?? []).map((artist) => ({
    id: artist.id,
    name: artist.name,
    genres: artist.genres ?? [],
    imageUrl: artist.images[0]?.url ?? null,
  }))
}

export interface SavedAlbum {
  albumId: string
  title: string
  artist: string
  artworkUrl: string | null
  releaseDate: string | null
}

export async function getSavedAlbums(accessToken: string, limit = 50): Promise<SavedAlbum[]> {
  const data = await spotifyGet<{ items: { album: SpotifyAlbumObject }[] }>(
    `/me/albums?limit=${limit}`,
    accessToken,
  )

  return (data.items ?? []).map((item) => {
    const album = item.album
    return {
      albumId: album.id,
      title: album.name,
      artist: (album.artists ?? []).map((artist) => artist.name).join(', ') || 'Artista desconhecido',
      artworkUrl: album.images[0]?.url ?? null,
      releaseDate: album.release_date ?? null,
    }
  })
}

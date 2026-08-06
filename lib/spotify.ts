import type { SpotifyAlbumResult } from './types'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SEARCH_URL = 'https://api.spotify.com/v1/search'

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64Encode(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let result = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]
    const b2 = bytes[i + 1]
    const b3 = bytes[i + 2]
    result += BASE64_CHARS[b1 >> 2]
    result += BASE64_CHARS[((b1 & 3) << 4) | ((b2 ?? 0) >> 4)]
    result += b2 === undefined ? '=' : BASE64_CHARS[((b2 & 15) << 2) | ((b3 ?? 0) >> 6)]
    result += b3 === undefined ? '=' : BASE64_CHARS[b3 & 63]
  }
  return result
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface SpotifyAlbumItem {
  id: string
  name: string
  artists: { name: string }[]
  images: { url: string }[]
  release_date: string | null
}

interface SpotifySearchResponse {
  albums: { items: SpotifyAlbumItem[] } | null
}

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
  const clientSecret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      'Credenciais do Spotify ausentes. Defina EXPO_PUBLIC_SPOTIFY_CLIENT_ID e EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET no arquivo .env',
    )
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`Falha ao autenticar no Spotify (status ${response.status})`)
  }

  const data = (await response.json()) as SpotifyTokenResponse
  cachedToken = data.access_token
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000
  return cachedToken
}

export async function searchAlbums(query: string): Promise<SpotifyAlbumResult[]> {
  const token = await getAccessToken()
  const q = encodeURIComponent(query)
  const response = await fetch(`${SEARCH_URL}?q=${q}&type=album&limit=10`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Falha na busca do Spotify (status ${response.status})`)
  }

  const data = (await response.json()) as SpotifySearchResponse

  return (data.albums?.items ?? []).map((item) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((artist) => artist.name).join(', ') || 'Artista desconhecido',
    artworkUrl: item.images[0]?.url ?? null,
    releaseDate: item.release_date ?? null,
    genre: null,
  }))
}

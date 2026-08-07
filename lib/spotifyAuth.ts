import * as AuthSession from 'expo-auth-session'
import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'

export const SPOTIFY_SCOPES =
  'user-read-email user-read-private user-top-read user-read-recently-played user-library-read user-follow-read'

const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function bytesToBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0
    const b2 = bytes[i + 1] ?? 0
    const b3 = bytes[i + 2] ?? 0
    out += BASE64URL_CHARS.charAt(b1 >> 2)
    out += BASE64URL_CHARS.charAt(((b1 & 3) << 4) | (b2 >> 4))
    out += BASE64URL_CHARS.charAt(((b2 & 15) << 2) | (b3 >> 6))
    out += BASE64URL_CHARS.charAt(b3 & 63)
  }
  return out
}

function base64ToBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

function parseQuery(url: string): Record<string, string> {
  const query = url.split('?')[1] ?? ''
  const out: Record<string, string> = {}
  for (const pair of query.split('&')) {
    if (!pair) continue
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    const key = decodeURIComponent(pair.slice(0, separator))
    const value = decodeURIComponent(pair.slice(separator + 1))
    out[key] = value
  }
  return out
}

export function spotifyRedirectUri(): string {
  return AuthSession.makeRedirectUri()
}

export interface SpotifyAuthResult {
  code: string
  state: string
  codeVerifier: string
  redirectUri: string
}

export async function openSpotifyAuth(expectedState: string): Promise<SpotifyAuthResult | null> {
  const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
  if (!clientId) {
    throw new Error('Spotify não configurado. Defina EXPO_PUBLIC_SPOTIFY_CLIENT_ID no arquivo .env')
  }

  const redirectUri = spotifyRedirectUri()
  console.log(`[spotify] redirect URI usada pelo app: ${redirectUri}`)
  console.log(`[spotify] cadastre essa URI exata no painel do Spotify em Redirect URIs`)
  const bytes = await Crypto.getRandomBytesAsync(32)
  const codeVerifier = bytesToBase64Url(bytes)
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
  const codeChallenge = base64ToBase64Url(digest)

  const url =
    'https://accounts.spotify.com/authorize?' +
    encodeQuery({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state: expectedState,
      scope: SPOTIFY_SCOPES,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

  const result = await WebBrowser.openAuthSessionAsync(url, redirectUri)
  if (result.type !== 'success' || !result.url) return null

  const params = parseQuery(result.url)
  if (params.error) {
    if (params.error === 'access_denied') return null
    throw new Error('Não foi possível conectar ao Spotify. Tente novamente.')
  }
  if (params.state !== expectedState || !params.code) {
    throw new Error('Falha de segurança na resposta do Spotify. Tente novamente.')
  }

  return {
    code: params.code,
    state: params.state,
    codeVerifier,
    redirectUri,
  }
}

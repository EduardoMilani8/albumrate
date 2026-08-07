import { api } from './api'
import type { SpotifyAlbumResult } from './types'

/**
 * Busca de álbuns do Spotify via proxy do backend (`GET /api/spotify/search`).
 * As credenciais do Spotify ficam só no servidor — o Client Secret nunca vai no app.
 */
export async function searchAlbums(query: string): Promise<SpotifyAlbumResult[]> {
  const { albums } = await api.searchSpotifyAlbums(query)
  return albums
}

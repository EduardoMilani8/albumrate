export interface EnrichedAlbumMetadata {
  genre: string | null
  year: number | null
  country: string | null
}

const DEEZER_API = 'https://api.deezer.com'
const REQUEST_TIMEOUT_MS = 5000

interface DeezerSearchResponse {
  data: { id: number }[]
}

interface DeezerAlbumResponse {
  release_date?: string
  genres?: { data: { name: string }[] }
  artist?: { id: number }
}

interface DeezerArtistResponse {
  country?: string | null
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Enriquecimento best-effort de metadata (gênero, ano e país do artista) via API
 * pública do Deezer. Nunca lança: falhas retornam apenas o que já conhecíamos.
 */
export async function enrichAlbumMetadata(input: {
  title: string
  artist: string
  releaseYear?: number | null
}): Promise<EnrichedAlbumMetadata> {
  const result: EnrichedAlbumMetadata = {
    genre: null,
    year: input.releaseYear ?? null,
    country: null,
  }

  try {
    const query = encodeURIComponent(`artist:"${input.artist}" album:"${input.title}"`)
    const searchResponse = await fetchWithTimeout(
      `${DEEZER_API}/search/album?q=${query}&limit=1`,
      REQUEST_TIMEOUT_MS,
    )
    if (!searchResponse?.ok) return result

    const searchData = (await searchResponse.json()) as DeezerSearchResponse
    const albumId = searchData.data[0]?.id
    if (!albumId) return result

    const albumResponse = await fetchWithTimeout(
      `${DEEZER_API}/album/${albumId}`,
      REQUEST_TIMEOUT_MS,
    )
    if (!albumResponse?.ok) return result

    const album = (await albumResponse.json()) as DeezerAlbumResponse
    const genre = album.genres?.data[0]?.name ?? null
    if (genre) result.genre = genre

    if (result.year === null && album.release_date) {
      const year = Number(album.release_date.slice(0, 4))
      if (Number.isInteger(year) && year >= 1900 && year <= 2100) result.year = year
    }

    const artistId = album.artist?.id
    if (artistId) {
      const artistResponse = await fetchWithTimeout(
        `${DEEZER_API}/artist/${artistId}`,
        REQUEST_TIMEOUT_MS,
      )
      if (artistResponse?.ok) {
        const artist = (await artistResponse.json()) as DeezerArtistResponse
        if (artist.country) result.country = artist.country
      }
    }
  } catch {
    // Enriquecimento é best-effort: mantém apenas o que já tínhamos.
  }

  return result
}

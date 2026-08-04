import type { ItunesAlbumResult } from './types'

interface ItunesSearchResponse {
  resultCount: number
  results: ItunesAlbumResult[]
}

export async function searchAlbums(query: string): Promise<ItunesAlbumResult[]> {
  const term = encodeURIComponent(query)
  const response = await fetch(`https://itunes.apple.com/search?term=${term}&entity=album&limit=20`)

  if (!response.ok) {
    throw new Error(`iTunes API request failed with status ${response.status}`)
  }

  const data = (await response.json()) as ItunesSearchResponse
  const seen = new Set<number>()
  const results: ItunesAlbumResult[] = []

  for (const album of data.results ?? []) {
    if (seen.has(album.collectionId)) continue
    seen.add(album.collectionId)
    results.push({
      ...album,
      artworkUrl100: album.artworkUrl100
        ? album.artworkUrl100.replace('100x100bb', '600x600bb')
        : null,
    })
  }

  return results
}

export type AlbumStatus = 'logged' | 'want_to_listen'

export interface LoggedAlbum {
  id: string
  title: string
  artist: string
  artworkUrl: string | null
  releaseDate: string | null
  genre: string | null
  rating: number | null
  review: string | null
  loggedAt: string
  status: AlbumStatus
}

export interface ItunesAlbumResult {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100: string | null
  releaseDate: string | null
  primaryGenreName: string | null
}

export interface GenreCount {
  genre: string
  count: number
}

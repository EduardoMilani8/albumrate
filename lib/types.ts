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

export interface SpotifyAlbumResult {
  id: string
  title: string
  artist: string
  artworkUrl: string | null
  releaseDate: string | null
  genre: string | null
}

export interface GenreCount {
  genre: string
  count: number
}

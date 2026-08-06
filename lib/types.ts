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

export interface AuthUser {
  id: string
  email: string
  name: string | null
}

export type MediaType = 'vinil' | 'cd' | 'cassete' | 'digital'

export type MediaCondition = 'novo' | 'usado' | 'desgastado'

export interface MediaReview {
  id: string
  mediaType: MediaType
  pressingQualityRating: number
  editionNote: string | null
  condition: MediaCondition
  createdAt: string
}

export interface ReviewUser {
  email: string
  name: string | null
}

export interface Review {
  id: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  rating: number
  reviewText: string | null
  listenedAt: string
  createdAt: string
  updatedAt: string
  mediaReview?: MediaReview | null
  user?: ReviewUser
}

export interface AlbumReviewsResponse {
  albumId: string
  average: number | null
  count: number
  reviews: Review[]
  myReview: Review | null
}

export interface MyReviewsResponse {
  reviews: Review[]
}

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
  email: string | null
  name: string | null
  avatarUrl: string | null
  country: string | null
  spotifyConnected: boolean
  favoriteGenres: string[]
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

export interface ListeningLog {
  id: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  listenedAt: string
  createdAt: string
}

export interface ListeningLogMonth {
  yearMonth: string
  logs: ListeningLog[]
}

export interface ListeningLogsResponse {
  months: ListeningLogMonth[]
  nextBefore: string | null
}

export interface AlbumListSummary {
  id: string
  name: string
  description: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  albumCount: number
  coverArtworkUrl: string | null
}

export interface ListAlbum {
  id: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  position: number
  createdAt: string
}

export interface AlbumListsResponse {
  lists: AlbumListSummary[]
}

export interface AlbumListDetailResponse {
  list: AlbumListSummary
  albums: ListAlbum[]
}

export interface AlbumMetadataFields {
  albumGenre?: string | null
  albumYear?: number | null
  albumCountry?: string | null
}

export interface DiversityBucket {
  label: string
  count: number
  percentage: number
}

export interface DiversityScoreResponse {
  userId: string
  totalAlbums: number
  score: number | null
  entropy: number | null
  maxEntropy: number | null
  distinctGenres: number
  albumsWithMetadata: { genre: number; year: number; country: number }
  genreDistribution: DiversityBucket[]
  decadeDistribution: DiversityBucket[]
  countryDistribution: DiversityBucket[]
}

export interface CountryBackfillResponse {
  resolved: number
  remaining: number
  total: number
}

export interface DailyPick {
  id: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  date: string
  createdAt: string
}

export interface DailyPickResponse {
  pick: DailyPick | null
  alreadyUsed?: boolean
}

export interface SpotifyRecentAlbum {
  albumId: string
  title: string
  artist: string
  artworkUrl: string | null
  releaseDate: string | null
  lastPlayedAt: string
}

export interface SpotifyTopArtist {
  id: string
  name: string
  genres: string[]
  imageUrl: string | null
}

export interface SpotifyExistingUser {
  name: string | null
  email: string | null
}

export type SpotifyExchangeResult =
  | { token: string; user: AuthUser }
  | { conflict: true; existingUser: SpotifyExistingUser; pendingLinkToken: string }

import type {
  AlbumListDetailResponse,
  AlbumListsResponse,
  AlbumOfMonth,
  AlbumOfMonthCommentsResponse,
  AlbumOfMonthDetailResponse,
  AlbumOfMonthHistoryResponse,
  AlbumOfMonthResponse,
  AlbumOfMonthSubmitVoteResponse,
  AlbumOfMonthVoteStateResponse,
  AlbumReviewsResponse,
  AuthUser,
  CollectionItem,
  CountryBackfillResponse,
  DailyPickResponse,
  DiversityScoreResponse,
  FeedResponse,
  ListeningLog,
  ListeningLogsResponse,
  ListAlbum,
  MediaCondition,
  MediaType,
  MyReviewsResponse,
  PublicCollectionItem,
  Review,
  SpotifyExchangeResult,
  SpotifyRecentAlbum,
  SpotifyAlbumResult,
  SpotifyTopArtist,
  UserProfile,
  UserSearchResult,
} from './types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 20000

let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

function logRequest(method: string, path: string, status: string, startedAt: number): void {
  if (process.env.NODE_ENV === 'production') return
  console.log(`[api] ${method} ${path} → ${status} (${Date.now() - startedAt}ms)`)
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    logRequest(method, path, controller.signal.aborted ? 'TIMEOUT' : 'SEM CONEXÃO', startedAt)
    if (controller.signal.aborted) {
      throw new ApiError(0, 'O servidor demorou para responder. Tente novamente.')
    }
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.')
  } finally {
    clearTimeout(timeout)
  }

  logRequest(method, path, String(response.status), startedAt)

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    let errorMessage = 'Algo deu errado. Tente novamente.'
    let errorCode: string | undefined
    if (data && typeof data === 'object') {
      if ('error' in data && typeof data.error === 'string') {
        errorMessage = data.error
      }
      if ('code' in data && typeof data.code === 'string') {
        errorCode = data.code
      }
    }
    throw new ApiError(response.status, errorMessage, errorCode)
  }
  return data as T
}

export const api = {
  register(email: string, password: string, name?: string) {
    return request<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: { email, password, name },
    })
  },

  login(email: string, password: string) {
    return request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
  },

  me() {
    return request<{ user: AuthUser }>('/api/auth/me')
  },

  spotifyBegin() {
    return request<{ state: string }>('/api/auth/spotify/begin', { method: 'POST' })
  },

  spotifyExchange(payload: { code: string; codeVerifier: string; redirectUri: string; state: string }) {
    return request<SpotifyExchangeResult>('/api/auth/spotify/exchange', {
      method: 'POST',
      body: payload,
    })
  },

  spotifyLink(payload: { pendingLinkToken: string; linkMode: 'link' | 'new' }) {
    return request<{ token: string; user: AuthUser }>('/api/auth/spotify/link', {
      method: 'POST',
      body: payload,
    })
  },

  spotifyRecentlyPlayed() {
    return request<{ albums: SpotifyRecentAlbum[] }>('/api/me/spotify/recently-played')
  },

  spotifyTopArtists() {
    return request<{ artists: SpotifyTopArtist[] }>('/api/me/spotify/top-artists')
  },

  importRecentlyPlayed(albumIds: string[]) {
    return request<{ imported: number }>('/api/me/spotify/import/recently-played', {
      method: 'POST',
      body: { albumIds },
    })
  },

  importSavedAlbums() {
    return request<{ listId: string | null; imported: number }>(
      '/api/me/spotify/import/saved-albums',
      { method: 'POST', body: {} },
    )
  },

  disconnectSpotify() {
    return request<void>('/api/me/spotify/connection', { method: 'DELETE' })
  },

  updateFavoriteGenres(genres: string[]) {
    return request<{ favoriteGenres: string[] }>('/api/me/favorite-genres', {
      method: 'PUT',
      body: { genres },
    })
  },

  getAlbumReviews(albumId: string) {
    return request<AlbumReviewsResponse>(`/api/albums/${albumId}/reviews`)
  },

  saveReview(
    albumId: string,
    payload: {
      rating: number
      reviewText: string | null
      listenedAt: string
      albumTitle: string
      albumArtist: string
      albumArtworkUrl?: string | null
      albumGenre?: string | null
      albumYear?: number | null
      albumCountry?: string | null
      mediaReview?: {
        mediaType: MediaType
        pressingQualityRating: number
        editionNote: string | null
        condition: MediaCondition
      } | null
    },
  ) {
    return request<{ review: Review }>(`/api/albums/${albumId}/reviews/me`, {
      method: 'PUT',
      body: payload,
    })
  },

  deleteReview(albumId: string) {
    return request<void>(`/api/albums/${albumId}/reviews/me`, { method: 'DELETE' })
  },

  myReviews() {
    return request<MyReviewsResponse>('/api/me/reviews')
  },

  createListeningLog(payload: {
    albumId: string
    albumTitle: string
    albumArtist: string
    albumArtworkUrl?: string | null
    albumGenre?: string | null
    albumYear?: number | null
    albumCountry?: string | null
  }) {
    return request<{ log: ListeningLog }>('/api/me/listening-logs', {
      method: 'POST',
      body: payload,
    })
  },

  myListeningLogs(before?: string) {
    return request<ListeningLogsResponse>(
      `/api/me/listening-logs${before ? `?before=${encodeURIComponent(before)}` : ''}`,
    )
  },

  deleteListeningLog(id: string) {
    return request<void>(`/api/me/listening-logs/${id}`, { method: 'DELETE' })
  },

  myLists() {
    return request<AlbumListsResponse>('/api/me/lists')
  },

  myCollection(params?: { q?: string; mediaType?: MediaType }) {
    const query = new URLSearchParams()
    if (params?.q) query.set('q', params.q)
    if (params?.mediaType) query.set('mediaType', params.mediaType)
    const qs = query.toString()
    return request<{ items: CollectionItem[] }>(`/api/me/collection${qs ? `?${qs}` : ''}`)
  },

  createCollectionItem(payload: {
    albumId: string
    albumTitle: string
    albumArtist: string
    albumArtworkUrl?: string | null
    mediaType: MediaType
    editionNote: string | null
    condition: MediaCondition
    pricePaid: string | null
    acquiredAt: string
  }) {
    return request<{ item: CollectionItem }>('/api/me/collection', {
      method: 'POST',
      body: payload,
    })
  },

  updateCollectionItem(
    id: string,
    payload: Partial<{
      mediaType: MediaType
      editionNote: string | null
      condition: MediaCondition
      pricePaid: string | null
      acquiredAt: string
    }>,
  ) {
    return request<{ item: CollectionItem }>(`/api/me/collection/${id}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  deleteCollectionItem(id: string) {
    return request<void>(`/api/me/collection/${id}`, { method: 'DELETE' })
  },

  userCollection(userId: string) {
    return request<{ items: PublicCollectionItem[] }>(`/api/users/${userId}/collection`)
  },

  createList(payload: { name: string; description: string | null; isPublic: boolean }) {
    return request<{ list: AlbumListsResponse['lists'][number] }>('/api/me/lists', {
      method: 'POST',
      body: payload,
    })
  },

  getList(id: string) {
    return request<AlbumListDetailResponse>(`/api/me/lists/${id}`)
  },

  updateList(
    id: string,
    payload: { name?: string; description?: string | null; isPublic?: boolean },
  ) {
    return request<{ list: AlbumListsResponse['lists'][number] }>(`/api/me/lists/${id}`, {
      method: 'PATCH',
      body: payload,
    })
  },

  deleteList(id: string) {
    return request<void>(`/api/me/lists/${id}`, { method: 'DELETE' })
  },

  addListAlbum(
    listId: string,
    payload: {
      albumId: string
      albumTitle: string
      albumArtist: string
      albumArtworkUrl?: string | null
    },
  ) {
    return request<{ album: ListAlbum }>(`/api/me/lists/${listId}/albums`, {
      method: 'POST',
      body: payload,
    })
  },

  removeListAlbum(listId: string, albumId: string) {
    return request<void>(`/api/me/lists/${listId}/albums/${albumId}`, { method: 'DELETE' })
  },

  reorderListAlbums(listId: string, albumIds: string[]) {
    return request<{ albums: ListAlbum[] }>(`/api/me/lists/${listId}/albums`, {
      method: 'PUT',
      body: { albumIds },
    })
  },

  diversityScore(userId: string) {
    return request<DiversityScoreResponse>(`/api/users/${userId}/diversity-score`)
  },

  backfillCountries() {
    return request<CountryBackfillResponse>('/api/me/countries/backfill', {
      method: 'POST',
      body: {},
    })
  },

  dailyPickToday() {
    return request<DailyPickResponse>('/api/daily-pick/today')
  },

  dailyPick() {
    return request<DailyPickResponse>('/api/daily-pick')
  },

  searchSpotifyAlbums(query: string) {
    return request<{ albums: SpotifyAlbumResult[] }>(
      `/api/spotify/search?q=${encodeURIComponent(query)}`,
    )
  },

  getUserProfile(id: string) {
    return request<{ user: UserProfile }>(`/api/users/${id}`)
  },

  getUserReviews(userId: string) {
    return request<{ reviews: Review[] }>(`/api/users/${userId}/reviews`)
  },

  followUser(id: string) {
    return request<void>(`/api/users/${id}/follow`, { method: 'PUT' })
  },

  unfollowUser(id: string) {
    return request<void>(`/api/users/${id}/follow`, { method: 'DELETE' })
  },

  searchUsers(query: string) {
    return request<{ users: UserSearchResult[] }>(
      `/api/users/search?q=${encodeURIComponent(query)}`,
    )
  },

  getFeed(before?: string, beforeId?: string) {
    const params = new URLSearchParams()
    if (before) params.set('before', before)
    if (beforeId) params.set('beforeId', beforeId)
    const query = params.toString()
    return request<FeedResponse>(`/api/feed${query ? `?${query}` : ''}`)
  },

  getPublicList(id: string) {
    return request<AlbumListDetailResponse>(`/api/lists/${id}`)
  },

  albumOfMonth() {
    return request<AlbumOfMonthResponse>('/api/album-of-month')
  },

  albumOfMonthById(id: string) {
    return request<AlbumOfMonthDetailResponse>(`/api/album-of-month/${id}`)
  },

  albumOfMonthHistory() {
    return request<AlbumOfMonthHistoryResponse>('/api/album-of-month/history')
  },

  albumOfMonthVoteState() {
    return request<AlbumOfMonthVoteStateResponse>('/api/album-of-month/vote/state')
  },

  submitAlbumOfMonthVote(albumIds: string[]) {
    return request<AlbumOfMonthSubmitVoteResponse>('/api/album-of-month/vote', {
      method: 'POST',
      body: { albumIds },
    })
  },

  albumOfMonthComments(id: string) {
    return request<AlbumOfMonthCommentsResponse>(`/api/album-of-month/${id}/comments`)
  },

  postAlbumOfMonthComment(id: string, commentText: string) {
    return request<{ comment: AlbumOfMonthCommentsResponse['comments'][number] }>(
      `/api/album-of-month/${id}/comments`,
      { method: 'POST', body: { commentText } },
    )
  },
}

import type { AlbumReviewsResponse, AuthUser, MyReviewsResponse, Review } from './types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 20000

let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(0, 'O servidor demorou para responder. Tente novamente.')
    }
    throw new ApiError(0, 'Sem conexão com o servidor. Verifique sua internet.')
  } finally {
    clearTimeout(timeout)
  }

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    let errorMessage = 'Algo deu errado. Tente novamente.'
    if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
      errorMessage = data.error
    }
    throw new ApiError(response.status, errorMessage)
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
}

import type { AlbumReviewsResponse, AuthUser, MyReviewsResponse, Review } from './types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080'

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
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

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

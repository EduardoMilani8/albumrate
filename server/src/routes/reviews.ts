import { and, avg, count, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { reviews, users } from '../schema.js'

const router = Router()

const RATING_MIN = 0.5
const RATING_MAX = 5
const ALBUM_ID_MAX_LENGTH = 100

function albumIdOf(req: AuthedRequest): string {
  return String(req.params.albumId)
}

function hasValidAlbumId(req: AuthedRequest): boolean {
  const albumId = albumIdOf(req)
  return albumId.length > 0 && albumId.length <= ALBUM_ID_MAX_LENGTH
}

function isValidDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function todayLocalISO(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const ratingSchema = z
  .number()
  .min(RATING_MIN, 'A nota mínima é 0,5.')
  .max(RATING_MAX, 'A nota máxima é 5.')
  .refine((value) => (value * 2) % 1 === 0, 'A nota deve ser múltipla de 0,5.')

const reviewSchema = z.object({
  rating: ratingSchema,
  reviewText: z
    .string()
    .trim()
    .max(2000, 'A resenha deve ter no máximo 2000 caracteres.')
    .optional()
    .nullable()
    .transform((value) => value || null),
  listenedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
    .refine(isValidDate, 'Data inválida.')
    .refine((value) => value <= todayLocalISO(), 'A data não pode ser no futuro.')
    .optional(),
  albumTitle: z.string().trim().max(200).default(''),
  albumArtist: z.string().trim().max(200).default(''),
  albumArtworkUrl: z.string().url().max(500).nullable().optional(),
})

function toReviewJson(review: {
  id: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  rating: number
  reviewText: string | null
  listenedAt: string
  createdAt: Date
  updatedAt: Date
  userEmail?: string
  userName?: string | null
}) {
  return {
    id: review.id,
    albumId: review.albumId,
    albumTitle: review.albumTitle,
    albumArtist: review.albumArtist,
    albumArtworkUrl: review.albumArtworkUrl,
    rating: review.rating,
    reviewText: review.reviewText,
    listenedAt: review.listenedAt,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    user: review.userEmail
      ? { email: review.userEmail, name: review.userName ?? null }
      : undefined,
  }
}

router.put('/albums/:albumId/reviews/me', async (req: AuthedRequest, res) => {
  if (!hasValidAlbumId(req)) {
    res.status(400).json({ error: 'Identificador do álbum inválido.' })
    return
  }
  const userId = req.userId!
  const albumId = albumIdOf(req)

  const parsed = reviewSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = parsed.data
  const listenedAt = data.listenedAt ?? new Date().toISOString().slice(0, 10)
  const now = new Date()

  const [saved] = await db
    .insert(reviews)
    .values({
      userId,
      albumId,
      albumTitle: data.albumTitle,
      albumArtist: data.albumArtist,
      albumArtworkUrl: data.albumArtworkUrl ?? null,
      rating: data.rating,
      reviewText: data.reviewText ?? null,
      listenedAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [reviews.userId, reviews.albumId],
      set: {
        albumTitle: data.albumTitle,
        albumArtist: data.albumArtist,
        albumArtworkUrl: data.albumArtworkUrl ?? null,
        rating: data.rating,
        reviewText: data.reviewText ?? null,
        listenedAt,
        updatedAt: now,
      },
    })
    .returning()

  if (!saved) {
    res.status(500).json({ error: 'Não foi possível salvar a avaliação.' })
    return
  }
  res.status(200).json({ review: toReviewJson(saved) })
})

router.delete('/albums/:albumId/reviews/me', async (req: AuthedRequest, res) => {
  if (!hasValidAlbumId(req)) {
    res.status(400).json({ error: 'Identificador do álbum inválido.' })
    return
  }
  const userId = req.userId!

  const deleted = await db
    .delete(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.albumId, albumIdOf(req))))
    .returning({ id: reviews.id })

  if (deleted.length === 0) {
    res.status(404).json({ error: 'Avaliação não encontrada.' })
    return
  }
  res.status(204).end()
})

router.get('/albums/:albumId/reviews', async (req: AuthedRequest, res) => {
  if (!hasValidAlbumId(req)) {
    res.status(400).json({ error: 'Identificador do álbum inválido.' })
    return
  }
  const albumId = albumIdOf(req)

  const rows = await db
    .select({
      id: reviews.id,
      userId: reviews.userId,
      albumId: reviews.albumId,
      albumTitle: reviews.albumTitle,
      albumArtist: reviews.albumArtist,
      albumArtworkUrl: reviews.albumArtworkUrl,
      rating: reviews.rating,
      reviewText: reviews.reviewText,
      listenedAt: reviews.listenedAt,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      userEmail: users.email,
      userName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.albumId, albumId))
    .orderBy(desc(reviews.createdAt))

  const [avgRow] = await db
    .select({ average: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(eq(reviews.albumId, albumId))

  const myReview = rows.find((row) => row.userId === req.userId) ?? null

  res.json({
    albumId,
    average: avgRow?.average ? Number(Number(avgRow.average).toFixed(2)) : null,
    count: avgRow?.total ?? 0,
    reviews: rows.map(toReviewJson),
    myReview: myReview ? toReviewJson(myReview) : null,
  })
})

router.get('/me/reviews', async (req: AuthedRequest, res) => {
  const userId = req.userId!

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))

  res.json({ reviews: rows.map(toReviewJson) })
})

export default router

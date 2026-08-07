import { and, avg, count, desc, eq, inArray } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { resolveArtistCountry } from '../lib/country.js'
import { isValidDate, todayLocalISO } from '../lib/dates.js'
import { mediaReviews, reviews, users } from '../schema.js'
import type { MediaReview } from '../schema.js'

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

const ratingSchema = z
  .number()
  .min(RATING_MIN, 'A nota mínima é 0,5.')
  .max(RATING_MAX, 'A nota máxima é 5.')
  .refine((value) => (value * 2) % 1 === 0, 'A nota deve ser múltipla de 0,5.')

const mediaTypeSchema = z.enum(['vinil', 'cd', 'cassete', 'digital'], {
  error: 'Tipo de mídia inválido.',
})

const conditionSchema = z.enum(['novo', 'usado', 'desgastado'], {
  error: 'Condição da mídia inválida.',
})

const mediaReviewSchema = z.object({
  mediaType: mediaTypeSchema,
  pressingQualityRating: z
    .number()
    .min(1, 'A nota da mídia deve ser de 1 a 5.')
    .max(5, 'A nota da mídia deve ser de 1 a 5.')
    .refine((value) => (value * 2) % 1 === 0, 'A nota da mídia deve ser múltipla de 0,5.'),
  editionNote: z
    .string()
    .trim()
    .max(200, 'A edição/prensagem deve ter no máximo 200 caracteres.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  condition: conditionSchema,
})

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
  albumGenre: z
    .string()
    .trim()
    .max(100, 'O gênero deve ter no máximo 100 caracteres.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  albumYear: z
    .number()
    .int()
    .min(1900, 'Ano do álbum inválido.')
    .max(2100, 'Ano do álbum inválido.')
    .nullable()
    .optional(),
  albumCountry: z
    .string()
    .trim()
    .max(3, 'País do artista inválido.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  mediaReview: mediaReviewSchema.nullable().optional(),
})

function mediaReviewJson(media: MediaReview) {
  return {
    id: media.id,
    mediaType: media.mediaType,
    pressingQualityRating: media.pressingQualityRating,
    editionNote: media.editionNote,
    condition: media.condition,
    createdAt: media.createdAt.toISOString(),
  }
}

function toReviewJson(
  review: {
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
    userName?: string | null
  },
  media?: MediaReview | null,
) {
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
    mediaReview: media ? mediaReviewJson(media) : null,
    user: review.userName ? { name: review.userName } : undefined,
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
      albumGenre: data.albumGenre ?? null,
      albumYear: data.albumYear ?? null,
      albumCountry: data.albumCountry ?? null,
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
        albumGenre: data.albumGenre ?? null,
        albumYear: data.albumYear ?? null,
        albumCountry: data.albumCountry ?? null,
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

  let media: MediaReview | null = null
  if (data.mediaReview) {
    const [upserted] = await db
      .insert(mediaReviews)
      .values({
        reviewId: saved.id,
        mediaType: data.mediaReview.mediaType,
        pressingQualityRating: data.mediaReview.pressingQualityRating,
        editionNote: data.mediaReview.editionNote ?? null,
        condition: data.mediaReview.condition,
      })
      .onConflictDoUpdate({
        target: mediaReviews.reviewId,
        set: {
          mediaType: data.mediaReview.mediaType,
          pressingQualityRating: data.mediaReview.pressingQualityRating,
          editionNote: data.mediaReview.editionNote ?? null,
          condition: data.mediaReview.condition,
        },
      })
      .returning()
    media = upserted ?? null
  } else if (data.mediaReview === null) {
    await db.delete(mediaReviews).where(eq(mediaReviews.reviewId, saved.id))
  }

  // Se o app não enviou o país do artista, resolve em background (cache + MusicBrainz)
  // e atualiza a linha depois — nunca bloqueia o save.
  const artistName = data.albumArtist.trim()
  if (artistName && !(data.albumCountry ?? null)) {
    void (async () => {
      try {
        const country = await resolveArtistCountry(artistName)
        if (country) {
          await db
            .update(reviews)
            .set({ albumCountry: country, updatedAt: new Date() })
            .where(eq(reviews.id, saved.id))
        }
      } catch (err) {
        console.warn('[country] falha ao enriquecer review:', err)
      }
    })()
  }

  res.status(200).json({ review: toReviewJson(saved, media) })
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
      userName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.albumId, albumId))
    .orderBy(desc(reviews.createdAt))

  const reviewIds = rows.map((row) => row.id)
  const mediaRows = reviewIds.length
    ? await db
        .select()
        .from(mediaReviews)
        .where(inArray(mediaReviews.reviewId, reviewIds))
    : []
  const mediaByReviewId = new Map(mediaRows.map((row) => [row.reviewId, row]))

  const [avgRow] = await db
    .select({ average: avg(reviews.rating), total: count() })
    .from(reviews)
    .where(eq(reviews.albumId, albumId))

  const myReview = rows.find((row) => row.userId === req.userId) ?? null

  res.json({
    albumId,
    average: avgRow?.average ? Number(Number(avgRow.average).toFixed(2)) : null,
    count: avgRow?.total ?? 0,
    reviews: rows.map((row) => toReviewJson(row, mediaByReviewId.get(row.id))),
    myReview: myReview ? toReviewJson(myReview, mediaByReviewId.get(myReview.id)) : null,
  })
})

router.get('/me/reviews', async (req: AuthedRequest, res) => {
  const userId = req.userId!

  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.userId, userId))
    .orderBy(desc(reviews.createdAt))

  const reviewIds = rows.map((row) => row.id)
  const mediaRows = reviewIds.length
    ? await db
        .select()
        .from(mediaReviews)
        .where(inArray(mediaReviews.reviewId, reviewIds))
    : []
  const mediaByReviewId = new Map(mediaRows.map((row) => [row.reviewId, row]))

  res.json({ reviews: rows.map((row) => toReviewJson(row, mediaByReviewId.get(row.id))) })
})

export default router

import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { computeDiversity, type AlbumMetadata } from '../lib/diversity.js'
import { listeningLogs, reviews } from '../schema.js'

const router = Router()

const userIdSchema = z.object({ id: z.string().uuid('Identificador de usuário inválido.') })

router.get('/users/:id/diversity-score', async (req: AuthedRequest, res) => {
  const parsed = userIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }
  const userId = parsed.data.id

  const [reviewRows, logRows] = await Promise.all([
    db
      .select({
        albumId: reviews.albumId,
        genre: reviews.albumGenre,
        year: reviews.albumYear,
        country: reviews.albumCountry,
      })
      .from(reviews)
      .where(eq(reviews.userId, userId)),
    db
      .select({
        albumId: listeningLogs.albumId,
        genre: listeningLogs.albumGenre,
        year: listeningLogs.albumYear,
        country: listeningLogs.albumCountry,
      })
      .from(listeningLogs)
      .where(eq(listeningLogs.userId, userId)),
  ])

  const albums = new Map<string, AlbumMetadata>()
  const merge = (row: AlbumMetadata) => {
    const existing = albums.get(row.albumId)
    if (!existing) {
      albums.set(row.albumId, { ...row })
      return
    }
    existing.genre = existing.genre ?? row.genre
    existing.year = existing.year ?? row.year
    existing.country = existing.country ?? row.country
  }

  for (const row of reviewRows) merge(row)
  for (const row of logRows) merge(row)

  res.json({ userId, ...computeDiversity([...albums.values()]) })
})

export default router

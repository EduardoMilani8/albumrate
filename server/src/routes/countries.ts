import { and, eq, inArray, isNull } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { normalizeArtistName, resolveArtistCountry } from '../lib/country.js'
import { artists, listeningLogs, reviews } from '../schema.js'

const router = Router()

const MAX_RUNTIME_MS = 13000
const REQUEST_SPACING_MS = 1000

/**
 * Backfill dos países de origem: percorre os artistas dos reviews/logs do usuário
 * que ainda não têm país, resolve via cache + MusicBrainz e atualiza as linhas.
 * Limitado por tempo (~13s, abaixo do timeout de 20s do app) para não estourar o
 * cliente; o restante é resolvido em chamadas seguintes (o cache evita reconsultar).
 */
router.post('/me/countries/backfill', async (req: AuthedRequest, res) => {
  const userId = req.userId!

  const [reviewArtists, logArtists] = await Promise.all([
    db
      .selectDistinct({ artist: reviews.albumArtist })
      .from(reviews)
      .where(and(eq(reviews.userId, userId), isNull(reviews.albumCountry))),
    db
      .selectDistinct({ artist: listeningLogs.albumArtist })
      .from(listeningLogs)
      .where(and(eq(listeningLogs.userId, userId), isNull(listeningLogs.albumCountry))),
  ])

  const missing = new Map<string, string>()
  for (const row of [...reviewArtists, ...logArtists]) {
    const artist = row.artist.trim()
    if (artist) missing.set(normalizeArtistName(artist), artist)
  }

  if (missing.size > 0) {
    const cached = await db
      .select({ name: artists.name })
      .from(artists)
      .where(inArray(artists.name, [...missing.keys()]))
    for (const row of cached) missing.delete(row.name)
  }

  const toResolve = [...missing.values()]
  const total = toResolve.length
  const startedAt = Date.now()
  let resolved = 0

  for (const artist of toResolve) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) break
    const country = await resolveArtistCountry(artist)
    if (country) {
      await Promise.all([
        db
          .update(reviews)
          .set({ albumCountry: country, updatedAt: new Date() })
          .where(and(eq(reviews.userId, userId), eq(reviews.albumArtist, artist), isNull(reviews.albumCountry))),
        db
          .update(listeningLogs)
          .set({ albumCountry: country })
          .where(and(eq(listeningLogs.userId, userId), eq(listeningLogs.albumArtist, artist), isNull(listeningLogs.albumCountry))),
      ])
    }
    resolved += 1
    await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS))
  }

  res.json({ resolved, remaining: Math.max(0, total - resolved), total })
})

export default router

import { and, eq, max } from 'drizzle-orm'
import { Router, type Response } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { isValidDate } from '../lib/dates.js'
import {
  getFreshAccessToken,
  getRecentlyPlayedAlbums,
  getSavedAlbums,
  getTopArtists,
  searchAlbums,
  SpotifyError,
  SpotifyReconnectRequiredError,
} from '../lib/spotify.js'
import { listeningLogs, listAlbums, lists, users } from '../schema.js'

const router = Router()

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Informe um termo de busca.').max(200, 'Busca muito longa.'),
})

router.get('/spotify/search', async (req: AuthedRequest, res) => {
  const parsed = searchQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' })
    return
  }

  try {
    const albums = await searchAlbums(parsed.data.q)
    res.json({ albums })
  } catch (err) {
    // Chamada servidor-a-servidor com credenciais do servidor: falha aqui é
    // problema de config/quota do Spotify, não do usuário.
    if (err instanceof SpotifyError) {
      res.status(502).json({ error: 'Busca indisponível no momento. Tente novamente.' })
      return
    }
    throw err
  }
})

function handleSpotifyError(res: Response, err: unknown): boolean {
  if (err instanceof SpotifyReconnectRequiredError) {
    res.status(401).json({ error: err.message, code: err.code })
    return true
  }
  return false
}

async function getUserWithSpotify(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) {
    throw new Error('Usuário não encontrado.')
  }
  if (!user.spotifyId) {
    throw new SpotifyReconnectRequiredError()
  }
  return user
}

router.get('/me/spotify/recently-played', async (req: AuthedRequest, res) => {
  try {
    const user = await getUserWithSpotify(req.userId!)
    const token = await getFreshAccessToken(user)
    const albums = await getRecentlyPlayedAlbums(token)
    res.json({ albums })
  } catch (err) {
    if (handleSpotifyError(res, err)) return
    throw err
  }
})

router.get('/me/spotify/top-artists', async (req: AuthedRequest, res) => {
  try {
    const user = await getUserWithSpotify(req.userId!)
    const token = await getFreshAccessToken(user)
    const artists = await getTopArtists(token)
    res.json({ artists })
  } catch (err) {
    if (handleSpotifyError(res, err)) return
    throw err
  }
})

const favoriteGenresSchema = z.object({
  genres: z
    .array(z.string().trim().min(1, 'Gênero inválido.').max(30, 'Gênero muito longo.'), 'A lista deve ser um array.')
    .max(10, 'Muitos gêneros selecionados.')
    .default([]),
})

router.put('/me/favorite-genres', async (req: AuthedRequest, res) => {
  const parsed = favoriteGenresSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const seen = new Set<string>()
  const genres: string[] = []
  for (const genre of parsed.data.genres) {
    const key = genre.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    genres.push(genre)
  }

  await db
    .update(users)
    .set({ favoriteGenres: genres, updatedAt: new Date() })
    .where(eq(users.id, req.userId!))
  res.json({ favoriteGenres: genres })
})

const importRecentSchema = z.object({
  albumIds: z.array(z.string().trim().min(1).max(100, 'Identificador inválido.'), 'A lista deve ser um array.').max(30, 'Muitos álbuns selecionados.'),
})

router.post('/me/spotify/import/recently-played', async (req: AuthedRequest, res) => {
  const parsed = importRecentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  try {
    const user = await getUserWithSpotify(req.userId!)
    const token = await getFreshAccessToken(user)
    const albums = await getRecentlyPlayedAlbums(token)
    const requested = new Set(parsed.data.albumIds)
    const selected = albums.filter((album) => requested.has(album.albumId))

    const userId = req.userId!
    const existing = await db
      .select({ albumId: listeningLogs.albumId, listenedAt: listeningLogs.listenedAt })
      .from(listeningLogs)
      .where(eq(listeningLogs.userId, userId))
    const existingKeys = new Set(existing.map((log) => `${log.albumId}|${log.listenedAt}`))

    let imported = 0
    for (const album of selected) {
      const listenedAt = album.lastPlayedAt.slice(0, 10)
      if (!isValidDate(listenedAt)) continue
      if (existingKeys.has(`${album.albumId}|${listenedAt}`)) continue
      await db.insert(listeningLogs).values({
        userId,
        albumId: album.albumId,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumArtworkUrl: album.artworkUrl,
        albumYear: parseYear(album.releaseDate),
        listenedAt,
      })
      imported += 1
    }

    res.status(201).json({ imported })
  } catch (err) {
    if (handleSpotifyError(res, err)) return
    throw err
  }
})

router.post('/me/spotify/import/saved-albums', async (req: AuthedRequest, res) => {
  try {
    const user = await getUserWithSpotify(req.userId!)
    const token = await getFreshAccessToken(user)
    const saved = await getSavedAlbums(token)

    if (saved.length === 0) {
      res.json({ listId: null, imported: 0 })
      return
    }

    const userId = req.userId!
    const [existingList] = await db
      .select()
      .from(lists)
      .where(and(eq(lists.userId, userId), eq(lists.name, 'Importado do Spotify')))
      .limit(1)

    let list = existingList
    if (!list) {
      const [created] = await db
        .insert(lists)
        .values({
          userId,
          name: 'Importado do Spotify',
          description: 'Álbuns salvos importados da sua biblioteca do Spotify.',
          isPublic: false,
        })
        .returning()
      list = created
    }
    if (!list) {
      res.status(500).json({ error: 'Não foi possível criar a lista.' })
      return
    }

    const inList = await db
      .select({ albumId: listAlbums.albumId })
      .from(listAlbums)
      .where(eq(listAlbums.listId, list.id))
    const inListSet = new Set(inList.map((row) => row.albumId))

    const [maxRow] = await db
      .select({ value: max(listAlbums.position) })
      .from(listAlbums)
      .where(eq(listAlbums.listId, list.id))
    let position = (maxRow?.value ?? -1) + 1

    let imported = 0
    for (const album of saved) {
      if (inListSet.has(album.albumId)) continue
      await db.insert(listAlbums).values({
        listId: list.id,
        albumId: album.albumId,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumArtworkUrl: album.artworkUrl,
        position,
      })
      position += 1
      imported += 1
    }

    res.json({ listId: list.id, imported })
  } catch (err) {
    if (handleSpotifyError(res, err)) return
    throw err
  }
})

router.delete('/me/spotify/connection', async (req: AuthedRequest, res) => {
  await db
    .update(users)
    .set({
      spotifyId: null,
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyTokenExpiresAt: null,
      spotifyConnectedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.userId!))
  res.status(204).end()
})

function parseYear(releaseDate: string | null): number | null {
  if (!releaseDate) return null
  const year = Number(releaseDate.slice(0, 4))
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return null
  return year
}

export default router

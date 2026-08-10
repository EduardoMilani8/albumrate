import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  type AnyColumn,
} from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { follows, listAlbums, lists, listeningLogs, physicalCollection, reviews, users } from '../schema.js'

const router = Router()

const userIdSchema = z.object({ id: z.string().uuid('Identificador de usuário inválido.') })

const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Digite algo para buscar.')
    .max(60, 'A busca deve ter no máximo 60 caracteres.'),
})

const feedQuerySchema = z.object({
  before: z.string().optional(),
  beforeId: z.string().uuid('Identificador inválido.').optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const FEED_LIMIT = 20

function userJson(
  user: {
    id: string
    name: string | null
    avatarUrl: string | null
    country: string | null
    favoriteGenres: string[] | null
  },
  extra: { isFollowing?: boolean } = {},
) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    country: user.country,
    favoriteGenres: user.favoriteGenres ?? [],
    ...extra,
  }
}

async function userExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, id))
  return row !== undefined
}

async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
  return row !== undefined
}

// Condição de cursor para paginação: tudo estritamente anterior a (createdAt, id).
function cursorCondition(
  before: string | undefined,
  beforeId: string | undefined,
  createdAt: AnyColumn,
  id: AnyColumn,
) {
  if (!before || !beforeId) return undefined
  return sql`(${createdAt} < ${before} OR (${createdAt} = ${before} AND ${id} < ${beforeId}))`
}

// Busca de usuários pelo nome (descoberta de perfis para seguir).
// Registrada ANTES de /users/:id para o "search" não cair no parâmetro :id.
router.get('/users/search', async (req: AuthedRequest, res) => {
  const parsed = searchQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' })
    return
  }
  const q = parsed.data.q
  const me = req.userId!

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      country: users.country,
      favoriteGenres: users.favoriteGenres,
    })
    .from(users)
    .where(and(sql`${users.id} <> ${me}`, ilike(users.name, `%${q}%`)))
    .orderBy(asc(users.name))
    .limit(20)

  const followingSet = new Set<string>()
  if (rows.length > 0) {
    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(
        and(eq(follows.followerId, me), inArray(follows.followingId, rows.map((row) => row.id))),
      )
    for (const row of followingRows) followingSet.add(row.followingId)
  }

  res.json({ users: rows.map((row) => userJson(row, { isFollowing: followingSet.has(row.id) })) })
})

// Perfil público de um usuário: dados básicos + contadores + estado de follow.
router.get('/users/:id', async (req: AuthedRequest, res) => {
  const parsed = userIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }
  const targetId = parsed.data.id
  const me = req.userId!

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      country: users.country,
      favoriteGenres: users.favoriteGenres,
    })
    .from(users)
    .where(eq(users.id, targetId))

  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }

  const [reviewRow, followersRow, followingRow, collectionRow] = await Promise.all([
    db.select({ value: count() }).from(reviews).where(eq(reviews.userId, targetId)),
    db.select({ value: count() }).from(follows).where(eq(follows.followingId, targetId)),
    db.select({ value: count() }).from(follows).where(eq(follows.followerId, targetId)),
    db.select({ value: count() }).from(physicalCollection).where(eq(physicalCollection.userId, targetId)),
  ]).then((rows) => rows.map(([row]) => row))

  const following = targetId !== me ? await isFollowing(me, targetId) : false

  res.json({
    user: {
      ...userJson(user),
      counts: {
        reviews: reviewRow?.value ?? 0,
        followers: followersRow?.value ?? 0,
        following: followingRow?.value ?? 0,
        collection: collectionRow?.value ?? 0,
      },
      isFollowing: following,
      isSelf: targetId === me,
    },
  })
})

// Resenhas recentes de um usuário (perfil público). Sem resenha privada hoje.
router.get('/users/:id/reviews', async (req: AuthedRequest, res) => {
  const parsed = userIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }
  const targetId = parsed.data.id

  const rows = await db
    .select({
      id: reviews.id,
      albumId: reviews.albumId,
      albumTitle: reviews.albumTitle,
      albumArtist: reviews.albumArtist,
      albumArtworkUrl: reviews.albumArtworkUrl,
      rating: reviews.rating,
      reviewText: reviews.reviewText,
      listenedAt: reviews.listenedAt,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(eq(reviews.userId, targetId))
    .orderBy(desc(reviews.createdAt))
    .limit(50)

  res.json({
    reviews: rows.map((row) => ({
      id: row.id,
      albumId: row.albumId,
      albumTitle: row.albumTitle,
      albumArtist: row.albumArtist,
      albumArtworkUrl: row.albumArtworkUrl,
      rating: row.rating,
      reviewText: row.reviewText,
      listenedAt: row.listenedAt,
      createdAt: row.createdAt.toISOString(),
    })),
  })
})

router.put('/users/:id/follow', async (req: AuthedRequest, res) => {
  const parsed = userIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }
  const targetId = parsed.data.id
  const me = req.userId!

  if (targetId === me) {
    res.status(400).json({ error: 'Você não pode seguir a si mesmo.' })
    return
  }
  if (!(await userExists(targetId))) {
    res.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }

  await db
    .insert(follows)
    .values({ followerId: me, followingId: targetId })
    .onConflictDoNothing()

  res.status(204).end()
})

router.delete('/users/:id/follow', async (req: AuthedRequest, res) => {
  const parsed = userIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }
  const targetId = parsed.data.id
  const me = req.userId!

  if (targetId === me) {
    res.status(400).json({ error: 'Você não pode deixar de seguir a si mesmo.' })
    return
  }
  if (!(await userExists(targetId))) {
    res.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }

  await db
    .delete(follows)
    .where(and(eq(follows.followerId, me), eq(follows.followingId, targetId)))

  res.status(204).end()
})

interface ReviewFeedRow {
  id: string
  userId: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  rating: number
  reviewText: string | null
  listenedAt: string
  createdAt: Date
  userName: string | null
  userAvatarUrl: string | null
}

function reviewFeedItem(row: ReviewFeedRow) {
  return {
    type: 'review' as const,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    user: { id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl },
    album: {
      albumId: row.albumId,
      title: row.albumTitle,
      artist: row.albumArtist,
      artworkUrl: row.albumArtworkUrl,
    },
    rating: row.rating,
    reviewText: row.reviewText,
    listenedAt: row.listenedAt,
  }
}

interface LogFeedRow {
  id: string
  userId: string
  albumId: string
  albumTitle: string
  albumArtist: string
  albumArtworkUrl: string | null
  listenedAt: string
  createdAt: Date
  userName: string | null
  userAvatarUrl: string | null
}

function logFeedItem(row: LogFeedRow) {
  return {
    type: 'log' as const,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    user: { id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl },
    album: {
      albumId: row.albumId,
      title: row.albumTitle,
      artist: row.albumArtist,
      artworkUrl: row.albumArtworkUrl,
    },
    listenedAt: row.listenedAt,
  }
}

interface ListFeedRow {
  id: string
  userId: string
  name: string
  description: string | null
  createdAt: Date
  userName: string | null
  userAvatarUrl: string | null
  albumCount: number
  coverArtworkUrl: string | null
}

function listFeedItem(row: ListFeedRow) {
  return {
    type: 'list' as const,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    user: { id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl },
    list: {
      name: row.name,
      description: row.description,
      albumCount: row.albumCount,
      coverArtworkUrl: row.coverArtworkUrl,
    },
  }
}

// Feed da home: últimas atividades (reviews, logs de escuta e listas públicas)
// dos usuários que o usuário segue, ordenadas por data de criação (mais recente
// primeiro), paginado por cursor (createdAt + id de desempate).
router.get('/feed', async (req: AuthedRequest, res) => {
  const parsed = feedQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' })
    return
  }
  const { before, beforeId, limit } = parsed.data
  const pageSize = limit ?? FEED_LIMIT
  const me = req.userId!

  const followingRows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, me))
  const followingIds = followingRows.map((row) => row.followingId)

  if (followingIds.length === 0) {
    res.json({ items: [], nextBefore: null, nextBeforeId: null, followingCount: 0 })
    return
  }

  const reviewCursor = cursorCondition(before, beforeId, reviews.createdAt, reviews.id)
  const logCursor = cursorCondition(before, beforeId, listeningLogs.createdAt, listeningLogs.id)
  const listCursor = cursorCondition(before, beforeId, lists.createdAt, lists.id)

  const [reviewRows, logRows, listRows] = await Promise.all([
    db
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
        userName: users.name,
        userAvatarUrl: users.avatarUrl,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.userId))
      .where(and(inArray(reviews.userId, followingIds), reviewCursor))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(pageSize + 1),
    db
      .select({
        id: listeningLogs.id,
        userId: listeningLogs.userId,
        albumId: listeningLogs.albumId,
        albumTitle: listeningLogs.albumTitle,
        albumArtist: listeningLogs.albumArtist,
        albumArtworkUrl: listeningLogs.albumArtworkUrl,
        listenedAt: listeningLogs.listenedAt,
        createdAt: listeningLogs.createdAt,
        userName: users.name,
        userAvatarUrl: users.avatarUrl,
      })
      .from(listeningLogs)
      .innerJoin(users, eq(users.id, listeningLogs.userId))
      .where(and(inArray(listeningLogs.userId, followingIds), logCursor))
      .orderBy(desc(listeningLogs.createdAt), desc(listeningLogs.id))
      .limit(pageSize + 1),
    db
      .select({
        id: lists.id,
        userId: lists.userId,
        name: lists.name,
        description: lists.description,
        createdAt: lists.createdAt,
        userName: users.name,
        userAvatarUrl: users.avatarUrl,
      })
      .from(lists)
      .innerJoin(users, eq(users.id, lists.userId))
      .where(and(inArray(lists.userId, followingIds), eq(lists.isPublic, true), listCursor))
      .orderBy(desc(lists.createdAt), desc(lists.id))
      .limit(pageSize + 1),
  ])

  const listCounts = new Map<string, number>()
  const listCovers = new Map<string, string | null>()
  if (listRows.length > 0) {
    const listIds = listRows.map((row) => row.id)
    const countRows = await db
      .select({ listId: listAlbums.listId, value: count() })
      .from(listAlbums)
      .where(inArray(listAlbums.listId, listIds))
      .groupBy(listAlbums.listId)
    for (const row of countRows) listCounts.set(row.listId, row.value)

    const coverRows = await db
      .select({ listId: listAlbums.listId, albumArtworkUrl: listAlbums.albumArtworkUrl })
      .from(listAlbums)
      .where(inArray(listAlbums.listId, listIds))
      .orderBy(asc(listAlbums.position))
    const seen = new Set<string>()
    for (const row of coverRows) {
      if (seen.has(row.listId)) continue
      seen.add(row.listId)
      listCovers.set(row.listId, row.albumArtworkUrl)
    }
  }

  const items: Array<ReturnType<typeof reviewFeedItem | typeof logFeedItem | typeof listFeedItem>> = [
    ...reviewRows.map(reviewFeedItem),
    ...logRows.map(logFeedItem),
    ...listRows.map((row) =>
      listFeedItem({
        ...row,
        albumCount: listCounts.get(row.id) ?? 0,
        coverArtworkUrl: listCovers.get(row.id) ?? null,
      }),
    ),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))

  const page = items.slice(0, pageSize)
  const last = page[page.length - 1]
  const hasMore = items.length > pageSize

  res.json({
    items: page,
    nextBefore: hasMore && last ? last.createdAt : null,
    nextBeforeId: hasMore && last ? last.id : null,
    followingCount: followingIds.length,
  })
})

export default router

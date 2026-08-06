import { and, asc, desc, eq, inArray, max } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { listAlbums, lists } from '../schema.js'
import type { AlbumList, ListAlbum } from '../schema.js'

const router = Router()

const listIdSchema = z.object({ id: z.string().uuid('Identificador da lista inválido.') })

const createListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dê um nome para a lista.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'A descrição deve ter no máximo 500 caracteres.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  isPublic: z.boolean().optional().default(false),
})

const updateListSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dê um nome para a lista.')
    .max(100, 'O nome deve ter no máximo 100 caracteres.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'A descrição deve ter no máximo 500 caracteres.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  isPublic: z.boolean().optional(),
})

const addAlbumSchema = z.object({
  albumId: z
    .string()
    .trim()
    .min(1, 'Identificador do álbum é obrigatório.')
    .max(100, 'Identificador do álbum inválido.'),
  albumTitle: z.string().trim().max(200).default(''),
  albumArtist: z.string().trim().max(200).default(''),
  albumArtworkUrl: z.string().url().max(500).nullable().optional(),
})

const reorderSchema = z.object({
  albumIds: z
    .array(
      z.string().trim().min(1).max(100, 'Identificador de álbum inválido.'),
      'A lista de álbuns deve ser um array.',
    )
    .max(500, 'Muitos álbuns.'),
})

function toListJson(
  list: AlbumList,
  extra: { albumCount: number; coverArtworkUrl: string | null },
) {
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    isPublic: list.isPublic,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    albumCount: extra.albumCount,
    coverArtworkUrl: extra.coverArtworkUrl,
  }
}

function toAlbumJson(album: ListAlbum) {
  return {
    id: album.id,
    albumId: album.albumId,
    albumTitle: album.albumTitle,
    albumArtist: album.albumArtist,
    albumArtworkUrl: album.albumArtworkUrl,
    position: album.position,
    createdAt: album.createdAt.toISOString(),
  }
}

router.post('/me/lists', async (req: AuthedRequest, res) => {
  const parsed = createListSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = parsed.data
  const [list] = await db
    .insert(lists)
    .values({
      userId: req.userId!,
      name: data.name,
      description: data.description ?? null,
      isPublic: data.isPublic,
    })
    .returning()

  if (!list) {
    res.status(500).json({ error: 'Não foi possível criar a lista.' })
    return
  }
  res.status(201).json({ list: toListJson(list, { albumCount: 0, coverArtworkUrl: null }) })
})

router.get('/me/lists', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const rows = await db
    .select()
    .from(lists)
    .where(eq(lists.userId, userId))
    .orderBy(desc(lists.createdAt))

  const listIds = rows.map((list) => list.id)
  const firstAlbumByList = new Map<string, string | null>()
  const countByList = new Map<string, number>()

  if (listIds.length > 0) {
    const albumRows = await db
      .select({
        listId: listAlbums.listId,
        albumArtworkUrl: listAlbums.albumArtworkUrl,
      })
      .from(listAlbums)
      .where(inArray(listAlbums.listId, listIds))
      .orderBy(asc(listAlbums.position))

    for (const row of albumRows) {
      countByList.set(row.listId, (countByList.get(row.listId) ?? 0) + 1)
      if (!firstAlbumByList.has(row.listId)) {
        firstAlbumByList.set(row.listId, row.albumArtworkUrl)
      }
    }
  }

  res.json({
    lists: rows.map((list) =>
      toListJson(list, {
        albumCount: countByList.get(list.id) ?? 0,
        coverArtworkUrl: firstAlbumByList.get(list.id) ?? null,
      }),
    ),
  })
})

router.get('/me/lists/:id', async (req: AuthedRequest, res) => {
  const parsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const [list] = await db
    .select()
    .from(lists)
    .where(and(eq(lists.id, parsed.data.id), eq(lists.userId, req.userId!)))

  if (!list) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }

  const albums = await db
    .select()
    .from(listAlbums)
    .where(eq(listAlbums.listId, list.id))
    .orderBy(asc(listAlbums.position))

  res.json({ list: toListJson(list, { albumCount: albums.length, coverArtworkUrl: albums[0]?.albumArtworkUrl ?? null }), albums: albums.map(toAlbumJson) })
})

router.get('/lists/:id', async (req: AuthedRequest, res) => {
  const parsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const [list] = await db.select().from(lists).where(eq(lists.id, parsed.data.id))
  if (!list || (!list.isPublic && list.userId !== req.userId)) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }

  const albums = await db
    .select()
    .from(listAlbums)
    .where(eq(listAlbums.listId, list.id))
    .orderBy(asc(listAlbums.position))

  res.json({ list: toListJson(list, { albumCount: albums.length, coverArtworkUrl: albums[0]?.albumArtworkUrl ?? null }), albums: albums.map(toAlbumJson) })
})

router.patch('/me/lists/:id', async (req: AuthedRequest, res) => {
  const parsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const bodyParsed = updateListSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = bodyParsed.data
  const [list] = await db
    .update(lists)
    .set({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(lists.id, parsed.data.id), eq(lists.userId, req.userId!)))
    .returning()

  if (!list) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }
  res.json({ list: toListJson(list, { albumCount: 0, coverArtworkUrl: null }) })
})

router.delete('/me/lists/:id', async (req: AuthedRequest, res) => {
  const parsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const deleted = await db
    .delete(lists)
    .where(and(eq(lists.id, parsed.data.id), eq(lists.userId, req.userId!)))
    .returning({ id: lists.id })

  if (deleted.length === 0) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }
  res.status(204).end()
})

router.post('/me/lists/:id/albums', async (req: AuthedRequest, res) => {
  const listParsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!listParsed.success) {
    res.status(400).json({ error: listParsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const bodyParsed = addAlbumSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const listId = listParsed.data.id
  const data = bodyParsed.data
  const userId = req.userId!

  const [existingList] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
  if (!existingList) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }

  const [alreadyExists] = await db
    .select({ id: listAlbums.id })
    .from(listAlbums)
    .where(and(eq(listAlbums.listId, listId), eq(listAlbums.albumId, data.albumId)))
  if (alreadyExists) {
    res.status(409).json({ error: 'Este álbum já está nesta lista.' })
    return
  }

  const [positionRow] = await db
    .select({ value: max(listAlbums.position) })
    .from(listAlbums)
    .where(eq(listAlbums.listId, listId))
  const position = (positionRow?.value ?? -1) + 1

  const [saved] = await db
    .insert(listAlbums)
    .values({
      listId,
      albumId: data.albumId,
      albumTitle: data.albumTitle,
      albumArtist: data.albumArtist,
      albumArtworkUrl: data.albumArtworkUrl ?? null,
      position,
    })
    .returning()

  if (!saved) {
    res.status(500).json({ error: 'Não foi possível adicionar o álbum.' })
    return
  }
  res.status(201).json({ album: toAlbumJson(saved) })
})

router.delete('/me/lists/:id/albums/:albumId', async (req: AuthedRequest, res) => {
  const listParsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!listParsed.success) {
    res.status(400).json({ error: listParsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const albumId = String(req.params.albumId)
  if (!albumId || albumId.length > 100) {
    res.status(400).json({ error: 'Identificador do álbum inválido.' })
    return
  }

  const userId = req.userId!
  const [list] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listParsed.data.id), eq(lists.userId, userId)))
  if (!list) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }

  const deleted = await db
    .delete(listAlbums)
    .where(and(eq(listAlbums.listId, list.id), eq(listAlbums.albumId, albumId)))
    .returning({ id: listAlbums.id })

  if (deleted.length === 0) {
    res.status(404).json({ error: 'Álbum não encontrado nesta lista.' })
    return
  }

  await db.transaction(async (tx) => {
    const remaining = await tx
      .select({ id: listAlbums.id, position: listAlbums.position })
      .from(listAlbums)
      .where(eq(listAlbums.listId, list.id))
      .orderBy(asc(listAlbums.position))
    for (const [index, row] of remaining.entries()) {
      await tx
        .update(listAlbums)
        .set({ position: index })
        .where(eq(listAlbums.id, row.id))
    }
  })

  res.status(204).end()
})

router.put('/me/lists/:id/albums', async (req: AuthedRequest, res) => {
  const listParsed = listIdSchema.safeParse({ id: String(req.params.id) })
  if (!listParsed.success) {
    res.status(400).json({ error: listParsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const bodyParsed = reorderSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const userId = req.userId!
  const listId = listParsed.data.id
  const [list] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
  if (!list) {
    res.status(404).json({ error: 'Lista não encontrada.' })
    return
  }

  const current = await db
    .select({ albumId: listAlbums.albumId })
    .from(listAlbums)
    .where(eq(listAlbums.listId, listId))

  const currentSet = new Set(current.map((row) => row.albumId))
  const requested = bodyParsed.data.albumIds
  const requestedSet = new Set(requested)
  if (requestedSet.size !== requested.length || requested.length !== currentSet.size) {
    res.status(400).json({ error: 'A nova ordem deve conter exatamente os álbuns da lista.' })
    return
  }
  for (const albumId of requested) {
    if (!currentSet.has(albumId)) {
      res.status(400).json({ error: 'A nova ordem deve conter exatamente os álbuns da lista.' })
      return
    }
  }

  await db.transaction(async (tx) => {
    for (const [position, albumId] of requested.entries()) {
      await tx
        .update(listAlbums)
        .set({ position })
        .where(and(eq(listAlbums.listId, listId), eq(listAlbums.albumId, albumId)))
    }
  })

  const albums = await db
    .select()
    .from(listAlbums)
    .where(eq(listAlbums.listId, listId))
    .orderBy(asc(listAlbums.position))

  res.json({ albums: albums.map(toAlbumJson) })
})

export default router

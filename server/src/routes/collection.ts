import { and, asc, desc, eq, ilike } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { isValidDate, todayLocalISO } from '../lib/dates.js'
import { physicalCollection } from '../schema.js'
import type { PhysicalCollectionItem } from '../schema.js'

const router = Router()

const mediaTypeSchema = z.enum(['vinil', 'cd', 'cassete', 'digital'], {
  error: 'Tipo de mídia inválido.',
})

const conditionSchema = z.enum(['novo', 'usado', 'desgastado'], {
  error: 'Condição da mídia inválida.',
})

const collectionIdSchema = z.object({ id: z.string().uuid('Identificador de item inválido.') })

const userIdSchema = z.object({ id: z.string().uuid('Identificador de usuário inválido.') })

const listQuerySchema = z.object({
  q: z.string().trim().max(100, 'A busca deve ter no máximo 100 caracteres.').optional(),
  mediaType: mediaTypeSchema.optional(),
})

const albumFieldsSchema = z.object({
  albumId: z
    .string()
    .trim()
    .min(1, 'Identificador do álbum é obrigatório.')
    .max(100, 'Identificador do álbum inválido.'),
  albumTitle: z.string().trim().max(200).default(''),
  albumArtist: z.string().trim().max(200).default(''),
  albumArtworkUrl: z.string().url().max(500).nullable().optional(),
})

const priceSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}([.,]\d{1,2})?$/, 'Valor pago inválido.')
  .transform((value) => value.replace(',', '.'))

const createItemSchema = z.object({
  ...albumFieldsSchema.shape,
  mediaType: mediaTypeSchema,
  editionNote: z
    .string()
    .trim()
    .max(200, 'A edição/prensagem deve ter no máximo 200 caracteres.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  condition: conditionSchema,
  pricePaid: priceSchema.nullable().optional().transform((value) => value || null),
  acquiredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
    .refine(isValidDate, 'Data inválida.')
    .refine((value) => value <= todayLocalISO(), 'A data não pode ser no futuro.'),
})

const updateItemSchema = z.object({
  mediaType: mediaTypeSchema.optional(),
  editionNote: z
    .string()
    .trim()
    .max(200, 'A edição/prensagem deve ter no máximo 200 caracteres.')
    .nullable()
    .optional()
    .transform((value) => value || null),
  condition: conditionSchema.optional(),
  pricePaid: priceSchema.nullable().optional().transform((value) => value || null),
  acquiredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
    .refine(isValidDate, 'Data inválida.')
    .refine((value) => value <= todayLocalISO(), 'A data não pode ser no futuro.')
    .optional(),
})

function toItemJson(item: PhysicalCollectionItem) {
  return {
    id: item.id,
    albumId: item.albumId,
    albumTitle: item.albumTitle,
    albumArtist: item.albumArtist,
    albumArtworkUrl: item.albumArtworkUrl,
    mediaType: item.mediaType,
    editionNote: item.editionNote,
    condition: item.condition,
    pricePaid: item.pricePaid,
    acquiredAt: item.acquiredAt,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function toPublicItemJson(item: PhysicalCollectionItem) {
  return {
    id: item.id,
    albumId: item.albumId,
    albumTitle: item.albumTitle,
    albumArtist: item.albumArtist,
    albumArtworkUrl: item.albumArtworkUrl,
    mediaType: item.mediaType,
    acquiredAt: item.acquiredAt,
  }
}

router.get('/me/collection', async (req: AuthedRequest, res) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' })
    return
  }
  const { q, mediaType } = parsed.data
  const userId = req.userId!

  const conditions = [eq(physicalCollection.userId, userId)]
  if (mediaType) conditions.push(eq(physicalCollection.mediaType, mediaType))
  if (q) conditions.push(ilike(physicalCollection.albumTitle, `%${q}%`))

  const rows = await db
    .select()
    .from(physicalCollection)
    .where(and(...conditions))
    .orderBy(desc(physicalCollection.acquiredAt), desc(physicalCollection.createdAt))

  res.json({ items: rows.map(toItemJson) })
})

router.post('/me/collection', async (req: AuthedRequest, res) => {
  const parsed = createItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = parsed.data
  const now = new Date()

  const [saved] = await db
    .insert(physicalCollection)
    .values({
      userId: req.userId!,
      albumId: data.albumId,
      albumTitle: data.albumTitle,
      albumArtist: data.albumArtist,
      albumArtworkUrl: data.albumArtworkUrl ?? null,
      mediaType: data.mediaType,
      editionNote: data.editionNote ?? null,
      condition: data.condition,
      pricePaid: data.pricePaid ?? null,
      acquiredAt: data.acquiredAt,
      updatedAt: now,
    })
    .returning()

  if (!saved) {
    res.status(500).json({ error: 'Não foi possível adicionar o item à coleção.' })
    return
  }
  res.status(201).json({ item: toItemJson(saved) })
})

router.patch('/me/collection/:id', async (req: AuthedRequest, res) => {
  const parsed = collectionIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const bodyParsed = updateItemSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = bodyParsed.data
  const [item] = await db
    .update(physicalCollection)
    .set({
      ...(data.mediaType !== undefined ? { mediaType: data.mediaType } : {}),
      ...(data.editionNote !== undefined ? { editionNote: data.editionNote } : {}),
      ...(data.condition !== undefined ? { condition: data.condition } : {}),
      ...(data.pricePaid !== undefined ? { pricePaid: data.pricePaid } : {}),
      ...(data.acquiredAt !== undefined ? { acquiredAt: data.acquiredAt } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(physicalCollection.id, parsed.data.id), eq(physicalCollection.userId, req.userId!)))
    .returning()

  if (!item) {
    res.status(404).json({ error: 'Item não encontrado na sua coleção.' })
    return
  }
  res.json({ item: toItemJson(item) })
})

router.delete('/me/collection/:id', async (req: AuthedRequest, res) => {
  const parsed = collectionIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const deleted = await db
    .delete(physicalCollection)
    .where(and(eq(physicalCollection.id, parsed.data.id), eq(physicalCollection.userId, req.userId!)))
    .returning({ id: physicalCollection.id })

  if (deleted.length === 0) {
    res.status(404).json({ error: 'Item não encontrado na sua coleção.' })
    return
  }
  res.status(204).end()
})

// Coleção pública de um usuário: sem price_paid, condição e edição.
router.get('/users/:id/collection', async (req: AuthedRequest, res) => {
  const parsed = userIdSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const rows = await db
    .select()
    .from(physicalCollection)
    .where(eq(physicalCollection.userId, parsed.data.id))
    .orderBy(asc(physicalCollection.acquiredAt))

  res.json({ items: rows.map(toPublicItemJson) })
})

export default router

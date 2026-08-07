import { and, asc, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { todayLocalISO } from '../lib/dates.js'
import {
  albumOfMonth,
  albumOfMonthComments,
  users,
  type AlbumOfMonth,
  type NewAlbumOfMonth,
} from '../schema.js'

const router = Router()

const albumOfMonthSchema = z.object({
  albumId: z.string().trim().min(1, 'Identificador do álbum inválido.').max(100),
  albumTitle: z.string().trim().min(1, 'Informe o título do álbum.').max(200),
  albumArtist: z.string().trim().min(1, 'Informe o artista do álbum.').max(200),
  albumArtworkUrl: z.string().url('Capa inválida.').max(500).nullable().optional(),
  month: z.number().int('Mês inválido.').min(1, 'Mês inválido.').max(12, 'Mês inválido.'),
  year: z.number().int('Ano inválido.').min(1900, 'Ano inválido.').max(2100, 'Ano inválido.'),
})

const commentSchema = z.object({
  commentText: z
    .string()
    .trim()
    .min(1, 'Escreva um comentário.')
    .max(1000, 'O comentário deve ter no máximo 1000 caracteres.'),
})

const idSchema = z.object({ id: z.string().uuid('Identificador inválido.') })

function pickJson(pick: AlbumOfMonth) {
  return {
    id: pick.id,
    albumId: pick.albumId,
    albumTitle: pick.albumTitle,
    albumArtist: pick.albumArtist,
    albumArtworkUrl: pick.albumArtworkUrl,
    month: pick.month,
    year: pick.year,
    createdAt: pick.createdAt.toISOString(),
    updatedAt: pick.updatedAt.toISOString(),
  }
}

async function isAdminUser(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
  return user?.isAdmin ?? false
}

async function findAlbumOfMonth(id: string): Promise<AlbumOfMonth | null> {
  const [pick] = await db.select().from(albumOfMonth).where(eq(albumOfMonth.id, id)).limit(1)
  return pick ?? null
}

// Álbum do mês atual: devolve o pick do mês corrente (ou null se o admin ainda
// não definiu). Sempre o mês/ano locais do servidor.
router.get('/album-of-month', async (req: AuthedRequest, res) => {
  const iso = todayLocalISO()
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))

  const [pick] = await db
    .select()
    .from(albumOfMonth)
    .where(and(eq(albumOfMonth.month, month), eq(albumOfMonth.year, year)))
    .limit(1)

  res.json({ pick: pick ? pickJson(pick) : null })
})

// Histórico de álbuns do mês, do mais recente para o mais antigo.
router.get('/album-of-month/history', async (req: AuthedRequest, res) => {
  const rows = await db
    .select()
    .from(albumOfMonth)
    .orderBy(desc(albumOfMonth.year), desc(albumOfMonth.month))

  res.json({ items: rows.map(pickJson) })
})

// Um álbum do mês específico pelo id (usado ao navegar pelo histórico).
// Registrada DEPOIS de /history para "history" não cair no parâmetro :id.
router.get('/album-of-month/:id', async (req: AuthedRequest, res) => {
  const parsed = idSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const pick = await findAlbumOfMonth(parsed.data.id)
  if (!pick) {
    res.status(404).json({ error: 'Álbum do mês não encontrado.' })
    return
  }

  res.json({ pick: pickJson(pick) })
})

// Admin define (ou corrige) o álbum de um mês. Como só pode existir um por mês,
// salvar de novo no mesmo mês substitui o anterior.
router.post('/album-of-month', async (req: AuthedRequest, res) => {
  if (!(await isAdminUser(req.userId!))) {
    res.status(403).json({ error: 'Apenas administradores podem definir o álbum do mês.' })
    return
  }

  const parsed = albumOfMonthSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = parsed.data
  const now = new Date()
  const values: NewAlbumOfMonth = {
    albumId: data.albumId,
    albumTitle: data.albumTitle,
    albumArtist: data.albumArtist,
    albumArtworkUrl: data.albumArtworkUrl ?? null,
    month: data.month,
    year: data.year,
    updatedAt: now,
  }

  const [saved] = await db
    .insert(albumOfMonth)
    .values(values)
    .onConflictDoUpdate({
      target: [albumOfMonth.month, albumOfMonth.year],
      set: {
        albumId: data.albumId,
        albumTitle: data.albumTitle,
        albumArtist: data.albumArtist,
        albumArtworkUrl: data.albumArtworkUrl ?? null,
        updatedAt: now,
      },
    })
    .returning()

  if (!saved) {
    res.status(500).json({ error: 'Não foi possível salvar o álbum do mês.' })
    return
  }

  res.status(200).json({ pick: pickJson(saved) })
})

// Comentários da discussão do mês, em ordem cronológica. Não expõe e-mail.
router.get('/album-of-month/:id/comments', async (req: AuthedRequest, res) => {
  const parsed = idSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const rows = await db
    .select({
      id: albumOfMonthComments.id,
      albumOfMonthId: albumOfMonthComments.albumOfMonthId,
      userId: albumOfMonthComments.userId,
      commentText: albumOfMonthComments.commentText,
      createdAt: albumOfMonthComments.createdAt,
      userName: users.name,
      userAvatarUrl: users.avatarUrl,
    })
    .from(albumOfMonthComments)
    .innerJoin(users, eq(users.id, albumOfMonthComments.userId))
    .where(eq(albumOfMonthComments.albumOfMonthId, parsed.data.id))
    .orderBy(asc(albumOfMonthComments.createdAt))

  res.json({
    comments: rows.map((row) => ({
      id: row.id,
      albumOfMonthId: row.albumOfMonthId,
      commentText: row.commentText,
      createdAt: row.createdAt.toISOString(),
      user: { id: row.userId, name: row.userName, avatarUrl: row.userAvatarUrl },
    })),
  })
})

// Posta um comentário na discussão do mês. Qualquer usuário logado pode comentar.
router.post('/album-of-month/:id/comments', async (req: AuthedRequest, res) => {
  const parsedId = idSchema.safeParse({ id: String(req.params.id) })
  if (!parsedId.success) {
    res.status(400).json({ error: parsedId.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const parsedBody = commentSchema.safeParse(req.body)
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  if (!(await findAlbumOfMonth(parsedId.data.id))) {
    res.status(404).json({ error: 'Álbum do mês não encontrado.' })
    return
  }

  const inserted = await db
    .insert(albumOfMonthComments)
    .values({
      albumOfMonthId: parsedId.data.id,
      userId: req.userId!,
      commentText: parsedBody.data.commentText,
    })
    .returning()

  const comment = inserted[0]
  if (!comment) {
    res.status(500).json({ error: 'Não foi possível salvar o comentário.' })
    return
  }

  const [author] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, comment.userId))

  res.status(201).json({
    comment: {
      id: comment.id,
      albumOfMonthId: comment.albumOfMonthId,
      commentText: comment.commentText,
      createdAt: comment.createdAt.toISOString(),
      user: { id: comment.userId, name: author?.name ?? null, avatarUrl: author?.avatarUrl ?? null },
    },
  })
})

export default router

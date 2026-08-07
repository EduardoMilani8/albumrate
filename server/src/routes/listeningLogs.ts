import { and, desc, eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { resolveArtistCountry } from '../lib/country.js'
import { isValidDate, todayLocalISO } from '../lib/dates.js'
import { listeningLogs } from '../schema.js'
import type { ListeningLog } from '../schema.js'

const router = Router()

const YEAR_MONTH_REGEX = /^\d{4}-\d{2}$/

const createLogSchema = z.object({
  albumId: z
    .string()
    .trim()
    .min(1, 'Identificador do álbum é obrigatório.')
    .max(100, 'Identificador do álbum inválido.'),
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
  listenedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.')
    .refine(isValidDate, 'Data inválida.')
    .refine((value) => value <= todayLocalISO(), 'A data não pode ser no futuro.')
    .optional(),
})

const listQuerySchema = z.object({
  before: z
    .string()
    .regex(YEAR_MONTH_REGEX, 'O parâmetro "before" deve estar no formato AAAA-MM.')
    .optional(),
  limit: z.coerce.number().int().min(1).max(36).optional(),
})

const logIdSchema = z.object({ id: z.string().uuid('Identificador do registro inválido.') })

function toLogJson(log: ListeningLog) {
  return {
    id: log.id,
    albumId: log.albumId,
    albumTitle: log.albumTitle,
    albumArtist: log.albumArtist,
    albumArtworkUrl: log.albumArtworkUrl,
    listenedAt: log.listenedAt,
    createdAt: log.createdAt.toISOString(),
  }
}

router.post('/me/listening-logs', async (req: AuthedRequest, res) => {
  const parsed = createLogSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const data = parsed.data
  const [log] = await db
    .insert(listeningLogs)
    .values({
      userId: req.userId!,
      albumId: data.albumId,
      albumTitle: data.albumTitle,
      albumArtist: data.albumArtist,
      albumArtworkUrl: data.albumArtworkUrl ?? null,
      albumGenre: data.albumGenre ?? null,
      albumYear: data.albumYear ?? null,
      albumCountry: data.albumCountry ?? null,
      listenedAt: data.listenedAt ?? todayLocalISO(),
    })
    .returning()

  if (!log) {
    res.status(500).json({ error: 'Não foi possível registrar.' })
    return
  }

  // Enriquecimento best-effort do país do artista em background (cache + MusicBrainz).
  const artistName = data.albumArtist.trim()
  if (artistName && !(data.albumCountry ?? null)) {
    void (async () => {
      try {
        const country = await resolveArtistCountry(artistName)
        if (country) {
          await db
            .update(listeningLogs)
            .set({ albumCountry: country })
            .where(eq(listeningLogs.id, log.id))
        }
      } catch (err) {
        console.warn('[country] falha ao enriquecer log:', err)
      }
    })()
  }

  res.status(201).json({ log: toLogJson(log) })
})

router.get('/me/listening-logs', async (req: AuthedRequest, res) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos.' })
    return
  }

  const { before, limit } = parsed.data
  const userId = req.userId!

  const logs = await db
    .select()
    .from(listeningLogs)
    .where(eq(listeningLogs.userId, userId))
    .orderBy(desc(listeningLogs.listenedAt), desc(listeningLogs.createdAt))

  const filtered = before ? logs.filter((log) => log.listenedAt < `${before}-01`) : logs

  const monthsMap = new Map<string, ListeningLog[]>()
  for (const log of filtered) {
    const key = log.listenedAt.slice(0, 7)
    const bucket = monthsMap.get(key)
    if (bucket) bucket.push(log)
    else monthsMap.set(key, [log])
  }

  const monthKeys = [...monthsMap.keys()].sort((a, b) => b.localeCompare(a))
  const pageSize = limit ?? 12
  const pageKeys = monthKeys.slice(0, pageSize)

  res.json({
    months: pageKeys.map((key) => ({
      yearMonth: key,
      logs: (monthsMap.get(key) ?? []).map(toLogJson),
    })),
    nextBefore: monthKeys.length > pageSize ? monthKeys[pageSize] : null,
  })
})

router.delete('/me/listening-logs/:id', async (req: AuthedRequest, res) => {
  const parsed = logIdSchema.safeParse({ id: req.params.id })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const deleted = await db
    .delete(listeningLogs)
    .where(and(eq(listeningLogs.id, parsed.data.id), eq(listeningLogs.userId, req.userId!)))
    .returning({ id: listeningLogs.id })

  if (deleted.length === 0) {
    res.status(404).json({ error: 'Registro não encontrado.' })
    return
  }
  res.status(204).end()
})

export default router

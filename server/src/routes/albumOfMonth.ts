import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import {
  deriveStatus,
  ensureCandidates,
  getOrCreateVote,
  nextMonth,
  resolveDisplayedAlbum,
  tabulateIfDue,
  tabulateOverdueVotes,
  votePeriodFor,
} from '../lib/albumOfMonth.js'
import { type AuthedRequest } from '../lib/auth.js'
import {
  albumOfMonth,
  albumOfMonthComments,
  monthlyVoteBallots,
  monthlyVoteCandidates,
  monthlyVotes,
  users,
  type AlbumOfMonth,
  type MonthlyVoteCandidate,
} from '../schema.js'

const router = Router()

const commentSchema = z.object({
  commentText: z
    .string()
    .trim()
    .min(1, 'Escreva um comentário.')
    .max(1000, 'O comentário deve ter no máximo 1000 caracteres.'),
})

const idSchema = z.object({ id: z.string().uuid('Identificador inválido.') })

const voteSubmissionSchema = z.object({
  albumIds: z
    .array(
      z.string().trim().min(1, 'Identificador do álbum inválido.').max(100),
      'A lista de álbuns deve ser um array.',
    )
    .length(3, 'Selecione exatamente 3 álbuns diferentes.'),
})

function pickJson(pick: AlbumOfMonth) {
  return {
    id: pick.id,
    albumId: pick.albumId,
    albumTitle: pick.albumTitle,
    albumArtist: pick.albumArtist,
    albumArtworkUrl: pick.albumArtworkUrl,
    month: pick.month,
    year: pick.year,
    votes: pick.votes,
    position: pick.position,
    createdAt: pick.createdAt.toISOString(),
    updatedAt: pick.updatedAt.toISOString(),
  }
}

function candidateJson(candidate: MonthlyVoteCandidate) {
  return {
    id: candidate.id,
    albumId: candidate.albumId,
    albumTitle: candidate.albumTitle,
    albumArtist: candidate.albumArtist,
    albumArtworkUrl: candidate.albumArtworkUrl,
    reviewCount: candidate.reviewCount,
    averageRating: candidate.averageRating,
    position: candidate.position,
    votes: candidate.finalVotes,
    rank: candidate.finalRanking,
  }
}

async function findAlbumOfMonthById(id: string): Promise<AlbumOfMonth | null> {
  const [pick] = await db.select().from(albumOfMonth).where(eq(albumOfMonth.id, id)).limit(1)
  return pick ?? null
}

async function top3Of(year: number, month: number): Promise<MonthlyVoteCandidate[]> {
  const [vote] = await db
    .select({ id: monthlyVotes.id })
    .from(monthlyVotes)
    .where(and(eq(monthlyVotes.year, year), eq(monthlyVotes.month, month)))
    .limit(1)
  if (!vote) return []
  return db
    .select()
    .from(monthlyVoteCandidates)
    .where(
      and(
        eq(monthlyVoteCandidates.voteId, vote.id),
        isNotNull(monthlyVoteCandidates.finalRanking),
      ),
    )
    .orderBy(asc(monthlyVoteCandidates.finalRanking))
    .limit(3)
}

// Álbum do mês em destaque HOJE (vencedor já divulgado, ou o do mês anterior
// durante o intervalo das 00:00 às 08:00 do dia 1).
router.get('/album-of-month', async (_req: AuthedRequest, res) => {
  const pick = await resolveDisplayedAlbum()
  res.json({ pick: pick ? pickJson(pick) : null })
})

// Estado da votação para a tela: a eleição do mês corrente (resultado/divulgação)
// e a votação em andamento que elege o próximo mês (candidatos + meus votos).
router.get('/album-of-month/vote/state', async (req: AuthedRequest, res) => {
  const now = new Date()
  const cur = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const up = nextMonth(cur.year, cur.month)

  const curPeriod = votePeriodFor(cur.year, cur.month)
  const curStatus = deriveStatus(curPeriod, now)

  const current: {
    status: string
    opensAt: string
    closesAt: string
    revealAt: string
    results: ReturnType<typeof candidateJson>[] | null
  } = {
    status: curStatus,
    opensAt: curPeriod.opensAt.toISOString(),
    closesAt: curPeriod.closesAt.toISOString(),
    revealAt: curPeriod.revealAt.toISOString(),
    results: null,
  }

  const curVote = await getOrCreateVote(cur.year, cur.month)
  await tabulateIfDue(curVote, now)

  if (curStatus === 'revealed') {
    const results = await top3Of(cur.year, cur.month)
    current.results = results.map(candidateJson)
  }

  const upPeriod = votePeriodFor(up.year, up.month)
  const upStatus = deriveStatus(upPeriod, now)

  const upcoming: {
    status: string
    targetMonth: number
    targetYear: number
    opensAt: string
    closesAt: string
    revealAt: string
    candidates: ReturnType<typeof candidateJson>[] | null
    myVotes: string[]
  } = {
    status: upStatus,
    targetMonth: up.month,
    targetYear: up.year,
    opensAt: upPeriod.opensAt.toISOString(),
    closesAt: upPeriod.closesAt.toISOString(),
    revealAt: upPeriod.revealAt.toISOString(),
    candidates: null,
    myVotes: [],
  }

  const upVote = await getOrCreateVote(up.year, up.month)
  await ensureCandidates(upVote, now)

  if (upStatus === 'open') {
    const candidates = await db
      .select()
      .from(monthlyVoteCandidates)
      .where(eq(monthlyVoteCandidates.voteId, upVote.id))
      .orderBy(asc(monthlyVoteCandidates.position))
    upcoming.candidates = candidates.map(candidateJson)

    const ballots = await db
      .select({ albumId: monthlyVoteBallots.albumId })
      .from(monthlyVoteBallots)
      .where(
        and(eq(monthlyVoteBallots.voteId, upVote.id), eq(monthlyVoteBallots.userId, req.userId!)),
      )
    upcoming.myVotes = ballots.map((row) => row.albumId)
  }

  res.json({ current, upcoming })
})

// Submete os 3 votos do usuário (um por álbum, todos candidatos). Voto é
// definitivo: uma vez confirmado, não pode ser alterado.
router.post('/album-of-month/vote', async (req: AuthedRequest, res) => {
  const parsed = voteSubmissionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const albumIds = parsed.data.albumIds
  if (new Set(albumIds).size !== 3) {
    res.status(400).json({ error: 'Os 3 álbuns escolhidos devem ser diferentes.' })
    return
  }

  const now = new Date()
  const up = nextMonth(now.getFullYear(), now.getMonth() + 1)
  const period = votePeriodFor(up.year, up.month)
  if (deriveStatus(period, now) !== 'open') {
    res.status(400).json({ error: 'A votação não está aberta no momento.' })
    return
  }

  const vote = await getOrCreateVote(up.year, up.month)
  await ensureCandidates(vote, now)

  const [already] = await db
    .select({ id: monthlyVoteBallots.id })
    .from(monthlyVoteBallots)
    .where(
      and(eq(monthlyVoteBallots.voteId, vote.id), eq(monthlyVoteBallots.userId, req.userId!)),
    )
    .limit(1)
  if (already) {
    res
      .status(409)
      .json({ error: 'Você já votou nesta votação. O voto é definitivo e não pode ser alterado.' })
    return
  }

  const candidateRows = await db
    .select({ albumId: monthlyVoteCandidates.albumId })
    .from(monthlyVoteCandidates)
    .where(
      and(
        eq(monthlyVoteCandidates.voteId, vote.id),
        inArray(monthlyVoteCandidates.albumId, albumIds),
      ),
    )
  if (candidateRows.length !== 3) {
    res.status(400).json({ error: 'Todos os álbuns escolhidos precisam ser candidatos da votação.' })
    return
  }

  try {
    await db.transaction(async (tx) => {
      for (const albumId of albumIds) {
        await tx
          .insert(monthlyVoteBallots)
          .values({ voteId: vote.id, userId: req.userId!, albumId })
      }
    })
  } catch {
    // Corrida: dois envios simultâneos. A trigger de limite (máx 3) garante que
    // só o primeiro completa.
    res
      .status(409)
      .json({ error: 'Você já votou nesta votação. O voto é definitivo e não pode ser alterado.' })
    return
  }

  res.status(201).json({ voted: true, albumIds })
})

// Histórico: álbuns do mês consagrados (mais recentes primeiro), cada um com o
// top 3 da votação e a contagem de votos.
router.get('/album-of-month/history', async (_req: AuthedRequest, res) => {
  await tabulateOverdueVotes()

  const picks = await db
    .select()
    .from(albumOfMonth)
    .orderBy(desc(albumOfMonth.year), desc(albumOfMonth.month))

  let items: { pick: ReturnType<typeof pickJson>; top3: ReturnType<typeof candidateJson>[] }[] = []
  if (picks.length > 0) {
    const years = [...new Set(picks.map((pick) => pick.year))]
    const months = [...new Set(picks.map((pick) => pick.month))]
    const votes = await db
      .select({ id: monthlyVotes.id, year: monthlyVotes.year, month: monthlyVotes.month })
      .from(monthlyVotes)
      .where(and(inArray(monthlyVotes.year, years), inArray(monthlyVotes.month, months)))

    const voteByKey = new Map(votes.map((vote) => [`${vote.year}-${vote.month}`, vote]))
    const voteIds = votes.map((vote) => vote.id)
    const topRows = voteIds.length
      ? await db
          .select()
          .from(monthlyVoteCandidates)
          .where(
            and(
              inArray(monthlyVoteCandidates.voteId, voteIds),
              isNotNull(monthlyVoteCandidates.finalRanking),
            ),
          )
          .orderBy(asc(monthlyVoteCandidates.finalRanking))
      : []

    const topByVote = new Map<string, MonthlyVoteCandidate[]>()
    for (const row of topRows) {
      const list = topByVote.get(row.voteId) ?? []
      list.push(row)
      topByVote.set(row.voteId, list)
    }

    items = picks.map((pick) => {
      const vote = voteByKey.get(`${pick.year}-${pick.month}`)
      const top3 = (vote ? topByVote.get(vote.id) ?? [] : []).slice(0, 3)
      return { pick: pickJson(pick), top3: top3.map(candidateJson) }
    })
  }

  res.json({ items })
})

// Um álbum do mês específico pelo id (usado ao navegar pelo histórico).
// Registrada DEPOIS de /history e /vote para não caírem no parâmetro :id.
router.get('/album-of-month/:id', async (req: AuthedRequest, res) => {
  const parsed = idSchema.safeParse({ id: String(req.params.id) })
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Identificador inválido.' })
    return
  }

  const pick = await findAlbumOfMonthById(parsed.data.id)
  if (!pick) {
    res.status(404).json({ error: 'Álbum do mês não encontrado.' })
    return
  }

  const top3 = await top3Of(pick.year, pick.month)

  res.json({ pick: pickJson(pick), top3: top3.map(candidateJson) })
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

  if (!(await findAlbumOfMonthById(parsedId.data.id))) {
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

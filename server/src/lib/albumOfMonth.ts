import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  max,
} from 'drizzle-orm'
import { db } from '../db.js'
import {
  albumOfMonth,
  monthlyVoteBallots,
  monthlyVoteCandidates,
  monthlyVotes,
  reviews,
  type AlbumOfMonth,
  type MonthlyVote,
  type NewMonthlyVoteCandidate,
} from '../schema.js'

export type VoteStatus = 'pending' | 'open' | 'awaiting_reveal' | 'revealed'

export interface VotePeriod {
  year: number
  month: number
  opensAt: Date
  closesAt: Date
  revealAt: Date
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

// Período de votação que elege o álbum do mês (year/month): os votos são dados
// nos últimos 7 dias do mês anterior, fecham às 00:00 do dia 1 e o resultado
// é divulgado às 08:00 do dia 1 do mês-alvo.
export function votePeriodFor(year: number, month: number): VotePeriod {
  const prev = prevMonth(year, month)
  const days = daysInMonth(prev.year, prev.month)
  const openDay = days - 6
  const opensAt = new Date(prev.year, prev.month - 1, openDay, 0, 0, 0, 0)
  const closesAt = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const revealAt = new Date(year, month - 1, 1, 8, 0, 0, 0)
  return { year, month, opensAt, closesAt, revealAt }
}

export function deriveStatus(period: VotePeriod, now: Date): VoteStatus {
  if (now < period.opensAt) return 'pending'
  if (now < period.closesAt) return 'open'
  if (now < period.revealAt) return 'awaiting_reveal'
  return 'revealed'
}

export async function getOrCreateVote(year: number, month: number): Promise<MonthlyVote> {
  const [existing] = await db
    .select()
    .from(monthlyVotes)
    .where(and(eq(monthlyVotes.year, year), eq(monthlyVotes.month, month)))
    .limit(1)
  if (existing) return existing

  const period = votePeriodFor(year, month)
  await db
    .insert(monthlyVotes)
    .values({
      year,
      month,
      opensAt: period.opensAt,
      closesAt: period.closesAt,
      revealAt: period.revealAt,
    })
    .onConflictDoNothing({ target: [monthlyVotes.month, monthlyVotes.year] })

  const [row] = await db
    .select()
    .from(monthlyVotes)
    .where(and(eq(monthlyVotes.year, year), eq(monthlyVotes.month, month)))
    .limit(1)
  if (!row) throw new Error('Não foi possível criar a votação do mês.')
  return row
}

export async function findAlbumOfMonth(year: number, month: number): Promise<AlbumOfMonth | null> {
  const [pick] = await db
    .select()
    .from(albumOfMonth)
    .where(and(eq(albumOfMonth.year, year), eq(albumOfMonth.month, month)))
    .limit(1)
  return pick ?? null
}

// Gera os 10 candidatos (álbuns mais avaliados por reviews registradas no mês
// em que a votação acontece). Idempotente: só roda uma vez por votação, a
// partir do opensAt.
export async function ensureCandidates(vote: MonthlyVote, now = new Date()): Promise<void> {
  if (now < vote.opensAt) return
  if (vote.candidatesGeneratedAt) return

  const prev = prevMonth(vote.year, vote.month)
  const start = new Date(prev.year, prev.month - 1, 1, 0, 0, 0, 0)
  const end = new Date(vote.year, vote.month - 1, 1, 0, 0, 0, 0)

  const rows = await db
    .select({
      albumId: reviews.albumId,
      albumTitle: reviews.albumTitle,
      albumArtist: reviews.albumArtist,
      albumArtworkUrl: reviews.albumArtworkUrl,
      reviewCount: count(),
      latestReviewAt: max(reviews.createdAt),
      averageRating: avg(reviews.rating),
    })
    .from(reviews)
    .where(and(gte(reviews.createdAt, start), lt(reviews.createdAt, end)))
    .groupBy(reviews.albumId, reviews.albumTitle, reviews.albumArtist, reviews.albumArtworkUrl)
    .orderBy(desc(count()), desc(max(reviews.createdAt)))
    .limit(10)

  // Um mesmo albumId pode ter vindo com metadados diferentes; mantém o de maior
  // contagem (que vem primeiro pela ordenação).
  const seen = new Set<string>()
  const deduped: typeof rows = []
  for (const row of rows) {
    if (!seen.has(row.albumId)) {
      seen.add(row.albumId)
      deduped.push(row)
    }
  }

  await db.transaction(async (tx) => {
    for (const [index, row] of deduped.entries()) {
      const values: NewMonthlyVoteCandidate = {
        voteId: vote.id,
        albumId: row.albumId,
        albumTitle: row.albumTitle,
        albumArtist: row.albumArtist,
        albumArtworkUrl: row.albumArtworkUrl,
        reviewCount: row.reviewCount,
        latestReviewAt: row.latestReviewAt ?? new Date(),
        averageRating: row.averageRating == null ? null : Number(row.averageRating),
        position: index + 1,
      }
      await tx.insert(monthlyVoteCandidates).values(values).onConflictDoNothing()
    }
    await tx
      .update(monthlyVotes)
      .set({ candidatesGeneratedAt: now, updatedAt: now })
      .where(eq(monthlyVotes.id, vote.id))
  })
}

// Apuração: soma os votos por candidato, ranqueia (desempate pela posição de
// candidatura) e grava o vencedor em album_of_month. Idempotente.
export async function tabulateVote(vote: MonthlyVote, now = new Date()): Promise<void> {
  if (vote.tabulatedAt) return

  const candidates = await db
    .select()
    .from(monthlyVoteCandidates)
    .where(eq(monthlyVoteCandidates.voteId, vote.id))
    .orderBy(asc(monthlyVoteCandidates.position))

  const counts = await db
    .select({ albumId: monthlyVoteBallots.albumId, votes: count() })
    .from(monthlyVoteBallots)
    .where(eq(monthlyVoteBallots.voteId, vote.id))
    .groupBy(monthlyVoteBallots.albumId)

  const votesByAlbum = new Map(counts.map((row) => [row.albumId, row.votes]))
  const ranked = [...candidates].sort((a, b) => {
    const av = votesByAlbum.get(a.albumId) ?? 0
    const bv = votesByAlbum.get(b.albumId) ?? 0
    if (av !== bv) return bv - av
    return a.position - b.position
  })

  await db.transaction(async (tx) => {
    for (const [index, candidate] of ranked.entries()) {
      await tx
        .update(monthlyVoteCandidates)
        .set({ finalVotes: votesByAlbum.get(candidate.albumId) ?? 0, finalRanking: index + 1 })
        .where(eq(monthlyVoteCandidates.id, candidate.id))
    }
    await tx
      .update(monthlyVotes)
      .set({ tabulatedAt: now, updatedAt: now })
      .where(eq(monthlyVotes.id, vote.id))

    const winner = ranked[0]
    if (winner) {
      const winnerVotes = votesByAlbum.get(winner.albumId) ?? 0
      await tx
        .insert(albumOfMonth)
        .values({
          albumId: winner.albumId,
          albumTitle: winner.albumTitle,
          albumArtist: winner.albumArtist,
          albumArtworkUrl: winner.albumArtworkUrl,
          month: vote.month,
          year: vote.year,
          votes: winnerVotes,
          position: 1,
        })
        .onConflictDoUpdate({
          target: [albumOfMonth.month, albumOfMonth.year],
          set: {
            albumId: winner.albumId,
            albumTitle: winner.albumTitle,
            albumArtist: winner.albumArtist,
            albumArtworkUrl: winner.albumArtworkUrl,
            votes: winnerVotes,
            position: 1,
            updatedAt: now,
          },
        })
    }
  })
}

export async function tabulateIfDue(vote: MonthlyVote, now = new Date()): Promise<void> {
  if (now < vote.revealAt) return
  await tabulateVote(vote, now)
}

// Apura (sem o cron, à la carte) todas as votações cujo prazo de divulgação já
// passou. Retorna quantas foram apuradas.
export async function tabulateOverdueVotes(now = new Date()): Promise<number> {
  const overdue = await db
    .select()
    .from(monthlyVotes)
    .where(and(lt(monthlyVotes.revealAt, now), isNull(monthlyVotes.tabulatedAt)))
  for (const vote of overdue) {
    await tabulateVote(vote, now)
  }
  return overdue.length
}

// Álbum em destaque hoje: o vencedor do mês corrente, quando já divulgado;
// antes das 08:00 do dia 1 (aguardando divulgação) devolve o do mês anterior.
export async function resolveDisplayedAlbum(now = new Date()): Promise<AlbumOfMonth | null> {
  const cur = { year: now.getFullYear(), month: now.getMonth() + 1 }
  const curStatus = deriveStatus(votePeriodFor(cur.year, cur.month), now)

  if (curStatus === 'revealed') {
    const vote = await getOrCreateVote(cur.year, cur.month)
    await tabulateIfDue(vote, now)
    const pick = await findAlbumOfMonth(cur.year, cur.month)
    if (pick) return pick
  }

  const prev = prevMonth(cur.year, cur.month)
  const prevVote = await getOrCreateVote(prev.year, prev.month)
  await tabulateIfDue(prevVote, now)
  return findAlbumOfMonth(prev.year, prev.month)
}

// Job horário: garante candidatos do mês em votação e apura votações atrasadas.
export async function runMonthlyVoteJob(now = new Date()): Promise<void> {
  const target = nextMonth(now.getFullYear(), now.getMonth() + 1)
  const vote = await getOrCreateVote(target.year, target.month)
  await ensureCandidates(vote, now)
  await tabulateOverdueVotes(now)
}

import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { dailyPicks, listeningLogs, reviews } from '../schema.js'
import { searchAlbums, type SearchAlbum } from './spotify.js'

export interface DailyPickAlbum {
  id: string
  title: string
  artist: string
  artworkUrl: string | null
}

interface UserHistory {
  albumIds: Set<string>
  genreCounts: Map<string, number>
}

async function getUserHistory(userId: string): Promise<UserHistory> {
  const [reviewRows, logRows] = await Promise.all([
    db
      .select({ albumId: reviews.albumId, genre: reviews.albumGenre })
      .from(reviews)
      .where(eq(reviews.userId, userId)),
    db
      .select({ albumId: listeningLogs.albumId, genre: listeningLogs.albumGenre })
      .from(listeningLogs)
      .where(eq(listeningLogs.userId, userId)),
  ])

  const albumIds = new Set<string>()
  const genreCounts = new Map<string, number>()
  const record = (albumId: string, genre: string | null) => {
    albumIds.add(albumId)
    if (genre) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
    }
  }
  for (const row of reviewRows) record(row.albumId, row.genre)
  for (const row of logRows) record(row.albumId, row.genre)

  return { albumIds, genreCounts }
}

async function getPriorPickAlbumIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ albumId: dailyPicks.albumId })
    .from(dailyPicks)
    .where(eq(dailyPicks.userId, userId))
  return new Set(rows.map((row) => row.albumId))
}

function randomItem<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)]
}

function toDailyPickAlbum(album: SearchAlbum): DailyPickAlbum {
  return {
    id: album.id,
    title: album.title,
    artist: album.artist,
    artworkUrl: album.artworkUrl,
  }
}

function chooseCandidate(
  albums: SearchAlbum[],
  historyIds: Set<string>,
  priorPickIds: Set<string>,
  allowPriorPicks: boolean,
): SearchAlbum | null {
  const candidates = albums.filter(
    (album) => !historyIds.has(album.id) && (allowPriorPicks || !priorPickIds.has(album.id)),
  )
  return candidates.length ? (randomItem(candidates) ?? null) : null
}

async function searchCandidates(query: string): Promise<SearchAlbum[]> {
  try {
    return await searchAlbums(query, 10)
  } catch (err) {
    console.warn('[daily-pick] busca no Spotify falhou:', err)
    return []
  }
}

// Sementes usadas no sorteio totalmente aleatório (palavras comuns + letras),
// para trazer variedade ao catálogo do Spotify.
const RANDOM_SEEDS = [
  'love', 'dream', 'night', 'sun', 'fire', 'rain', 'gold', 'blue', 'moon', 'echo',
  'ghost', 'soul', 'lost', 'wild', 'ocean', 'dance', 'heart', 'star', 'city', 'light',
  'fever', 'heaven', 'silent', 'broken', 'midnight', 'paradise', 'radio', 'summer',
  'winter', 'young', 'electric', 'velvet', 'bossa', 'tropic', 'samba', 'reggae',
  'indie', 'psychedelic', 'folk', 'metal', 'punk',
]

const RANDOM_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

function randomSeed(): string {
  const source = Math.random() < 0.5 ? RANDOM_LETTERS : RANDOM_SEEDS
  return randomItem(source) ?? 'album'
}

// Gêneros com a MENOR frequência no histórico do usuário (empatados). É o alvo
// do sorteio: puxa o usuário para fora das bolhas dos gêneros dominantes.
function leastFrequentGenres(genreCounts: Map<string, number>): string[] {
  const entries = [...genreCounts.entries()]
  if (entries.length === 0) return []
  const min = Math.min(...entries.map(([, count]) => count))
  return entries.filter(([, count]) => count === min).map(([genre]) => genre)
}

async function pickByGenre(
  genre: string,
  historyIds: Set<string>,
  priorPickIds: Set<string>,
): Promise<SearchAlbum | null> {
  const decade = 1960 + Math.floor(Math.random() * 7) * 10
  const queries = [
    `genre:"${genre}" year:${decade}-${decade + 9}`,
    `genre:"${genre}"`,
    genre,
  ]
  for (const query of queries) {
    const albums = await searchCandidates(query)
    const picked =
      chooseCandidate(albums, historyIds, priorPickIds, false) ??
      chooseCandidate(albums, historyIds, priorPickIds, true)
    if (picked) return picked
  }
  return null
}

/**
 * Sorteia um álbum "do dia": prioriza um gênero de baixa frequência no histórico
 * do usuário (para puxar a diversidade). Sem dados suficientes (menos de dois
 * gêneros conhecidos) ou se a busca por gênero falhar, cai em sorteio aleatório.
 */
export async function pickAlbumForUser(userId: string): Promise<DailyPickAlbum> {
  const [history, priorPickIds] = await Promise.all([
    getUserHistory(userId),
    getPriorPickAlbumIds(userId),
  ])
  const historyIds = history.albumIds

  const genres = leastFrequentGenres(history.genreCounts)
  if (genres.length >= 2) {
    const genre = randomItem(genres)
    if (genre) {
      const picked = await pickByGenre(genre, historyIds, priorPickIds)
      if (picked) return toDailyPickAlbum(picked)
    }
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const albums = await searchCandidates(randomSeed())
    const picked =
      chooseCandidate(albums, historyIds, priorPickIds, false) ??
      chooseCandidate(albums, historyIds, priorPickIds, true)
    if (picked) return toDailyPickAlbum(picked)
  }

  throw new Error('Não foi possível encontrar um álbum para sortear.')
}

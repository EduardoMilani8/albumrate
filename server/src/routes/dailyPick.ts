import { and, eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { pickAlbumForUser } from '../lib/dailyPick.js'
import { todayLocalISO } from '../lib/dates.js'
import { SpotifyError } from '../lib/spotify.js'
import { dailyPicks, type DailyPick } from '../schema.js'

const router = Router()

function pickJson(pick: DailyPick) {
  return {
    id: pick.id,
    albumId: pick.albumId,
    albumTitle: pick.albumTitle,
    albumArtist: pick.albumArtist,
    albumArtworkUrl: pick.albumArtworkUrl,
    date: pick.date,
    createdAt: pick.createdAt.toISOString(),
  }
}

async function findTodayPick(userId: string): Promise<DailyPick | null> {
  const [pick] = await db
    .select()
    .from(dailyPicks)
    .where(and(eq(dailyPicks.userId, userId), eq(dailyPicks.date, todayLocalISO())))
    .limit(1)
  return pick ?? null
}

// Consulta do dia: devolve o pick de hoje (ou null) sem criar nada. Usada pelo
// app ao abrir a home para renderizar o estado sem gastar o sorteio do dia.
router.get('/daily-pick/today', async (req: AuthedRequest, res) => {
  const pick = await findTodayPick(req.userId!)
  res.json({ pick: pick ? pickJson(pick) : null })
})

// Sorteio do dia: se já existe um pick pra hoje, retorna ele (não sorteia de novo);
// senão sorteia, salva e retorna. Uma chamada por dia por usuário.
router.get('/daily-pick', async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const existing = await findTodayPick(userId)
  if (existing) {
    res.json({ pick: pickJson(existing), alreadyUsed: true })
    return
  }

  try {
    const album = await pickAlbumForUser(userId)
    const inserted = await db
      .insert(dailyPicks)
      .values({
        userId,
        albumId: album.id,
        albumTitle: album.title,
        albumArtist: album.artist,
        albumArtworkUrl: album.artworkUrl,
        date: todayLocalISO(),
      })
      .onConflictDoNothing()
      .returning()

    const pick = inserted[0] ?? (await findTodayPick(userId))
    if (!pick) {
      res.status(500).json({ error: 'Não foi possível salvar o álbum do dia.' })
      return
    }
    res.status(200).json({ pick: pickJson(pick), alreadyUsed: false })
  } catch (err) {
    if (err instanceof SpotifyError) {
      res.status(err.status === 500 ? 502 : err.status).json({ error: err.message })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Não foi possível sortear um álbum hoje. Tente novamente.' })
  }
})

export default router

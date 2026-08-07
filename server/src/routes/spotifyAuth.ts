import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { z } from 'zod'
import { db } from '../db.js'
import { signToken } from '../lib/auth.js'
import {
  encryptSecret,
  exchangeSpotifyCode,
  SpotifyError,
  type SpotifyProfile,
} from '../lib/spotify.js'
import { toPublicUser } from '../lib/user.js'
import { users, type User } from '../schema.js'

const router = Router()

const STATE_TTL_MS = 10 * 60 * 1000
const MAX_PENDING_STATES = 10_000
const MAX_PENDING_LINKS = 1_000
const pendingStates = new Map<string, number>()

interface PendingLink {
  spotify: SpotifyProfile
  accessToken: string
  refreshToken: string | null
  tokenExpiresAt: number
  matchedUserId: string | null
  linkExpiresAt: number
}
const pendingLinks = new Map<string, PendingLink>()

// Estados e vínculos pendentes vivem em memória (instância única). Para evitar
// crescimento sem limite, expiramos periodicamente e barramos acima de um teto.
setInterval(() => {
  const now = Date.now()
  for (const [state, expiresAt] of pendingStates) {
    if (expiresAt < now) pendingStates.delete(state)
  }
  for (const [token, link] of pendingLinks) {
    if (link.linkExpiresAt < now) pendingLinks.delete(token)
  }
}, STATE_TTL_MS / 2).unref()

router.post('/begin', (_req, res) => {
  if (pendingStates.size >= MAX_PENDING_STATES) {
    res.status(429).json({ error: 'Muitas sessões de autenticação. Tente novamente em instantes.' })
    return
  }
  const state = randomBytes(16).toString('base64url')
  pendingStates.set(state, Date.now() + STATE_TTL_MS)
  res.json({ state })
})

const exchangeSchema = z.object({
  code: z.string().trim().min(20, 'Código de autorização inválido.').max(500, 'Código inválido.'),
  codeVerifier: z
    .string()
    .min(43, 'Verificador PKCE inválido.')
    .max(128, 'Verificador PKCE inválido.'),
  redirectUri: z.string().url('URI de redirecionamento inválida.').max(500, 'URI inválida.'),
  state: z.string().min(10, 'Estado de autenticação inválido.').max(128, 'Estado inválido.'),
})

router.post('/exchange', async (req, res) => {
  const parsed = exchangeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const { code, codeVerifier, redirectUri, state } = parsed.data
  const stateExpiresAt = pendingStates.get(state)
  pendingStates.delete(state)
  if (!stateExpiresAt || stateExpiresAt < Date.now()) {
    res
      .status(400)
      .json({ error: 'Sessão de autenticação expirada ou inválida. Tente entrar novamente.' })
    return
  }

  let exchanged: {
    accessToken: string
    refreshToken: string | null
    expiresIn: number
    profile: SpotifyProfile
  }
  try {
    exchanged = await exchangeSpotifyCode({ code, codeVerifier, redirectUri })
  } catch (err) {
    if (err instanceof SpotifyError) {
      res.status(err.status).json({ error: err.message, code: err.code })
      return
    }
    throw err
  }

  const { accessToken, refreshToken, expiresIn, profile } = exchanged

  const existingSpotifyUser = await db.query.users.findFirst({
    where: eq(users.spotifyId, profile.id),
  })
  if (existingSpotifyUser) {
    const updated = await db
      .update(users)
      .set({
        spotifyAccessToken: encryptSecret(accessToken),
        ...(refreshToken ? { spotifyRefreshToken: encryptSecret(refreshToken) } : {}),
        spotifyTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        spotifyConnectedAt: new Date(),
        avatarUrl: profile.imageUrl ?? undefined,
        country: profile.country ?? undefined,
        name: existingSpotifyUser.name ?? profile.displayName ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingSpotifyUser.id))
      .returning()

    const user = updated[0]
    if (!user) {
      res.status(500).json({ error: 'Não foi possível atualizar a conexão com o Spotify.' })
      return
    }
    res.json({ token: signToken(user.id), user: toPublicUser(user) })
    return
  }

  const matchedUser = profile.email
    ? await db.query.users.findFirst({ where: eq(users.email, profile.email) })
    : null

  if (matchedUser) {
    if (pendingLinks.size >= MAX_PENDING_LINKS) {
      res
        .status(429)
        .json({ error: 'Muitas sessões de vínculo. Tente novamente em instantes.' })
      return
    }
    const pendingLinkToken = randomBytes(24).toString('base64url')
    pendingLinks.set(pendingLinkToken, {
      spotify: profile,
      accessToken,
      refreshToken,
      tokenExpiresAt: Date.now() + expiresIn * 1000,
      matchedUserId: matchedUser.id,
      linkExpiresAt: Date.now() + STATE_TTL_MS,
    })
    res.json({
      conflict: true,
      existingUser: { name: matchedUser.name, email: matchedUser.email },
      pendingLinkToken,
    })
    return
  }

  const created = await createSpotifyUser(profile, accessToken, refreshToken, expiresIn)
  res.status(201).json({ token: signToken(created.id), user: toPublicUser(created) })
})

const linkSchema = z.object({
  pendingLinkToken: z.string().min(10, 'Sessão de vínculo inválida.').max(200, 'Sessão inválida.'),
  linkMode: z.enum(['link', 'new'], { message: 'Modo de vínculo inválido.' }),
})

router.post('/link', async (req, res) => {
  const parsed = linkSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const pending = pendingLinks.get(parsed.data.pendingLinkToken)
  pendingLinks.delete(parsed.data.pendingLinkToken)
  if (!pending || pending.linkExpiresAt < Date.now()) {
    res
      .status(400)
      .json({ error: 'Sessão de vínculo expirada. Entre novamente com o Spotify para recomeçar.' })
    return
  }

  if (parsed.data.linkMode === 'link' && pending.matchedUserId) {
    const updated = await db
      .update(users)
      .set({
        spotifyId: pending.spotify.id,
        spotifyAccessToken: encryptSecret(pending.accessToken),
        ...(pending.refreshToken ? { spotifyRefreshToken: encryptSecret(pending.refreshToken) } : {}),
        spotifyTokenExpiresAt: new Date(pending.tokenExpiresAt),
        spotifyConnectedAt: new Date(),
        avatarUrl: pending.spotify.imageUrl ?? undefined,
        country: pending.spotify.country ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, pending.matchedUserId))
      .returning()

    const user = updated[0]
    if (!user) {
      res.status(500).json({ error: 'Não foi possível vincular a conta do Spotify.' })
      return
    }
    res.json({ token: signToken(user.id), user: toPublicUser(user) })
    return
  }

  const created = await createSpotifyUser(
    pending.spotify,
    pending.accessToken,
    pending.refreshToken,
    (pending.tokenExpiresAt - Date.now()) / 1000,
    { forceNullEmail: pending.matchedUserId !== null },
  )
  res.status(201).json({ token: signToken(created.id), user: toPublicUser(created) })
})

async function createSpotifyUser(
  profile: SpotifyProfile,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number,
  options?: { forceNullEmail?: boolean },
): Promise<User> {
  const created = await db
    .insert(users)
    .values({
      email: options?.forceNullEmail ? null : profile.email ?? null,
      name: profile.displayName,
      passwordHash: null,
      avatarUrl: profile.imageUrl,
      country: profile.country,
      spotifyId: profile.id,
      spotifyAccessToken: encryptSecret(accessToken),
      ...(refreshToken ? { spotifyRefreshToken: encryptSecret(refreshToken) } : {}),
      spotifyTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      spotifyConnectedAt: new Date(),
    })
    .returning()

  const user = created[0]
  if (!user) {
    throw new Error('Não foi possível criar a conta.')
  }
  return user
}

export default router

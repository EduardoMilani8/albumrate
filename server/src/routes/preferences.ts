import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db.js'
import { type AuthedRequest } from '../lib/auth.js'
import { users } from '../schema.js'

const router = Router()

const themeIds = ['light', 'dark', 'midnight', 'sepia', 'neon'] as const

const themePreferenceSchema = z.object({
  themeId: z.enum(themeIds, 'Tema inválido.'),
})

router.put('/me/theme-preference', async (req: AuthedRequest, res) => {
  const parsed = themePreferenceSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  await db
    .update(users)
    .set({ themePreference: parsed.data.themeId, updatedAt: new Date() })
    .where(eq(users.id, req.userId!))
  res.json({ themePreference: parsed.data.themeId })
})

export default router

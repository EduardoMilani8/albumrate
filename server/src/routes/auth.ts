import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db.js'
import { signToken, type AuthedRequest } from '../lib/auth.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { users } from '../schema.js'

const router = Router()

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha precisa de pelo menos 6 caracteres.'),
  name: z.string().trim().max(60).optional(),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

function publicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name }
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (existing) {
    res.status(409).json({ error: 'Já existe uma conta com este e-mail.' })
    return
  }

  const passwordHash = await hashPassword(parsed.data.password)
  const created = await db
    .insert(users)
    .values({
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      passwordHash,
    })
    .returning({ id: users.id, email: users.email, name: users.name })

  const user = created[0]
  if (!user) {
    res.status(500).json({ error: 'Não foi possível criar a conta.' })
    return
  }

  res.status(201).json({ token: signToken(user.id), user: publicUser(user) })
})

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' })
    return
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, parsed.data.email),
  })
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: 'E-mail ou senha incorretos.' })
    return
  }

  res.json({
    token: signToken(user.id),
    user: publicUser(user),
  })
})

router.get('/me', async (req: AuthedRequest, res) => {
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.userId!),
    columns: { id: true, email: true, name: true },
  })
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado.' })
    return
  }
  res.json({ user: publicUser(user) })
})

export default router

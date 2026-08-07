import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { users } from '../schema.js'

// Promoção automática de admin: quem estiver na env var ADMIN_EMAILS (e-mails
// separados por vírgula, comparados em lowercase) vira admin no primeiro acesso.
// Sem SQL manual: basta adicionar o e-mail na variável do ambiente (Railway).

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  const list = String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item: string) => item.trim().toLowerCase())
    .filter(Boolean)
  return list.includes(normalized)
}

// Promove o usuário se o e-mail estiver na lista. Idempotente (não faz nada se
// já for admin). Muta o objeto passado para a resposta já refletir o isAdmin.
export async function ensureAdmin(user: {
  id: string
  email: string | null
  isAdmin: boolean
}): Promise<void> {
  if (user.isAdmin || !isAdminEmail(user.email)) return
  await db
    .update(users)
    .set({ isAdmin: true, updatedAt: new Date() })
    .where(eq(users.id, user.id))
  user.isAdmin = true
}

import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthUser {
  userId: string
}

export interface AuthedRequest extends Request {
  userId?: string
}

const JWT_SECRET = process.env.JWT_SECRET

export function signToken(userId: string): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não definida no ambiente do servidor.')
  }
  return jwt.sign({}, JWT_SECRET, { subject: userId, expiresIn: '30d' })
}

export function authenticate(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido.' })
    return
  }
  if (!JWT_SECRET) {
    res.status(500).json({ error: 'JWT_SECRET não configurada.' })
    return
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    if (typeof payload === 'string' || !payload.sub) {
      throw new Error('Payload inválido')
    }
    req.userId = payload.sub
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' })
  }
}

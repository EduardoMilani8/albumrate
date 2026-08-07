import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { authenticate } from './lib/auth.js'
import authRouter from './routes/auth.js'
import countriesRouter from './routes/countries.js'
import dailyPickRouter from './routes/dailyPick.js'
import diversityRouter from './routes/diversity.js'
import listeningLogsRouter from './routes/listeningLogs.js'
import listsRouter from './routes/lists.js'
import reviewsRouter from './routes/reviews.js'
import socialRouter from './routes/social.js'
import spotifyRouter from './routes/spotify.js'
import spotifyAuthRouter from './routes/spotifyAuth.js'

const app = express()
const port = Number(process.env.PORT ?? 8080)

// Behind Railway/Render proxies: confia no primeiro hop para obter o IP real do cliente.
app.set('trust proxy', 1)

app.use(helmet())

// CORS: permite apenas origens conhecidas. Aplicativos nativos não enviam header
// Origin, então continuam funcionando sem ele.
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:8081')
  .split(',')
  .map((origin: string) => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    },
  }),
)

app.use(express.json())

// Protege cadastro/login contra força bruta (por IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
})

// Limitador geral para o resto da API (exclui /api/health, registrado antes).
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
})

// Endpoints do Spotify que chamam a API do Spotify em nome do usuário: mais
// apertado para não queimar quota e evitar abuso de importação.
const spotifyImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições ao Spotify. Tente novamente em instantes.' },
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api', globalLimiter)

app.use('/api/auth/spotify', authLimiter, spotifyAuthRouter)
app.use('/api/auth', authLimiter, authRouter)

app.use('/api', authenticate)
app.use('/api', reviewsRouter)
app.use('/api', listeningLogsRouter)
app.use('/api', listsRouter)
app.use('/api', diversityRouter)
app.use('/api', dailyPickRouter)
app.use('/api', countriesRouter)
app.use('/api', socialRouter)
app.use('/api/me/spotify', spotifyImportLimiter)
app.use('/api', spotifyRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada.' })
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(port, () => {
  console.log(`albumrate-server rodando na porta ${port}`)
})

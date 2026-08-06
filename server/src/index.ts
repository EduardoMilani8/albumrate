import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from './lib/auth.js'
import authRouter from './routes/auth.js'
import diversityRouter from './routes/diversity.js'
import listeningLogsRouter from './routes/listeningLogs.js'
import listsRouter from './routes/lists.js'
import reviewsRouter from './routes/reviews.js'

const app = express()
const port = Number(process.env.PORT ?? 8080)

// Behind Railway/Render proxies: confia no primeiro hop para obter o IP real do cliente.
app.set('trust proxy', 1)

app.use(cors())
app.use(express.json())

// Protege cadastro/login contra força bruta (por IP).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authLimiter, authRouter)

app.use('/api', authenticate)
app.use('/api', reviewsRouter)
app.use('/api', listeningLogsRouter)
app.use('/api', listsRouter)
app.use('/api', diversityRouter)

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

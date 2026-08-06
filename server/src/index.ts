import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { authenticate } from './lib/auth.js'
import authRouter from './routes/auth.js'
import reviewsRouter from './routes/reviews.js'

const app = express()
const port = Number(process.env.PORT ?? 8080)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)

app.use('/api', authenticate)
app.use('/api', reviewsRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})

app.listen(port, () => {
  console.log(`albumrate-server rodando na porta ${port}`)
})

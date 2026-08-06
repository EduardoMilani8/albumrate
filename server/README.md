# albumrate-server

API REST do Albumrate: autenticação (JWT) + avaliações de álbuns (nota, resenha, data ouvida).

Stack: Node 22 + TypeScript + Express 5 + Postgres (Drizzle ORM) + JWT + bcrypt.

## Como rodar localmente

Pré-requisito: um Postgres acessível (ex.: [Neon](https://neon.tech) free, Railway, ou Postgres local).

```bash
cp .env.example .env   # preencha DATABASE_URL e JWT_SECRET
npm install
npm run migrate        # aplica as migrações
npm run dev            # tsx watch → http://localhost:8080
```

## Deploy no Railway

1. Crie uma conta em https://railway.app e um **New Project**.
2. Adicione um **PostgreSQL** (Database → New → PostgreSQL). Copie a `DATABASE_URL` dele.
3. Adicione um **Service** do tipo **Deploy from Dockerfile** apontando para esta pasta `server/` (no Railway: Settings → Source → Root Directory = `server`).
4. Nas variáveis de ambiente do serviço, defina:
   - `DATABASE_URL=postgres://...` (do passo 2)
   - `JWT_SECRET=<senha longa e aleatória>`
   - `PORT` (o Railway injeta automaticamente)
5. Deploy. O serviço roda `node dist/migrate.js && node dist/index.js` automaticamente (cria as tabelas e sobe na porta certa).
6. A URL pública fica em `Settings → Networking → Public Networking` (ex.: `https://albumrate-server.up.railway.app`).

> **Atenção:** o `server/.dockerignore` **não pode excluir `drizzle/`** — o `migrate.ts` lê essa pasta em runtime durante o boot do container.
>
> Também funciona no Render (Web Service com Dockerfile) ou em qualquer host que rode um contêiner. O Dockerfile compila e sobe o servidor.

## Endpoints

Tudo sob `/api`. Rotas de reviews exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/auth/register` | Cria conta `{email, password, name?}` → `{token, user}` |
| `POST` | `/auth/login` | Login `{email, password}` → `{token, user}` |
| `GET` | `/auth/me` | Usuário logado |
| `PUT` | `/albums/:albumId/reviews/me` | Cria/edita a avaliação do usuário (upsert, 1 por usuário/álbum) |
| `DELETE` | `/albums/:albumId/reviews/me` | Remove a avaliação do usuário |
| `GET` | `/albums/:albumId/reviews` | Nota média, total e lista de resenhas do álbum (+ `myReview`) |
| `GET` | `/me/reviews` | Avaliações do usuário logado, mais recentes primeiro |
| `GET` | `/users/:id/diversity-score` | Índice de diversidade musical (entropia de Shannon normalizada 0–100) + distribuições por gênero, década e país do artista |

Payload do review:

```json
{
  "rating": 4.5,
  "reviewText": "Opcional",
  "listenedAt": "2026-08-05",
  "albumTitle": "Thriller",
  "albumArtist": "Michael Jackson",
  "albumArtworkUrl": "https://...",
  "albumGenre": "Pop",
  "albumYear": 1982,
  "albumCountry": "US"
}
```

O mesmo metadata (`albumGenre`/`albumYear`/`albumCountry`) é aceito no `POST /me/listening-logs`.

Regras de validação (zod):

- `rating` entre 0,5 e 5, múltiplo de 0,5.
- `listenedAt` no formato `AAAA-MM-DD`, **data real** e **não futura**.
- `reviewText` até 2000 caracteres; `albumTitle`/`albumArtist` até 200.
- `albumGenre` até 100 caracteres; `albumYear` inteiro entre 1900 e 2100; `albumCountry` até 3 caracteres (código ISO do Deezer).
- `albumId` na rota: no máximo 100 caracteres.
- Senha: 6–72 caracteres (limite de 72 bytes do bcrypt).

O `diversity-score` calcula a entropia de Shannon sobre a distribuição de gêneros dos álbuns distintos (união de `reviews` + `listening_logs`, metadata da review tem prioridade): `score = H/log2(n) × 100`. `score = 0` se todos os álbuns do mesmo gênero; `score = null` se nenhum álbum tem gênero.

## Scripts

- `npm run dev` — servidor com watch (tsx)
- `npm run build` — compila para `dist/`
- `npm run start` — roda o build
- `npm run migrate` — aplica migrações (tsx)
- `npm run typecheck` — `tsc --noEmit`
- `npx drizzle-kit generate` — gera migração a partir do `src/schema.ts`

## Segurança

- `.env` é local e **não** vai pro git (raiz do repo ignora `.env`).
- Senhas com bcrypt (10 rounds). Token JWT expira em 30 dias.
- O `JWT_SECRET` deve ser trocado no deploy.
- **Rate limit** em `/api/auth` (cadastro/login): 20 requisições / 15 min / IP (`express-rate-limit`).
- `app.set('trust proxy', 1)` — necessário para o rate limit pegar o IP real atrás de proxies (Railway/Render).

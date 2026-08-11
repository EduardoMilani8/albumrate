# albumrate-server

API REST do Albumrate: autenticação (JWT por e-mail/senha **ou** login com Spotify OAuth 2.0 + PKCE) + avaliações de álbuns (nota, resenha, data ouvida) + integração Spotify (tokens, importação de ouvidos recentes/álbuns salvos).

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
   - `CORS_ORIGINS=http://localhost:8081` (opcional; inclua a origem do web em produção, se houver)
   - Para o login/importação com Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (do app no developer.spotify.com) e `TOKEN_ENCRYPTION_KEY` (gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
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
| `GET` | `/me/reviews/monthly` | Diário: avaliações agrupadas por mês (paginado por `before`=AAAA-MM + `limit`; devolve `total` e `latestYear`) |
| `GET` | `/users/:id/diversity-score` | Índice de diversidade musical (entropia de Shannon normalizada 0–100) + distribuições por gênero, década e país do artista |
| `POST` | `/me/countries/backfill` | Resolve países de origem faltantes (cache `artists` + MusicBrainz, ~13s/chamada, re-invocar até completar) → `{resolved, remaining, total}` |
| `POST` | `/auth/spotify/begin` | Inicia o login com Spotify → `{state}` (anti-CSRF, expira em 10 min) |
| `POST` | `/auth/spotify/exchange` | Troca `{code, codeVerifier, redirectUri, state}` → `{token, user}` ou `{conflict, existingUser, pendingLinkToken}` |
| `POST` | `/auth/spotify/link` | Finaliza conflito de conta `{pendingLinkToken, linkMode: link\|new}` → `{token, user}` |
| `GET` | `/spotify/search?q=` | Busca de álbuns no catálogo público (proxy do app via Client Credentials) |
| `GET` | `/me/spotify/recently-played` | Últimos álbuns ouvidos no Spotify (faixas recentes agrupadas, máx 30) |
| `GET` | `/me/spotify/top-artists` | Top artistas do Spotify (com gêneros) |
| `POST` | `/me/spotify/import/recently-played` | Importa álbuns selecionados para o diário de escuta (dedup `album_id\|listened_at`) |
| `POST` | `/me/spotify/import/saved-albums` | Importa a biblioteca salva para a lista "Importado do Spotify" (idempotente) |
| `DELETE` | `/me/spotify/connection` | Desvincula o Spotify (limpa tokens) |
| `PUT` | `/me/favorite-genres` | Salva gêneros favoritos `{genres: string[]}` (máx 10) → `{favoriteGenres}` |
| `PUT` | `/me/theme-preference` | Salva a preferência de tema `{themeId: light\|dark\|midnight\|sepia\|neon}` → `{themePreference}` |

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

O `diversity-score` calcula a entropia de Shannon sobre a distribuição de gêneros dos álbuns distintos (união de `reviews` + `listening_logs`, metadata da review tem prioridade): `score = H/log2(n) × 100`. `score = 0` se todos os álbuns do mesmo gênero; `score = null` se nenhum álbum tem gênero. Os códigos de país da `countryDistribution` são normalizados para ISO alpha-2 maiúsculo (`normalizeCountryCode`).

**País de origem dos artistas:** o `albumCountry` vem do Deezer no app (best-effort, às vezes vazio). O server resolve os faltantes via **MusicBrainz** (`lib/country.ts`), com cache na tabela `artists` (chave = nome normalizado em lowercase; `country` pode ser `null` para "não encontrado"). Lookups usam `User-Agent` descritivo; erros 429/503/rede devolvem "retry later" (não cacheados). O backfill (`POST /me/countries/backfill`) é chamado pelo app ao abrir o perfil e roda ~13s por chamada (1s de spacing entre requests) até zerar.

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
- **Rate limit** (`express-rate-limit`): `/api/auth` e `/api/auth/spotify` 20 req / 15 min / IP; global em `/api` 120 req / min / IP; `/api/me/spotify` (importações) 10 req / min / IP.
- `app.set('trust proxy', 1)` — necessário para o rate limit pegar o IP real atrás de proxies (Railway/Render).
- **CORS restrito** via `CORS_ORIGINS` (vírgula, padrão `http://localhost:8081`); apps nativos não enviam `Origin`. **helmet** habilitado (headers de segurança).
- **Spotify:** o `SPOTIFY_CLIENT_SECRET` nunca vai pro app — a troca do `code`, o refresh e a busca (`GET /spotify/search`) acontecem no servidor. Tokens de acesso/refresh ficam **criptografados** no banco (AES-256-GCM) com `TOKEN_ENCRYPTION_KEY`; se a chave for perdida, usuários precisam reconectar. Token revogado/expirado devolve `{code: "spotify_reconnect_required"}` (app pede reconexão sem derrubar o login).
- E-mails de usuários são **normalizados** (lowercase) no cadastro e no login Spotify, e o vínculo usa comparação **case-insensitive** (`lower(users.email) = email`) no `exchange` e no check de duplicado do `register` (pega contas legadas em caixa mista e evita duplicatas). Reviews públicas expõem só `user.name`, nunca e-mail.
- O Spotify **não oferece revogação de token por API** — ao desconectar, apagamos nosso copy dos tokens; o app continua em "Aplicações aprovadas" da conta do usuário até ele revogar lá.

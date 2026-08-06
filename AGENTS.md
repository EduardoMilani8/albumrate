# AGENTS.md

## Project

- **Albumrate** — Expo SDK 57 (React Native 0.86, React 19) + TypeScript (strict) + expo-router + expo-sqlite.
- App de avaliação de álbuns: busca no Spotify, nota em estrelas (meio-ponto), resenha, data ouvida, perfil, persistência local em SQLite, tema dark. Inclui **avaliação opcional de mídia física** (vinil/CD/cassete/digital, qualidade da prensagem, condição) e **diário de escuta** (`listening_logs`) para registrar releituras por data.
- **Avaliações e usuários vivem num backend** (`server/`): Node/Express + Postgres (Drizzle) + JWT + bcrypt. O app autentica com e-mail/senha e busca reviews via API.
- **Backend em produção:** Railway (`albumrate-production.up.railway.app`) — ver "Deploy" abaixo.

## Commands

- **Typecheck (app):** `npx tsc --noEmit` (roda limpo; corrija erros antes de entregar)
- **Typecheck (server):** `cd server && npx tsc --noEmit`
- **Run (app):** `npx expo start` (QR no terminal; `w` = web)
- **Run (server):** `cd server && cp .env.example .env && npm run migrate && npm run dev`
- **Unit tests:** não há test runner configurado.

## Env vars

Necessárias para o app (`.env`, ver `.env.example`):

```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=
EXPO_PUBLIC_API_URL=https://albumrate-production.up.railway.app
```

Necessárias para o server (`server/.env`, ver `server/.env.example`):

```
DATABASE_URL=postgres://...
JWT_SECRET=...
```

`.env` está no `.gitignore` — nunca commitar credenciais. O `.env` só é lido ao iniciar o Metro (`expo start`). `server/.env` também é ignorado.

## Structure

- `app/` — rotas expo-router (`_layout.tsx`, `index.tsx`, `search.tsx`, `album/[id].tsx`, `diary.tsx`, `login.tsx`, `register.tsx`, `profile.tsx`)
- `components/` — `AlbumCard`, `StarRating`, `ReviewModal`, `MediaReviewCard`
- `constants/` — `theme.ts` (colors/spacing/radius dark; usar sempre)
- `lib/` — `db.ts` (SQLite local, só status `logged`/`want_to_listen`), `spotify.ts` (API), `types.ts`, `api.ts` (cliente HTTP do backend), `auth.tsx` (AuthContext + SecureStore)
- `server/` — API Node/Express + Postgres (Drizzle): `src/schema.ts`, `src/routes/{auth,reviews,listeningLogs}.ts`, `src/lib/dates.ts` (helpers de data), `src/migrate.ts`, `drizzle/` (migrações geradas), `Dockerfile`, `.dockerignore`
- `metro.config.js` — `.wasm` como asset + headers COEP/COOP (expo-sqlite web)

## Conventions

- Siga o tema de `constants/theme.ts` em toda UI (dark).
- `App` é **expo-router**: arquivos vão em `app/`, e `"main": "expo-router/entry"` no package.json (não criar `App.tsx` na raiz).
- **Reviews/notas ficam no backend.** O SQLite local só guarda a lista "Meus Álbuns" com status (`logged`/`want_to_listen`). As colunas `rating`/`review` da tabela local são legadas.
- Rotas do app são protegidas com `Stack.Protected` em `app/_layout.tsx` (guarda de login). Token JWT no `expo-secure-store`.
- Imports de caminho relativo (ex.: `../constants/theme`). O alias `@/*` existe no tsconfig.
- Commits em português, estilo dos existentes.
- `npx tsc --noEmit` deve passar ao final de qualquer mudança.
- Todo endpoint de `server/` deve validar entrada com **zod** (schema) e devolver `{ error }` com status 4xx.
- Mudanças no `server/` vão a produção automaticamente ao commitar (Railway redeploya) — teste local antes de commitar.
- **Após todo commit + push, atualize os docs se algo mudou** (estrutura, rotas, endpoints, fluxo, comandos): `AGENTS.md`, `README.md` e `CLAUDE.md` (o `CLAUDE.md` apenas referencia o `AGENTS.md` via `@AGENTS.md`). Se a mudança não alterar nada documentado, apenas confirme que os docs seguem corretos.

## Known issues / gotchas

- **`btoa` não existe no RN** — `lib/spotify.ts` usa uma implementação própria de base64 (não troque por `btoa`).
- **Busca do Spotify limita a 10 resultados** (`limit=10`): valores maiores (20/30/50) retornam 400 `Invalid limit` após mudança na API.
- **Web + SQLite é alpha:** no Chrome o OPFS do `expo-sqlite` pode falhar ao abrir o banco (tela branca). O alvo de teste é mobile (Expo Go). Para mexer no web, confira `metro.config.js` (wasm + headers) e `app.json` → `web.output: "static"`.
- `expo start` reescreve `tsconfig.json` automaticamente (gerencia o `include`) — não lute contra isso.
- A API do Spotify **não devolve gênero** no objeto de álbum (`genre` fica `null`).
- Expo SDK é versionado: ao mudar de SDK, leia os docs em https://docs.expo.dev/versions/v57.0.0/.
- **Express 5** tipa `req.params.X` como `string | string[]` (não só `string`). Em `server/`, use `String(req.params.X)`.
- `server/` usa `noUncheckedIndexedAccess` — desestruturar de `.returning()`/arrays pode dar `undefined`; trate antes de usar.
- **`server/.dockerignore` NÃO pode excluir `drizzle/`**: o `migrate.ts` lê essa pasta em runtime (`node dist/migrate.js` no boot do container). Já houve bug disso antes.
- **Rate limit** no `server`: `express-rate-limit` aplicado em `/api/auth` (20 req / 15 min / IP) e `app.set('trust proxy', 1)` para pegar o IP real atrás do Railway. Não remova.
- **bcrypt limita a 72 bytes** — senhas com mais de 72 caracteres são rejeitadas no zod (max 72).
- `listenedAt` no backend é validado como data real e **não futura** (senão o Postgres rejeita com 500).
- `app/lib/auth.tsx`: token só é apagado em **401**; erro de rede mantém o token (para o usuário não ser deslogado à toa).
- `app/lib/api.ts`: fetch com timeout de 20s via `AbortController`.

## Deploy (Railway)

- Serviço `albumrate-production` → Root Directory `server`, Dockerfile na raiz do serviço.
- Variáveis no serviço: `DATABASE_URL` (Postgres do mesmo projeto) e `JWT_SECRET`. `PORT` é injetado pelo Railway (fallback 8080).
- Deploy automático a cada push no `master`. Boot roda `node dist/migrate.js && node dist/index.js` (aplica migrações e sobe).
- **Plano free do Railway:** trial de 30 dias (US$ 5); depois vira plano Free (US$ 1/mês de crédito). Server + Postgres 24/7 passa de US$ 1 → deploy pausa (não apaga) até o reset mensal. Opções quando vencer: Hobby (US$ 5/mês) ou migrar Postgres para Supabase/Neon (free) e server para Render free.

## Roadmap / decisões

- **Fase atual:** evoluir o app testando no **Expo Go** (`npx expo start` + QR code). Backend já em produção no Railway.
- **Quando o app parecer finalizado/legal:** gerar **APK standalone via EAS Build** (`eas build -p android --profile preview`, requer conta Expo). O APK aponta pro mesmo `EXPO_PUBLIC_API_URL`. Compartilhar com amigos = instalar o APK (permitir fontes desconhecidas); iOS precisaria de TestFlight/App Store (US$ 99/ano).
- **Quando o trial do Railway vencer:** decidir entre Hobby (pagar, zero manutenção) ou híbrido grátis (Postgres Supabase/Neon + server no Render free — dorme após 15 min ocioso). O deploy pausa, não é apagado.
- Ideias futuras possíveis (não decididas): validação de e-mail, página pública de perfil, listas/desafios, "quero ouvir" sincronizado no backend.

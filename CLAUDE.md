# CLAUDE.md

## Project

- **Albumrate** — Expo SDK 58 (React Native 0.88, React 19.3) + TypeScript (strict) + expo-router + expo-sqlite.
- App de avaliação de álbuns: busca no Spotify, nota em estrelas (meio-ponto), resenha, data ouvida, perfil, persistência local em SQLite, tema dark. Inclui **avaliação opcional de mídia física** (vinil/CD/cassete/digital, qualidade da prensagem, condição), **coleção física** (inventário separado das reviews: álbum, tipo de mídia, edição, condição, valor pago e data de aquisição), **diário de escuta** (`listening_logs`, alimentado pela importação do Spotify e visível no feed) — a tela **Diário** (`app/diary.tsx`) lista as **avaliações por mês** (mockup 1d: cabeçalho com ano + contagem, bloco de data, capa com passe-partout, estrelas, indicador de resenha e menu `…` para excluir; fonte: `GET /api/me/reviews/monthly`) — e **listas temáticas de álbuns** (públicas/privadas, com reordenação). Login por e-mail/senha **ou Spotify (OAuth 2.0 + PKCE)** com onboarding de importação (avatar/país, top artistas, **gêneros favoritos**, ouvidos recentes → diário de escuta, biblioteca salva → lista "Importado do Spotify").
- **Avaliações e usuários vivem num backend** (`server/`): Node/Express + Postgres (Drizzle) + JWT + bcrypt. O app autentica com e-mail/senha ou Spotify e busca reviews via API.
- **Backend em produção (desde 2026-11-02): Render free** (`https://albumrate-server.onrender.com`, blueprint em `render.yaml`) + **Postgres no Neon** (free, `us-east-1`). O Railway antigo foi desativado (trial venceu). Ver "Deploy" abaixo.

## ⚠️ Banco de dados local — NUNCA tocar

- **O Postgres local que existe na máquina (DBeaver) NÃO pertence ao projeto e NÃO tem relação nenhuma com o Albumrate.** Ele é de outra pessoa/uso.
- **PROIBIDO** executar qualquer comando que crie/altere/apague tabelas, bancos ou dados nesse Postgres local: `npm run migrate`, `drizzle-kit push/generate` com conexão, `CREATE TABLE`, `psql`, etc.
- **Migrações (arquivos em `server/drizzle/`) só podem ser aplicadas:**
  1. Em **produção**, automaticamente pelo Render no boot do deploy (banco do Neon) (não precisa fazer nada manualmente); ou
  2. Em um **banco de teste criado de propósito para isso** (ex.: Postgres local novo do usuário, Docker, ou um serviço cloud gratuito), apontando o `DATABASE_URL` de um `server/.env` **próprio do projeto**.
- A validação das migrações é feita apenas por `npx drizzle-kit generate` (gera o SQL sem conectar em banco nenhum) + `cd server && npm run build` / `npx tsc --noEmit`.
- Se for preciso testar migração contra banco real, **pergunte antes** ao usuário e só rode se ele fornecer um `DATABASE_URL` de banco de teste do projeto.

## Retomando o projeto (estado em 2026-10-04)

- Último commit: 2026-08-12 (`master` = `origin/master`, working tree limpo). O trabalho em andamento era o **redesign das telas pelos mockups 1b–1g** (álbum, modal de avaliação, diário, perfil, coleção, listas, atividade).
- Clone novo: **não há `node_modules`, `.env` nem `server/.env`**. Setup: `npm ci && (cd server && npm ci)`, depois criar os dois `.env` a partir dos `.env.example`.
- Verificado nessa data: `npx tsc --noEmit` limpo no app e no server; `npm run build` do server ok.
- **2026-11-02: upgrade para o SDK 58** (o Expo Go da loja só abre o SDK mais recente — no 57 o app parou de abrir). `react-native-worklets` instalado; `npx expo-doctor` 20/20. Backend local + Neon funcionando (migrações aplicadas, health/cadastro/busca Spotify testados).
- **Decisão (2026-10-04 → 2026-11-02):** Postgres no **Neon** + server no **Render free** (ver "Deploy"). Para testar mudanças do server antes do push: `cd server && npm run dev` (usa o mesmo banco do Neon) e, no `.env` do app, `EXPO_PUBLIC_API_URL=http://<IP-da-máquina-na-LAN>:8080` (o IP muda com a rede; o `ufw` está ativo nessa máquina — liberar a 8080 para a LAN se o celular não alcançar). Reiniciar o `expo start` após mudar o `.env`.
- O banco do Neon começou **vazio** em 2026-11-02 (dados do Railway não foram migrados).

## Commands

- **Instalar:** `npm ci && (cd server && npm ci)`
- **Saúde do projeto Expo:** `npx expo-doctor`

- **Typecheck (app):** `npx tsc --noEmit` (roda limpo; corrija erros antes de entregar)
- **Typecheck (server):** `cd server && npx tsc --noEmit`
- **Run (app):** `npx expo start` (QR no terminal; `w` = web)
- **Run (server):** `cd server && cp .env.example .env && npm run migrate && npm run dev`
- **Unit tests:** não há test runner configurado.

> ⚠️ O `npm run migrate` acima só deve ser rodado com um `server/.env` apontando para um **banco de teste do projeto** — nunca para o Postgres local do DBeaver (ver seção "Banco de dados local").

## Env vars

Necessárias para o app (`.env`, ver `.env.example`):

```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=
EXPO_PUBLIC_API_URL=https://albumrate-server.onrender.com   # ou http://<IP-da-máquina-na-LAN>:8080 para testar mudanças do server local (`localhost` não funciona no celular)
```

Necessárias para o server (`server/.env`, ver `server/.env.example`):

```
DATABASE_URL=postgres://...
JWT_SECRET=...
CORS_ORIGINS=http://localhost:8081   # origens web permitidas (vírgula); apps nativos não enviam Origin
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...   # usado no OAuth E no proxy de busca (GET /api/spotify/search) — nunca no app
TOKEN_ENCRYPTION_KEY=...   # 64 hex chars; tokens do Spotify são criptografados com ela (AES-256-GCM)
ADMIN_EMAILS=...   # e-mails de administradores (vírgula); são promovidos automaticamente no login/abertura do app
```

`.env` está no `.gitignore` — nunca commitar credenciais. O `.env` só é lido ao iniciar o Metro (`expo start`). `server/.env` também é ignorado.

## Structure

- `app/` — rotas expo-router (`_layout.tsx` — providers + `useFonts` do `expo-font` com as famílias do design system; `index.tsx` — Home com header `albumrate.` próprio (sino/engrenagem placeholder), card compacto do álbum do dia com shuffle, card do álbum do mês com badge de votação, grid 3 colunas só com avaliados e sem FAB/filtros; `activity.tsx` — feed social, `search.tsx` (sem modal), `album/[id].tsx` (detalhe no mockup 1b: hero full-bleed com gradiente + compartilhar, média em estrelas, linha de ações Avaliar/streaming/adicionar a lista, chip "Y NA COLEÇÃO", resenhas abaixo; `headerShown: false` no Stack), `diary.tsx`, `collection.tsx`, `lists.tsx` (índice no mockup 1g: header "Listas" serifado + "+ Nova" em caps, grade 2 colunas com card vertical de colagem 2x2 das 4 primeiras capas, meta `globe-outline`/`lock-closed-outline` + "PÚBLICA/PRIVADA · N" e nome serifado), `list/[id].tsx`, `login.tsx`, `register.tsx`, `spotify-onboarding.tsx`, `profile.tsx` — Perfil no mockup 1e: header compacto (avatar 66px com inicial quando sem foto + nome + linha `@NOME · PAÍS`, ícones livro→diário, lista→listas e engrenagem→modal de ajustes com Spotify/Aparência), stats em faixa fina (Avaliações/Coleção/Seguidores/Seguindo), diversidade horizontal (donut + legenda ao lado), seção "ORIGEM DOS ARTISTAS · N PAÍSES", gêneros favoritos, lista de avaliações + fileira de capas recentes e logout no fim), `appearance.tsx`, `user/[id].tsx`, `album-of-month.tsx`, `album-of-month-history.tsx`)
- `components/` — `AlbumCard` (grid 3 colunas: capa quadrada + título + nota), `BottomNav` (barra inferior Home/Atividade/Busca/Coleção/Perfil com `router.navigate`), `StarRating`, `ReviewModal` (mockup 1c: header Cancelar/Avaliar/Salvar, mini card do álbum, nota grande com meio-ponto, OUVI EM, resenha, seção MÍDIA FÍSICA com switch + tipo + qualidade + condição + PAGUEI), `MediaReviewCard`, `CollectionFormModal`, `ListFormModal`, `AddToListModal`, `DailyPickCard` (card compacto "Álbum aleatório do dia" na home: shuffle colorido se ainda não sorteou hoje, cinza/disabled após), `FeedItem` (item do feed de atividade), `DiversityChart` (donut de gêneros à esquerda + legenda bolinha/gênero/% ao lado, score central; react-native-svg), `WorldMap` (mapa-múndi de origens dos artistas; SVG puro do `react-native-svg`, cor = intensidade de álbuns, moldura passe-partout, tooltip/destaque no toque, hover no web, **pinch-to-zoom + pan** via `react-native-gesture-handler` + `react-native-reanimated` — pan só ativa com zoom > 1, sem lib extra)
- `constants/` — `theme.ts` (tokens do tema padrão dark; `spacing`/`radius` — inclui `radius.xs` (4px) — e `fonts` com as famílias do design system: Cormorant Garamond `heading`/`headingRegular`, Lora `body`/`bodyMedium`/`bodySemiBold`/`italic`, Courier Prime `kicker`/`kickerRegular`; usar sempre), `themes.ts` (5 temas: Claro, Escuro, Midnight, Vinil Sépia, Contraste Neon, cada um com todos os tokens de cor)
- `lib/` — `db.ts` (SQLite local, só status `logged`/`want_to_listen`), `spotify.ts` (proxy de busca via backend `GET /api/spotify/search` — credenciais só no servidor), `spotifyAuth.ts` (OAuth PKCE manual: verifier S256, abre navegador), `useSpotifySignIn.ts` (hook do login Spotify + diálogo de conflito), `metadata.ts` (enriquecimento de gênero/ano/país via API pública do Deezer), `worldMapData.ts` (mapa SVG vendored `@svg-maps/world` CC-BY-4.0, 256 países, viewBox `0 0 1010 666`), `theme.tsx` (ThemeProvider/useTheme: aplica o tema e sincroniza com o banco), `storage.ts` (persistência local de preferências — SecureStore nativo / localStorage web), `types.ts`, `api.ts` (cliente HTTP do backend), `auth.tsx` (AuthContext + SecureStore)
- `server/` — API Node/Express + Postgres (Drizzle): `src/schema.ts` (inclui tabelas `artists` — cache local de país de origem —, `daily_picks` — álbum sorteado do dia —, `follows` — seguidores/seguindo —, `physical_collection` — inventário de coleção física — e `album_of_month`/`album_of_month_comments`/`monthly_votes`/`monthly_vote_candidates`/`monthly_vote_ballots` — álbum do mês com votação), `src/routes/{auth,spotifyAuth,reviews,listeningLogs,lists,collection,diversity,dailyPick,albumOfMonth,spotify,countries,social,preferences}.ts`, `src/lib/{dates,diversity,user,spotify,country,dailyPick,admin,albumOfMonth,scheduler}.ts` (spotify.ts server-side: criptografia AES-256-GCM + exchange/refresh/imports/busca via Client Credentials; country.ts: normalização de país + lookup MusicBrainz + cache `artists`; dailyPick.ts: lógica de sorteio do álbum do dia; admin.ts: promoção automática via env `ADMIN_EMAILS`; albumOfMonth.ts: períodos, candidatos, apuração e lazy fallback da votação do álbum do mês; scheduler.ts: job horário com node-cron), `src/migrate.ts`, `drizzle/` (migrações geradas), `Dockerfile`, `.dockerignore`
- `metro.config.js` — `.wasm` como asset + headers COEP/COOP (expo-sqlite web)

## Conventions

- Siga o tema de `constants/theme.ts` em toda UI (dark).
- **Temas:** o app tem 5 temas (Claro, Escuro, Midnight, Vinil Sépia, Contraste Neon) definidos em `constants/themes.ts` (tokens `background`/`surface`/`surfaceAlt`/`border`/`text`/`textMuted`/`accent`/`accentMuted`/`star`/`success`/`spotify`/`onSpotify`/`scrim`/`shadow`). `lib/theme.tsx` fornece `ThemeProvider`/`useTheme` (persistência local via `lib/storage.ts` + sync com `users.theme_preference` via `PUT /api/me/theme-preference`). Ao criar/editar telas, derive as cores de `useTheme()`/tokens — não hardcode cor.
- `App` é **expo-router**: arquivos vão em `app/`, e `"main": "expo-router/entry"` no package.json (não criar `App.tsx` na raiz).
- **Reviews/notas ficam no backend.** O SQLite local só guarda a lista "Meus Álbuns" com status (`logged`/`want_to_listen`). As colunas `rating`/`review` da tabela local são legadas.
- **Metadata de álbum (gênero/ano/país) também fica no backend**: colunas `album_genre`/`album_year`/`album_country` em `reviews` e `listening_logs`. O app enriquece via Deezer (best-effort) na tela do álbum e envia junto ao salvar review/log. **País do artista** que faltou no Deezer é resolvido no backend via **MusicBrainz** (cache local na tabela `artists`, normalizado com `normalizeCountryCode` para ISO alpha-2 maiúsculo; lookup respeita rate limit com spacing de 1s). Endpoint de diversidade: `GET /api/users/:id/diversity-score` (entropia de Shannon normalizada 0–100 sobre a distribuição de gêneros; também devolve distribuições por gênero/década/país). Endpoint de backfill de países: `POST /api/me/countries/backfill` (roda ~13s por chamada, re-invocado no perfil até completar; cache evita reconsultar o MusicBrainz).
- **Listas temáticas também vivem no backend** (`lists`/`list_albums` no Postgres). Não há coluna de capa: os summaries devolvem `coverArtworkUrl` (1ª capa, compat) e `covers` com as até 4 primeiras capas (colagem 2x2 na tela `lists.tsx`). Reordenação usa botões subir/descer (sem lib de drag-and-drop).
- **Coleção física** (`physical_collection`): inventário separado das reviews — não exige ter avaliado o álbum. Permite **duplicados** (sem unique em `user_id+album_id`; é comum ter 2 prensagens do mesmo álbum). Álbuns denormalizados (título/artista/capa), `media_type`/`condition` reusam os enums de `media_reviews`, `price_paid` é `numeric(10,2)` e `acquired_at` é `date` validado como não-futuro. **Avaliação de mídia da review** (`media_reviews`) também ganhou `price_paid numeric(10,2)` (mockup 1c, campo "PAGUEI"); o app envia só `pricePaid` no save — a coluna legada `edition_note` permanece no banco mas não é mais escrita. Rotas privadas (`GET/POST /api/me/collection`, `PATCH/DELETE /api/me/collection/:id`, `GET /api/me/collection?q=&mediaType=`) e **pública somente-leitura** `GET /api/users/:id/collection` (sem `pricePaid`/`condition`/`editionNote`). Contagem exposta em `counts.collection` no perfil (`GET /api/users/:id`). Tela única `app/collection.tsx` que decide por parâmetro `userId`: sem `userId` = visão própria (busca, filtro por mídia, FAB de adicionar, editar/remover); com `userId` = visão pública somente leitura.
- **Social** (`follows`, unique `follower_id + following_id`, cascade): perfil público `GET /api/users/:id` (sem e-mail; devolve `counts`, `isFollowing` e `isSelf`), `PUT/DELETE /api/users/:id/follow`, busca de pessoas `GET /api/users/search?q=` (por nome, `ilike`, exclui a si mesmo) e feed `GET /api/feed` (reviews + `listening_logs` + listas **públicas** de quem o usuário segue, paginado por cursor `before`/`beforeId` = `createdAt` + id de desempate; resposta inclui `followingCount`). `GET /api/users/:id/reviews` lista as resenhas recentes do perfil. Resenhas públicas expõem `user.id` (navegação ao perfil) e listas públicas retornam `isOwner` (a tela `list/[id]` fica somente-leitura quando não é a sua).
- **Álbum aleatório do dia** (`daily_picks`, unique `user_id + date`): `GET /api/daily-pick/today` consulta o pick de hoje sem criar (usado ao abrir a home); `GET /api/daily-pick` sorteia e salva se ainda não existir pick de hoje (retorna o existente caso contrário — 1 sorteio/dia/usuário). O sorteio prioriza um gênero de **menor frequência no histórico do usuário** (reviews + listening_logs) e busca no catálogo do Spotify via Client Credentials (`genre:"x"` com década aleatória, fallbacks para busca simples); sem dados suficientes (< 2 gêneros) ou se a busca falhar, cai em sorteio aleatório por semente (palavras/letras). Álbuns já ouvidos ou já sorteados são excluídos do sorteio.
- **Álbum do mês** (`album_of_month`, unique `month + year`; `album_of_month_comments`, FK cascade; votação em `monthly_votes`/`monthly_vote_candidates`/`monthly_vote_ballots`): o pick é definido por **votação comunitária** (não mais manual por admin). Nos **últimos 7 dias do mês** a votação abre e cada usuário logado escolhe **3 álbuns distintos** (voto imutável; a trigger `check_monthly_vote_ballot_limit` garante máx 3 por `vote_id+user_id`); candidatos = **top 10 álbuns mais avaliados no mês** (por `reviews.created_at`, desempate pela review mais recente). A votação fecha às 00:00 do dia 1 e o resultado é divulgado às 08:00 do dia 1 (antes disso o app mostra o álbum do mês anterior). O 1º lugar vira o álbum do mês do mês seguinte (upsert por mês/ano, colunas `votes`/`position`). Rotas: `GET /api/album-of-month` (destaque de hoje), `GET /api/album-of-month/vote/state` (status/abertura/fechamento/resultados/candidatos/meus votos), `POST /api/album-of-month/vote` (3 `albumIds`, 409 se já votou), `GET /api/album-of-month/history` (top 3 por mês, mais recente primeiro), `GET /api/album-of-month/:id` (registrada DEPOIS de `/history` e `/vote`), `GET/POST /api/album-of-month/:id/comments` (qualquer usuário logado; resposta expõe `user.id/name/avatarUrl`, nunca e-mail). **Fuso:** tudo em hora local do servidor (Render = UTC); cron horário com `timezone: 'UTC'` em `lib/scheduler.ts`. As rotas têm **lazy fallback** (`tabulateIfDue`/`tabulateOverdueVotes`) — se o cron dormir, a resolução acontece sob demanda.
- **Login com Spotify:** OAuth Authorization Code + PKCE. `SPOTIFY_CLIENT_SECRET` **nunca** vai pro app — o server troca o `code`, guarda e faz refresh dos tokens (e serve a busca via `GET /api/spotify/search`). Tokens ficam **criptografados** (AES-256-GCM) no banco com `TOKEN_ENCRYPTION_KEY`. `users.email`/`password_hash` são opcionais (contas só do Spotify). E-mails são **normalizados** (lowercase) no cadastro, no login Spotify e ao criar conta via Spotify; o vínculo de conta usa comparação **case-insensitive** (`lower(users.email) = email`) no `exchange` e no check de duplicado do `register` (pega contas legadas em caixa mista e evita duplicatas). Conflito de e-mail → diálogo Vincular/Criar conta nova via `pendingLinkToken`. Estado anti-CSRF (`state`) validado nas duas pontas (begin/exchange). Escopos: `user-read-email user-read-private user-top-read user-read-recently-played user-library-read user-follow-read`.
- **Gêneros favoritos** (`users.favorite_genres`, `text[]`): salvos via `PUT /api/me/favorite-genres` (zod, máx 10) durante o onboarding (detectados dos top artistas, máx 5 na UI) e exibidos no perfil. Vêm em `user.favoriteGenres` no `toPublicUser`.
- Rotas do app são protegidas com `Stack.Protected` em `app/_layout.tsx` (guarda de login). Token JWT no `expo-secure-store`.
- Imports de caminho relativo (ex.: `../constants/theme`). O alias `@/*` existe no tsconfig.
- Commits em português, estilo dos existentes.
- `npx tsc --noEmit` deve passar ao final de qualquer mudança.
- Todo endpoint de `server/` deve validar entrada com **zod** (schema) e devolver `{ error }` com status 4xx.
- Mudanças no `server/` vão a produção automaticamente ao dar push no `master` (o Render redeploya e aplica as migrações no boot) — teste local antes de commitar.
- **Após todo commit + push, atualize os docs se algo mudou** (estrutura, rotas, endpoints, fluxo, comandos): `CLAUDE.md` e `README.md` (o `CLAUDE.md` é a única fonte de instruções para agentes — não existe mais `AGENTS.md`). Se a mudança não alterar nada documentado, apenas confirme que os docs seguem corretos.

## Known issues / gotchas

- **`.npmrc` com `legacy-peer-deps=true` é necessário**: o `@react-native-community/datetimepicker` declara `react-native-windows` como peer opcional, que conflita com o RN 0.88 e quebra `npm install`/`npx expo install`. Não remova (o EAS Build também roda `npm ci`).
- **RN 0.88: `ListFooterComponent`/`ListEmptyComponent`/`ListHeaderComponent` não aceitam `null`** — use `cond ? <X/> : undefined`.
- **`btoa` não existe no RN** — `lib/spotifyAuth.ts` usa uma implementação própria de base64url (não troque por `btoa`).
- **Busca do Spotify limita a 10 resultados** (`limit=10`): valores maiores (20/30/50) retornam 400 `Invalid limit` após mudança na API.
- **Web + SQLite é alpha:** no Chrome o OPFS do `expo-sqlite` pode falhar ao abrir o banco (tela branca). O alvo de teste é mobile (Expo Go). Para mexer no web, confira `metro.config.js` (wasm + headers) e `app.json` → `web.output: "static"`.
- `expo start` reescreve `tsconfig.json` automaticamente (gerencia o `include`) — não lute contra isso.
- A API do Spotify **não devolve gênero** no objeto de álbum (`genre` fica `null`). O enriquecimento de gênero/país via **Deezer** é best-effort (sem chave, com timeout de 5s) e nunca bloqueia o save: se falhar, o review/log é salvo só com o ano do Spotify.
- **País do artista** (`album_country`, código ISO) vem do Deezer **nem sempre** preenchido (ex.: The Beatles → vazio) — o score de diversidade usa gênero+década; país entra no mapa só quando disponível. O **MusicBrainz** (tabela `artists`) resolve os que faltam em background: no save de review/log e via `POST /api/me/countries/backfill` disparado ao abrir o perfil. O lookup usa `User-Agent` descritivo (política do MusicBrainz); 429/503/erro de rede **não são cacheados** (re-tentados depois), país não encontrado é cacheado como `null` para não reconsultar.
- **Diversidade (entropia normalizada):** `score = H/log2(n) × 100`, onde `H = -Σ p·log2(p)` sobre a distribuição de gêneros. `score = 0` se só 1 gênero; `score = null` se nenhum álbum tem gênero. Álbuns distintos = união de `reviews` + `listening_logs` (metadata da review tem prioridade sobre o log).
- Expo SDK é versionado: ao mudar de SDK, leia os docs em https://docs.expo.dev/versions/v58.0.0/.
- **Express 5** tipa `req.params.X` como `string | string[]` (não só `string`). Em `server/`, use `String(req.params.X)`.
- `server/` usa `noUncheckedIndexedAccess` — desestruturar de `.returning()`/arrays pode dar `undefined`; trate antes de usar.
- **`server/.dockerignore` NÃO pode excluir `drizzle/`**: o `migrate.ts` lê essa pasta em runtime (`node dist/migrate.js` no boot do container). Já houve bug disso antes.
- **Rate limit** no `server`: `express-rate-limit` com `app.set('trust proxy', 1)` (IP real atrás do proxy do Render). Limiters: `/api/auth` e `/api/auth/spotify` (20 req / 15 min / IP), global em `/api` (120 req / min / IP) e `/api/me/spotify` (10 req / min / IP, importações). Não remova.
- **CORS restrito** via `CORS_ORIGINS` (vírgula). Apps nativos não enviam `Origin` e seguem funcionando; o web precisa estar na lista.
- **`helmet`** está habilitado no `server` (headers de segurança). `helmet` é dependência de produção do server (não remova do `npm ci`).
- **Reviews públicas não expõem e-mail** (`GET /api/albums/:albumId/reviews` devolve só `user.id` + `user.name`).
- **Ordem das rotas no `social.ts`:** `GET /users/search` deve vir **antes** de `GET /users/:id` (senão "search" cai no parâmetro `:id` e devolve erro de uuid).
- **Spotify não tem endpoint de revogação de token**: ao desconectar, apagamos nosso copy dos tokens; o app continua listado nas "Aplicações aprovadas" da conta Spotify (o usuário pode revogar lá).
- **Ordem dos mounts no `server/src/index.ts`:** `/api/auth/spotify` deve vir **antes** de `/api/auth` — se inverter, a requisição ao `begin` cai no `authenticate` e devolve `Token não fornecido.` (já houve bug disso durante o desenvolvimento).
- **Redirect URI do Spotify:** o app loga a URI exata usada (`[spotify] redirect URI usada pelo app: ...` no terminal do `expo start`). Em Expo Go é um `exp://...` (não é o mesmo endereço que aparece nas configurações do Expo Go); no APK final, `albumrate://`.
- **bcrypt limita a 72 bytes** — senhas com mais de 72 caracteres são rejeitadas no zod (max 72).
- `listenedAt` no backend é validado como data real e **não futura** (senão o Postgres rejeita com 500).
- `app/lib/auth.tsx`: token só é apagado em **401**; erro de rede mantém o token (para o usuário não ser deslogado à toa).
- `lib/api.ts`: fetch com timeout de 20s via `AbortController`. **Cold start do Render free** (dorme após 15 min, ~1 min para acordar): `wakeServer()` faz `GET /api/health` com prazo de 90s antes da 1ª requisição e depois de 14 min sem resposta; `onServerWaking` alimenta a mensagem "Acordando o servidor…" na tela de carregamento do `app/_layout.tsx`. Não remova, senão o 1º login após ociosidade dá timeout.
- **`GET /api/auth/me` é autenticado** (o `authenticate` é aplicado dentro da rota, no `routes/auth.ts`).

## Deploy (Render + Neon) — atual

- **Server:** Render, plano free, criado via **Blueprint** a partir do `render.yaml` (Docker, `rootDir: server`, região `virginia`, `autoDeploy` a cada push no `master`, health check `/api/health`). URL: `https://albumrate-server.onrender.com`. Boot roda `node dist/migrate.js && node dist/index.js`.
- **Banco:** Neon free (projeto `rapid-forest-04685822`, branch `production`, `us-east-1` — mesma região do server). `DATABASE_URL` = connection string **direct** (sem `-pooler`) com `?sslmode=require` e **sem `channel_binding`** (o driver `postgres` repassa parâmetros desconhecidos ao servidor e a conexão falha).
- Variáveis no painel do Render: `DATABASE_URL`, `TOKEN_ENCRYPTION_KEY` (**igual** à do `server/.env` local, senão tokens do Spotify salvos ficam ilegíveis), `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `ADMIN_EMAILS`; `JWT_SECRET` gerado pelo Render; `PORT` injetado.
- **Limitação do free:** dorme após 15 min sem requisições (~1 min para acordar) — tratado no app por `wakeServer()` em `lib/api.ts`. O cron horário do álbum do mês não roda enquanto dorme; o lazy fallback das rotas cobre.
- O server local (`cd server && npm run dev`) usa o **mesmo banco do Neon** — cuidado: dados criados testando local aparecem em produção.

## Deploy antigo (Railway) — desativado

> Trial venceu em 2026; o domínio responde `404 Application not found`. Mantido só como referência.

- Serviço `albumrate-production` → Root Directory `server`, Dockerfile na raiz do serviço.
- Variáveis no serviço: `DATABASE_URL` (Postgres do mesmo projeto), `JWT_SECRET`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` e `TOKEN_ENCRYPTION_KEY` (64 hex; não perder — sem ela os tokens salvos não são descriptografados). `PORT` é injetado pelo Railway (fallback 8080). `CORS_ORIGINS` opcional (padrão `http://localhost:8081`; inclua a origem do web em produção se houver).
- Deploy automático a cada push no `master`. Boot roda `node dist/migrate.js && node dist/index.js` (aplica migrações e sobe).
- **Plano free do Railway:** trial de 30 dias (US$ 5); depois vira plano Free (US$ 1/mês de crédito). Server + Postgres 24/7 passa de US$ 1 → deploy pausa (não apaga) até o reset mensal. Opções quando vencer: Hobby (US$ 5/mês) ou migrar Postgres para Supabase/Neon (free) e server para Render free.

## Roadmap / decisões

- **Fase atual:** evoluir o app testando no **Expo Go** (`npx expo start` + QR code), com o backend no Render + Neon. APK funcionando (ver abaixo).
- **APK (desde 2026-11-02):** projeto EAS `@edui/eduardo-celular` (conta `edui`; o projeto antigo do time `edui1s-team` ficou inacessível e foi substituído). Gerar: `npx eas-cli@latest build -p android --profile preview` (~20 min, APK com keystore guardada na nuvem do Expo; instalar pelo link do build, "fontes desconhecidas"). **As `EXPO_PUBLIC_*` do build vêm do `env` do `eas.json`, não do `.env`** (o `.env` está no `.gitignore` e o EAS não envia arquivos ignorados) — ao mudar a URL da API, mude lá. Login com Spotify no APK exige `albumrate://` nas Redirect URIs do painel do Spotify. iOS precisaria de TestFlight/App Store (US$ 99/ano).
- **Se o cold start incomodar:** Render Starter (pago, sempre ligado) ou outro host sempre ligado; o banco no Neon não muda.
- **Próximas atualizações (pedido do usuário, 2026-11-02):**
  1. **Grande repaginada do front — mobile e web.** Redesenhar as telas (não só ajustes pontuais) mantendo o design system de `constants/theme.ts`/`themes.ts`. Combinar a direção visual com o usuário antes de começar. O trabalho anterior seguia os mockups 1b–1g.
  2. **Web como alvo de verdade** (pré-requisito da repaginada no web): hoje o login não persiste no navegador — `lib/auth.tsx` usa `expo-secure-store` direto, que não existe no web (`getValueWithKeyAsync is not a function`); usar o mesmo padrão de `lib/storage.ts` (localStorage no web). Revisar também o SQLite no web (alpha/OPFS, ver Known issues), layout responsivo para telas largas e incluir a origem do web em `CORS_ORIGINS` quando houver deploy do web.
- Ideias futuras possíveis (não decididas): validação de e-mail, página pública de perfil, listas/desafios, "quero ouvir" sincronizado no backend.

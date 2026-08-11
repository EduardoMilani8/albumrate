# Albumrate

Aplicativo para registrar, avaliar e acompanhar álbuns. Busca de álbuns via API do Spotify, avaliação em estrelas (com meio-ponto), resenha, data em que ouviu, **avaliação opcional de mídia física** (qualidade da prensagem, condição), **coleção física** (inventário separado das reviews), **diário de escuta** e perfil. Conta com **backend próprio** para usuários e avaliações e **login com Spotify** (OAuth 2.0 + PKCE) com importação opcional de dados.

Feito com **Expo SDK 57 + TypeScript + expo-router + expo-sqlite**, com **5 temas selecionáveis** (Claro, Escuro, Midnight, Vinil Sépia e Contraste Neon) numa **identidade visual editorial**: tipografia Cormorant Garamond (títulos) + Lora (corpo) + Courier Prime (kickers), accent dourado aplicado como traço/borda, cards outline com hairline e capas com passe-partout, + **Node/Express + Postgres (Drizzle)** no `server/`.

## Funcionalidades

- Busca de álbuns na **API do Spotify** (com debounce de 400ms)
- Avaliação em estrelas de 0,5 a 5 (meio-ponto via toque na metade esquerda/direita da estrela)
- Resenha (texto) opcional + **data em que ouviu** (padrão: hoje)
- **Avaliação de mídia física** (opcional, separada da nota do álbum): tipo (vinil/CD/cassete/digital), qualidade do master/prensagem, edição e condição
- **Coleção física** ("Minha coleção"): inventário separado das reviews — adicione álbuns que você possui (sem precisar tê-los avaliado), com tipo de mídia, edição/prensagem, condição, valor pago (opcional) e data de aquisição. Busca por nome, filtro por tipo de mídia, editar/remover itens. É possível ter mais de um item do mesmo álbum (ex.: 2 prensagens). Aparece como badge "Coleção" no perfil público (somente leitura, sem valor pago)
- **1 avaliação por usuário por álbum** (reavaliar edita, não duplica)
- **Nota média de todos os usuários** + lista de resenhas na página do álbum
- **Diário de escuta**: botão "Marcar como ouvido hoje" na página do álbum + timeline "Meu Diário" agrupada por mês, com remoção de registros
- **Listas temáticas de álbuns**: crie listas públicas ou privadas, adicione/remova/reordene álbuns (botões sobe/desce) e adicione um álbum a uma lista direto da sua página. A capa da lista é a do primeiro álbum
- **Cadastro/login** com e-mail e senha (JWT, token salvo no `expo-secure-store`)
- **Login com Spotify** (OAuth 2.0 Authorization Code + PKCE): botão na entrada e no cadastro, sem senha. Contas são vinculadas por e-mail quando há conflito (vincular / criar conta nova / cancelar); tokens do Spotify ficam criptografados no servidor
- **Onboarding de importação** ao conectar: puxa foto/nome/país, top artistas, **gêneros favoritos** (até 5, mostrados no perfil), últimos álbuns ouvidos (→ diário de escuta) e biblioteca salva (→ lista "Importado do Spotify")
- **Perfil** com suas avaliações (mais recentes primeiro), avatar do Spotify, gêneros favoritos, card de conexão (conectar/reconectar/desconectar) e logout
- **Índice de diversidade musical** no perfil: score 0–100 (entropia de Shannon normalizada sobre a distribuição de gêneros), gráfico donut de gêneros e distribuições por década e país do artista
- **Mapa-múndi de origens** no perfil: mostra de quais países vêm os artistas que você ouviu (intensidade de cor = nº de álbuns, toque/hover para detalhes). Países faltantes são resolvidos em background via **MusicBrainz** (cache no backend)
- Status local: **avaliado** (`logged`) ou **quero ouvir** (`want_to_listen`), com filtro "Quero ouvir" na home (só marca quem ainda não avaliou)
- **Álbum aleatório do dia**: botão em destaque na home; um sorteio por dia por usuário (prioriza gêneros de menor frequência no seu histórico para puxar diversidade, com fallback para aleatório puro). Depois de sorteado, o botão é substituído pelo card do álbum + "volte amanhã"
- **Álbum do mês**: todo mês um álbum em destaque escolhido pela **votação comunitária**. Nos últimos 7 dias do mês cada usuário vota em 3 álbuns (voto imutável); os candidatos são os 10 álbuns mais avaliados no mês. O mais votado é divulgado no dia 1 às 8h e ganha tela dedicada com botão "Ver álbum", **discussão em comentários** e **histórico navegável** com o pódio de cada mês
- Estatísticas na home: total de álbuns avaliados e sua nota média
- **Social**: seguir/deixar de seguir usuários (botão no perfil público), contadores de seguidores/seguindo, busca de pessoas na tela de busca e **feed de atividade na home** com o que quem você segue está fazendo (reviews novas, álbuns marcados no diário e listas criadas). Cada item leva à tela correspondente; listas privadas nunca aparecem no feed
- **Aparência**: 5 temas predefinidos (Claro, Escuro, Midnight, Vinil Sépia e Contraste Neon) com grid de previews em miniatura (fundo/superfície/texto/acento). O toque aplica o tema na hora e a escolha fica salva localmente (aplicada antes de a API responder) e no perfil (`theme_preference`) para sincronizar entre dispositivos

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Expo SDK 57 (React Native 0.86, React 19) |
| Linguagem | TypeScript (strict) |
| Rotas | expo-router (rotas protegidas com `Stack.Protected`) |
| Banco local | expo-sqlite (tabela `albums`, só status da lista) |
| Backend | Node 22 + Express 5 + Postgres (Drizzle ORM) + JWT + bcrypt |
| Autenticação | E-mail/senha (JWT) **ou** Spotify OAuth 2.0 (Authorization Code + PKCE, `expo-auth-session`) |
| Imagens | expo-image |
| Ícones | @expo/vector-icons (Ionicons, FontAwesome5) |
| Tipografia | Cormorant Garamond (títulos) + Lora (corpo) + Courier Prime (kickers), via `expo-font` |
| Busca | Spotify Web API (Client Credentials flow, via proxy no backend) |

## Como rodar

### 1. Backend

Veja `server/README.md` — a API precisa estar no ar (Railway, Render ou local) e o app apontar para ela.

> Backend atual em produção: `https://albumrate-production.up.railway.app` (health: `/api/health`).

### 2. App

```sh
npm install
```

Crie o arquivo `.env` na raiz (veja `.env.example`):

```sh
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=seu_client_id
EXPO_PUBLIC_API_URL=https://albumrate-production.up.railway.app
```

> **A busca de álbuns usa um proxy no backend** (`GET /api/spotify/search`) — o Client Secret do Spotify fica **só no servidor** (`server/.env`), nunca no app. No login OAuth, o app envia apenas o Client ID.
>
> **Redirect URIs do login com Spotify** (cadastre no painel developer.spotify.com): em Expo Go use o `exp://...` exato que aparece no log `[spotify] redirect URI usada pelo app: ...` do terminal (`npx expo start`); no APK final, registre `albumrate://` (e variantes `albumrate:///`, `albumrate://--/`).

Rode:

```sh
npx expo start
```

Escaneie o QR code com o Expo Go (Android/iOS) ou pressione `w` para abrir no navegador.

Verifique tipos com `npx tsc --noEmit`.

## Fluxo de desenvolvimento (app + backend)

O app roda localmente no Expo Go; o backend roda em produção no Railway. As duas partes são atualizadas de forma diferente:

**Mudanças só no app** (tela, componente, lógica do cliente):
1. Rode `npx expo start` e escaneie o QR code no Expo Go.
2. Veja as alterações em tempo real — **não precisa de deploy**.

**Mudanças no `server/`** (rota, schema, migração):
1. Teste local (se possível): `cd server && cp .env.example .env && npm run migrate && npm run dev`.
2. Faça o commit e o push para o `master`:

   ```sh
   git add .
   git commit -m "descrição em português"
   git push
   ```

3. O Railway **redeploya automaticamente** a cada push e aplica as migrações no boot (`node dist/migrate.js`).
4. Rode `npx expo start` e escaneie o QR no Expo Go para testar a mudança no app.

> Espere o deploy terminar no painel do Railway antes de testar uma mudança de backend — enquanto isso, o servidor em produção ainda responde com o código antigo (e pode rejeitar campos novos).

Verifique tipos antes de commitar: `npx tsc --noEmit` (app) e `cd server && npx tsc --noEmit` (server).

## Estrutura

```
albumrate/
├── app/                    # rotas (expo-router)
│   ├── _layout.tsx         # providers + fontes (useFonts) + Stack com rotas protegidas (login)
│   ├── index.tsx           # home: header "albumrate." + stats, álbum do dia (shuffle), álbum do mês, grid 3 colunas de avaliados + BottomNav
│   ├── activity.tsx        # Atividade: feed social de quem você segue + BottomNav
│   ├── search.tsx          # busca: abas Álbuns (Spotify) e Pessoas (usuários) + BottomNav (modo "adicionar à lista" não mostra a barra)
│   ├── album/[id].tsx      # detalhe: hero full-bleed (gradiente + compartilhar), média, avaliar, streaming, adicionar à lista, "Y NA COLEÇÃO", resenhas
│   ├── diary.tsx           # Meu Diário: timeline de escutas agrupada por mês
│   ├── collection.tsx      # Minha coleção: lista com busca/filtro por mídia, FAB de adicionar (userId = visão pública)
│   ├── lists.tsx           # Minhas listas: criar/abrir listas temáticas
│   ├── list/[id].tsx       # detalhe da lista: adicionar, remover, reordenar álbuns (somente leitura se não for sua)
│   ├── album-of-month.tsx  # álbum do mês: votação (3 álbuns), resultado, discussão em comentários
│   ├── album-of-month-history.tsx # histórico com o pódio (top 3) de cada mês (navegável)
│   ├── login.tsx           # entrada na conta (e-mail/senha ou botão Spotify)
│   ├── register.tsx        # cadastro (e-mail/senha ou botão Spotify)
│   ├── spotify-onboarding.tsx # wizard de importação após conectar o Spotify
│   ├── profile.tsx         # perfil: avaliações, avatar, gêneros favoritos, conexão Spotify, logout
│   ├── appearance.tsx      # Aparência: grid de 5 temas com preview em miniatura (toque aplica na hora)
│   └── user/[id].tsx       # perfil público: dados, seguidores/seguindo, botão Seguir, avaliações
├── components/
│   ├── AlbumCard.tsx       # card de álbum em grade 3 colunas (capa quadrada + título + nota)
│   ├── DailyPickCard.tsx   # card compacto "Álbum aleatório do dia" na home (shuffle colorido/disabled)
│   ├── BottomNav.tsx       # barra de navegação inferior: Home/Atividade/Busca/Coleção/Perfil
│   ├── StarRating.tsx      # avaliação por estrelas com meio-ponto
│   ├── ReviewModal.tsx     # modal de avaliação (nota com meio-ponto, data, resenha, mídia física com PAGUEI)
│   ├── MediaReviewCard.tsx # card de avaliação de mídia física (qualidade, condição, preço pago)
│   ├── CollectionFormModal.tsx # modal adicionar/editar item da coleção física (busca de álbum + mídia/edição/condição/valor/data)
│   ├── ListFormModal.tsx   # modal criar/editar lista (nome, descrição, público/privado)
│   ├── AddToListModal.tsx  # modal "Adicionar a uma lista" na página do álbum
│   ├── FeedItem.tsx        # item do feed de atividade (review, escuta ou lista)
│   ├── DiversityChart.tsx  # donut de diversidade (react-native-svg) + legenda
│   ├── WorldMap.tsx        # mapa-múndi de origens dos artistas (react-native-svg)
├── constants/
│   ├── theme.ts            # tokens do tema padrão (dark): colors, spacing, radius (inclui xs), fonts (Cormorant/Lora/Courier)
│   ├── themes.ts           # 5 temas predefinidos (Claro/Escuro/Midnight/Sépia/Neon) com todos os tokens de cor
├── lib/
│   ├── api.ts              # cliente HTTP do backend
│   ├── auth.tsx            # AuthContext + expo-secure-store (e-mail e Spotify)
│   ├── theme.tsx           # ThemeProvider/useTheme: aplica o tema e sincroniza com o banco
│   ├── storage.ts          # persistência local de preferências (SecureStore nativo / localStorage web)
│   ├── db.ts               # SQLite local (status da lista)
│   ├── metadata.ts         # enriquecimento Deezer (gênero/ano/país, best-effort)
│   ├── spotify.ts          # busca de álbuns via proxy do backend (/api/spotify/search)
│   ├── spotifyAuth.ts      # OAuth PKCE manual (verifier S256, abre navegador)
│   ├── useSpotifySignIn.ts # hook do login Spotify + diálogo de conflito de conta
│   ├── worldMapData.ts     # mapa SVG vendored @svg-maps/world (CC-BY-4.0, 256 países)
│   └── types.ts            # tipos compartilhados
└── server/                 # API: Express 5 + Postgres (Drizzle) — ver README
```

## Notas

- **Web:** o suporte web do `expo-sqlite` é **alpha**. No Chrome o OPFS pode falhar ao abrir o banco (bug conhecido, tela branca). O alvo de teste é o celular (Expo Go).
- **Temas:** os 5 temas vivem em `constants/themes.ts` (tokens `background`/`surface`/`surfaceAlt`/`border`/`text`/`textMuted`/`accent`/`accentMuted`/`star`/`success`/`spotify`/`onSpotify`/`scrim`/`shadow`), aplicados via `lib/theme.tsx` (`useTheme`). A preferência é lida primeiro do armazenamento local (`lib/storage.ts`) e sincronizada com `theme_preference` do usuário quando logado. A tela "Aparência" (Perfil → Aparência) mostra os 5 previews.
- Reviews e notas **ficam no backend**. O SQLite local só guarda a lista "Meus Álbuns" com status.
- **Coleção física** (`physical_collection`, no Postgres): inventário separado das reviews, permite duplicados do mesmo álbum. CRUD próprio em `GET/POST /api/me/collection` e `PATCH/DELETE /api/me/collection/:id` (busca `?q=` + filtro `?mediaType=`); coleção pública somente-leitura em `GET /api/users/:id/collection` (sem valor pago, condição e edição). Contagem em `counts.collection` no perfil.
- O gênero vem sempre nulo na busca do Spotify (a API não expõe gênero no objeto de álbum). O app **enriquece** gênero/ano/país via **API pública do Deezer** (best-effort, sem chave) na tela do álbum e salva junto do review/log.
- O **país do artista** (código ISO) vem do Deezer só quando disponível; o score de diversidade usa gênero + década, e o país entra no mapa apenas se preenchido. Os que faltam são resolvidos em background pelo backend via **MusicBrainz** (tabela `artists` como cache): no save de review/log e via `POST /api/me/countries/backfill`, disparado ao abrir o perfil. Respostas 429/503/erro de rede não são cacheadas (re-tentadas depois); país não encontrado é cacheado como `null`.
- A busca do Spotify limita a **10 resultados** (`limit=10`); valores maiores retornam 400 `Invalid limit`.
- `listenedAt` é validado no backend como data real e não futura.
- `server/`: cadastro/login com **rate limit** (20 req/15 min/IP); limitador global em `/api` (120 req/min/IP) e mais apertado em `/api/me/spotify` (10 req/min/IP). **CORS restrito** via `CORS_ORIGINS` e **helmet** habilitado. Token JWT expira em 30 dias.
- **Login com Spotify:** escopos `user-read-email user-read-private user-top-read user-read-recently-played user-library-read user-follow-read`. O servidor troca o `code` (PKCE) e guarda os tokens **criptografados** (AES-256-GCM) com `TOKEN_ENCRYPTION_KEY`; refresh automático com rotação. `users.email`/`password_hash` são opcionais (contas só do Spotify). Estado anti-CSRF (`state`) validado nas duas pontas.
- **Segurança da busca:** o Client Secret do Spotify fica só no servidor; o app busca via `GET /api/spotify/search` (autenticado, com rate limit). Reviews públicas (`GET /api/albums/:albumId/reviews`) expõem só o `name` do autor, nunca o e-mail. O Spotify não oferece revogação de token por API — ao desconectar, apagamos nosso copy e o app continua listado em "Aplicações aprovadas" do usuário.
- **Gêneros favoritos:** salvos via `PUT /api/me/favorite-genres` durante o onboarding (até 5, detectados dos top artistas) e exibidos no perfil.
- **Social:** tabela `follows` (unique `follower_id + following_id`, cascade). Perfil público `GET /api/users/:id` (sem e-mail), seguir/deixar de seguir via `PUT/DELETE /api/users/:id/follow`, busca de pessoas `GET /api/users/search?q=` e feed `GET /api/feed` (reviews + escutas + listas **públicas** de quem você segue, paginado por cursor `before`/`beforeId`). As resenhas públicas (`GET /api/albums/:albumId/reviews`) agora expõem `user.id` para navegar ao perfil; listas públicas retornam `isOwner`.
- **Álbum do mês:** escolhido por **votação comunitária** — não há mais definição manual por admin. Tabelas: `album_of_month` (unique `month + year`, metadados denormalizados, colunas `votes`/`position`), `album_of_month_comments` (FK cascade), `monthly_votes` (unique `month + year`, com `opens_at`/`closes_at`/`reveal_at`), `monthly_vote_candidates` (top 10 do mês, com `review_count`/`average_rating`/`position`/`final_votes`/`final_ranking`) e `monthly_vote_ballots` (1 linha por voto, unique `vote_id+user_id+album_id`, trigger `check_monthly_vote_ballot_limit` limita a 3 por usuário). A votação abre nos últimos 7 dias do mês, fecha às 00:00 do dia 1 e o resultado sai às 08:00 do dia 1 (antes disso a home e a tela mostram o álbum do mês anterior). Os candidatos são os 10 álbuns mais avaliados no mês por `reviews.created_at`; o 1º lugar é gravado em `album_of_month` por upsert. Tudo em hora local do servidor (UTC), com cron horário (`node-cron`, `timezone: 'UTC'`) e **lazy fallback** nas rotas (`GET /api/album-of-month/vote/state`, `/history`) caso o cron não rode.

## Licença

MIT.

# AGENTS.md

## Project

- **Albumrate** — Expo SDK 57 (React Native 0.86, React 19) + TypeScript (strict) + expo-router + expo-sqlite.
- App de avaliação de álbuns: busca no Spotify, nota em estrelas (meio-ponto), resenha, data ouvida, perfil, persistência local em SQLite, tema dark.
- **Avaliações e usuários vivem num backend** (`server/`): Node/Express + Postgres (Drizzle) + JWT + bcrypt. O app autentica com e-mail/senha e busca reviews via API.

## Commands

- **Typecheck (app):** `npx tsc --noEmit` (roda limpo; corrija erros antes de entregar)
- **Typecheck (server):** `cd server && npx tsc --noEmit`
- **Run (app):** `npx expo start` (QR no terminal; `w` = web)
- **Run (server):** `cd server && cp .env.example .env && npm run migrate && npm run dev`
- **Deploy do server:** Railway — veja `server/README.md` (Dockerfile + Postgres + `JWT_SECRET`)
- **Unit tests:** não há test runner configurado.

## Env vars

Necessárias para o app (`.env`, ver `.env.example`):

```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=
EXPO_PUBLIC_API_URL=https://seu-app.up.railway.app
```

Necessárias para o server (`server/.env`, ver `server/.env.example`):

```
DATABASE_URL=postgres://...
JWT_SECRET=...
```

`.env` está no `.gitignore` — nunca commitar credenciais. O `.env` só é lido ao iniciar o Metro (`expo start`). `server/.env` também é ignorado.

## Structure

- `app/` — rotas expo-router (`_layout.tsx`, `index.tsx`, `search.tsx`, `album/[id].tsx`, `login.tsx`, `register.tsx`, `profile.tsx`)
- `components/` — `AlbumCard`, `StarRating`, `ReviewModal`
- `constants/` — `theme.ts` (colors/spacing/radius dark; usar sempre)
- `lib/` — `db.ts` (SQLite local, só status `logged`/`want_to_listen`), `spotify.ts` (API), `types.ts`, `api.ts` (cliente HTTP do backend), `auth.tsx` (AuthContext + SecureStore)
- `server/` — API Node/Express + Postgres (Drizzle): `src/schema.ts`, `src/routes/{auth,reviews}.ts`, `src/migrate.ts`, `drizzle/` (migrações geradas)
- `metro.config.js` — `.wasm` como asset + headers COEP/COOP (expo-sqlite web)

## Conventions

- Siga o tema de `constants/theme.ts` em toda UI (dark).
- `App` é **expo-router**: arquivos vão em `app/`, e `"main": "expo-router/entry"` no package.json (não criar `App.tsx` na raiz).
- **Reviews/notas ficam no backend.** O SQLite local só guarda a lista "Meus Álbuns" com status (`logged`/`want_to_listen`). As colunas `rating`/`review` da tabela local são legadas.
- Rotas do app são protegidas com `Stack.Protected` em `app/_layout.tsx` (guarda de login). Token JWT no `expo-secure-store`.
- Imports de caminho relativo (ex.: `../constants/theme`). O alias `@/*` existe no tsconfig.
- Commits em português, estilo dos existentes.
- `npx tsc --noEmit` deve passar ao final de qualquer mudança.

## Known issues / gotchas

- **`btoa` não existe no RN** — `lib/spotify.ts` usa uma implementação própria de base64 (não troque por `btoa`).
- **Web + SQLite é alpha:** no Chrome o OPFS do `expo-sqlite` pode falhar ao abrir o banco (tela branca). O alvo de teste é mobile (Expo Go). Para mexer no web, confira `metro.config.js` (wasm + headers) e `app.json` → `web.output: "static"`.
- `expo start` reescreve `tsconfig.json` automaticamente (gerencia o `include`) — não lute contra isso.
- A API do Spotify **não devolve gênero** no objeto de álbum (`genre` fica `null`).
- Expo SDK é versionado: ao mudar de SDK, leia os docs em https://docs.expo.dev/versions/v57.0.0/.
- **Express 5** tipa `req.params.X` como `string | string[]` (não só `string`). Em `server/`, use `String(req.params.X)`.
- `server/` usa `noUncheckedIndexedAccess` — desestruturar de `.returning()`/arrays pode dar `undefined`; trate antes de usar.

## Roadmap / decisões

- **Fase atual:** testar no celular via **Expo Go** (`npx expo start` + QR code). Sem build standalone por enquanto.
- **Quando o app parecer finalizado/legal:** gerar **APK standalone via EAS Build** (`eas build -p android --profile preview`, requer conta Expo). ✅ Anotado para não esquecer.
- **⏳ PRÓXIMO PASSO (pendente, quem continuar deve fazer):** fazer o **deploy do backend na nuvem** e apontar o app para ele. Detalhes:
  1. Railway (ou Render): criar projeto → Postgres → serviço a partir do `server/Dockerfile`.
  2. Variáveis do serviço: `DATABASE_URL` (do Postgres criado) e `JWT_SECRET` (senha longa/aleatória). O servidor roda as migrações sozinho no boot.
  3. Trocar `EXPO_PUBLIC_API_URL` no `.env` (hoje está `https://seu-app.up.railway.app`, placeholder) pela URL pública real do serviço.
  4. Depois testar no Expo Go: cadastrar, avaliar, ver média, perfil.
  - Referência completa: `server/README.md`.

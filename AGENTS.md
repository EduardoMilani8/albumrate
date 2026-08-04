# AGENTS.md

## Project

- **Albumrate** — Expo SDK 57 (React Native 0.86, React 19) + TypeScript (strict) + expo-router + expo-sqlite.
- App de avaliação de álbuns: busca no Spotify, nota em estrelas (meio-ponto), anotação, status `logged`/`want_to_listen`, persistência local em SQLite, tema dark.

## Commands

- **Typecheck:** `npx tsc --noEmit` (roda limpo; corrija erros antes de entregar)
- **Run:** `npx expo start` (QR no terminal; `w` = web)
- **Unit tests:** não há test runner configurado.

## Env vars

Necessárias para a busca funcionar (`.env`, ver `.env.example`):

```
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=
```

`.env` está no `.gitignore` — nunca commitar credenciais. O `.env` só é lido ao iniciar o Metro (`expo start`).

## Structure

- `app/` — rotas expo-router (`_layout.tsx`, `index.tsx`, `search.tsx`, `album/[id].tsx`)
- `components/` — `AlbumCard`, `StarRating`
- `constants/` — `theme.ts` (colors/spacing/radius dark; usar sempre)
- `lib/` — `db.ts` (SQLite), `spotify.ts` (API), `types.ts` (tipos)
- `metro.config.js` — `.wasm` como asset + headers COEP/COOP (expo-sqlite web)

## Conventions

- Siga o tema de `constants/theme.ts` em toda UI (dark).
- `App` é **expo-router**: arquivos vão em `app/`, e `"main": "expo-router/entry"` no package.json (não criar `App.tsx` na raiz).
- Imports de caminho relativo (ex.: `../constants/theme`). O alias `@/*` existe no tsconfig.
- Commits em português, estilo dos existentes.
- `npx tsc --noEmit` deve passar ao final de qualquer mudança.

## Known issues / gotchas

- **`btoa` não existe no RN** — `lib/spotify.ts` usa uma implementação própria de base64 (não troque por `btoa`).
- **Web + SQLite é alpha:** no Chrome o OPFS do `expo-sqlite` pode falhar ao abrir o banco (tela branca). O alvo de teste é mobile (Expo Go). Para mexer no web, confira `metro.config.js` (wasm + headers) e `app.json` → `web.output: "static"`.
- `expo start` reescreve `tsconfig.json` automaticamente (gerencia o `include`) — não lute contra isso.
- A API do Spotify **não devolve gênero** no objeto de álbum (`genre` fica `null`).
- Expo SDK é versionado: ao mudar de SDK, leia os docs em https://docs.expo.dev/versions/v57.0.0/.

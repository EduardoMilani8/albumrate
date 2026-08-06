# Albumrate

Aplicativo para registrar, avaliar e acompanhar álbuns. Busca de álbuns via API do Spotify, avaliação em estrelas (com meio-ponto), resenha, data em que ouviu, **avaliação opcional de mídia física** (qualidade da prensagem, condição), **diário de escuta** e perfil. Conta com **backend próprio** para usuários e avaliações.

Feito com **Expo SDK 57 + TypeScript + expo-router + expo-sqlite**, em tema dark, + **Node/Express + Postgres (Drizzle)** no `server/`.

## Funcionalidades

- Busca de álbuns na **API do Spotify** (com debounce de 400ms)
- Avaliação em estrelas de 0,5 a 5 (meio-ponto via toque na metade esquerda/direita da estrela)
- Resenha (texto) opcional + **data em que ouviu** (padrão: hoje)
- **Avaliação de mídia física** (opcional, separada da nota do álbum): tipo (vinil/CD/cassete/digital), qualidade do master/prensagem, edição e condição
- **1 avaliação por usuário por álbum** (reavaliar edita, não duplica)
- **Nota média de todos os usuários** + lista de resenhas na página do álbum
- **Diário de escuta**: botão "Marcar como ouvido hoje" na página do álbum + timeline "Meu Diário" agrupada por mês, com remoção de registros
- **Listas temáticas de álbuns**: crie listas públicas ou privadas, adicione/remova/reordene álbuns (botões sobe/desce) e adicione um álbum a uma lista direto da sua página. A capa da lista é a do primeiro álbum
- **Cadastro/login** com e-mail e senha (JWT, token salvo no `expo-secure-store`)
- **Perfil** com suas avaliações (mais recentes primeiro), remoção e logout
- **Índice de diversidade musical** no perfil: score 0–100 (entropia de Shannon normalizada sobre a distribuição de gêneros), gráfico donut de gêneros e distribuições por década e país do artista
- Status local: **avaliado** (`logged`) ou **quero ouvir** (`want_to_listen`), com filtro "Quero ouvir" na home (só marca quem ainda não avaliou)
- Estatísticas na home: total de álbuns avaliados e sua nota média

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Expo SDK 57 (React Native 0.86, React 19) |
| Linguagem | TypeScript (strict) |
| Rotas | expo-router (rotas protegidas com `Stack.Protected`) |
| Banco local | expo-sqlite (tabela `albums`, só status da lista) |
| Backend | Node 22 + Express 5 + Postgres (Drizzle ORM) + JWT + bcrypt |
| Imagens | expo-image |
| Ícones | @expo/vector-icons (Ionicons) |
| Busca | Spotify Web API (Client Credentials flow) |

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
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=seu_client_secret
EXPO_PUBLIC_API_URL=https://albumrate-production.up.railway.app
```

> **Atenção:** as credenciais do Spotify ficam embutidas no bundle (Client Credentials é feito para servidor-servidor). Aceitável para uso pessoal; para produção o ideal é um proxy.

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
│   ├── _layout.tsx         # providers + Stack com rotas protegidas (login)
│   ├── index.tsx           # home: estatísticas, lista, filtro Quero ouvir, FAB
│   ├── search.tsx          # busca no Spotify
│   ├── album/[id].tsx      # detalhe: média, resenhas, avaliar, quero ouvir, ouvir hoje, adicionar a lista
│   ├── diary.tsx           # Meu Diário: timeline de escutas agrupada por mês
│   ├── lists.tsx           # Minhas listas: criar/abrir listas temáticas
│   ├── list/[id].tsx       # detalhe da lista: adicionar, remover, reordenar álbuns
│   ├── login.tsx           # entrada na conta
│   ├── register.tsx        # cadastro
│   └── profile.tsx         # perfil: avaliações do usuário, Minhas listas, Meu Diário, logout
├── components/
│   ├── AlbumCard.tsx       # card de álbum nas listas
│   ├── StarRating.tsx      # avaliação por estrelas com meio-ponto
│   ├── ReviewModal.tsx     # modal de avaliação (nota, resenha, data, mídia física)
│   ├── MediaReviewCard.tsx # card de avaliação de mídia física (dentro da resenha)
│   ├── ListFormModal.tsx   # modal criar/editar lista (nome, descrição, público/privado)
│   ├── AddToListModal.tsx  # modal "Adicionar a uma lista" na página do álbum
│   └── DiversityChart.tsx  # donut de diversidade (react-native-svg) + legenda
├── constants/theme.ts      # tema dark: colors, spacing, radius
├── lib/
│   ├── api.ts              # cliente HTTP do backend
│   ├── auth.tsx            # AuthContext + expo-secure-store
│   ├── db.ts               # SQLite local (status da lista)
│   ├── metadata.ts         # enriquecimento Deezer (gênero/ano/país, best-effort)
│   ├── spotify.ts          # wrapper da API do Spotify
│   └── types.ts            # tipos compartilhados
└── server/                 # API: Express 5 + Postgres (Drizzle) — ver README
```

## Notas

- **Web:** o suporte web do `expo-sqlite` é **alpha**. No Chrome o OPFS pode falhar ao abrir o banco (bug conhecido, tela branca). O alvo de teste é o celular (Expo Go).
- Reviews e notas **ficam no backend**. O SQLite local só guarda a lista "Meus Álbuns" com status.
- O gênero vem sempre nulo na busca do Spotify (a API não expõe gênero no objeto de álbum). O app **enriquece** gênero/ano/país via **API pública do Deezer** (best-effort, sem chave) na tela do álbum e salva junto do review/log.
- O **país do artista** (código ISO) vem do Deezer só quando disponível; o score de diversidade usa gênero + década, e o país entra no gráfico apenas se preenchido.
- A busca do Spotify limita a **10 resultados** (`limit=10`); valores maiores retornam 400 `Invalid limit`.
- `listenedAt` é validado no backend como data real e não futura.
- `server/`: cadastro/login com **rate limit** (20 req/15 min/IP). Token JWT expira em 30 dias.

## Licença

MIT.

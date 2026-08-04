# Albumrate

Aplicativo para registrar, avaliar e acompanhar álbuns. Busca de álbuns via API do Spotify, avaliação em estrelas (com meio-ponto), anotações e status "quero ouvir".

Feito com **Expo SDK 57 + TypeScript + expo-router + expo-sqlite**, em tema dark.

## Funcionalidades

- Busca de álbuns na **API do Spotify** (com debounce de 400ms)
- Avaliação em estrelas de 0,5 a 5 (meio-ponto via toque na metade esquerda/direita da estrela)
- Anotação (review) opcional por álbum
- Status: **avaliado** (`logged`) ou **quero ouvir** (`want_to_listen`)
- Estatísticas na home: total de álbuns avaliados e nota média
- Remoção de álbuns da lista com confirmação
- Persistência local em **SQLite** (expo-sqlite)
- Preparado para a feature futura de "diversidade de perfil" (agrupamento por gênero em `lib/db.ts`)

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Expo SDK 57 (React Native 0.86, React 19) |
| Linguagem | TypeScript (strict) |
| Rotas | expo-router |
| Banco | expo-sqlite (tabela `albums`) |
| Imagens | expo-image |
| Ícones | @expo/vector-icons (Ionicons) |
| Gestos/animação | react-native-gesture-handler, react-native-reanimated |
| Busca | Spotify Web API (Client Credentials flow) |

## Como rodar

### 1. Pré-requisitos

- Node.js 20+ e npm
- Expo Go no celular (ou um emulador) para testar em dispositivos

### 2. Instalar

```sh
npm install
```

### 3. Configurar o Spotify

A API do Spotify exige autenticação. Crie um app gratuito em <https://developer.spotify.com/dashboard> e copie o **Client ID** e o **Client Secret**.

Crie o arquivo `.env` na raiz do projeto (existe um `.env.example` para referência):

```sh
EXPO_PUBLIC_SPOTIFY_CLIENT_ID=seu_client_id
EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET=seu_client_secret
```

> **Atenção:** essas credenciais são embutidas no bundle do app e ficam visíveis para quem tiver o app. Isso é aceitável para uso pessoal; para produção, o ideal é um backend/proxy que guarde o secret (Client Credentials flow é feito para servidor-servidor).

### 4. Rodar

```sh
npx expo start
```

Escaneie o QR code com o Expo Go (Android/iOS) ou pressione `w` para abrir no navegador.

- `npm run android` — abre no emulador/dispositivo Android
- `npm run ios` — abre no simulador iOS (requer macOS)
- `npm run web` — abre no navegador

### 5. Verificar tipos

```sh
npx tsc --noEmit
```

## Estrutura

```
albumrate/
├── app/                    # rotas (expo-router)
│   ├── _layout.tsx         # layout raiz (SQLiteProvider, Stack dark)
│   ├── index.tsx           # home: estatísticas, lista, FAB
│   ├── search.tsx          # busca no Spotify
│   └── album/[id].tsx      # detalhe, avaliação e remoção
├── components/
│   ├── AlbumCard.tsx       # card de álbum nas listas
│   └── StarRating.tsx      # avaliação por estrelas com meio-ponto
├── constants/
│   └── theme.ts            # tema dark: colors, spacing, radius
├── lib/
│   ├── db.ts               # camada SQLite (CRUD + getGenreBreakdown)
│   ├── spotify.ts          # wrapper da API do Spotify
│   └── types.ts            # tipos compartilhados
├── metro.config.js         # suporte a .wasm + headers COEP/COOP (sqlite web)
└── app.json                # config do Expo (scheme, plugins, dark)
```

## Notas

- **Web:** o suporte web do `expo-sqlite` é **alpha**. No Chrome o OPFS pode falhar ao abrir o banco (bug conhecido, tela branca). Funciona no celular (iOS/Android) sem problemas, e costuma funcionar no Firefox.
- O banco fica em `albumrate.db` (tabela `albums`), criado automaticamente na primeira execução.
- O gênero vem sempre nulo na busca do Spotify (a API não expõe gênero no objeto de álbum); o breakdown usa "Sem gênero" para esses casos.

## Licença

MIT (licença padrão do template `create-expo-app`).

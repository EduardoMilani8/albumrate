export interface PublicUserInput {
  id: string
  email: string | null
  name: string | null
  avatarUrl: string | null
  country: string | null
  spotifyId: string | null
  favoriteGenres: string[] | null
  themePreference: string | null
  isAdmin: boolean
}

export function toPublicUser(user: PublicUserInput) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    country: user.country,
    spotifyConnected: user.spotifyId !== null,
    favoriteGenres: user.favoriteGenres ?? [],
    themePreference: user.themePreference ?? null,
    isAdmin: user.isAdmin,
  }
}

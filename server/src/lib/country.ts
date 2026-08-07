import { eq } from 'drizzle-orm'
import { db } from '../db.js'
import { artists } from '../schema.js'

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2/artist'
const LOOKUP_TIMEOUT_MS = 3000
const USER_AGENT = 'Albumrate/1.0 (https://github.com/EduardoMilani8/albumrate)'

/**
 * Códigos ISO 3166-1 alpha-2. Usados para validar/normalizar o país do artista
 * (vem do Deezer ou MusicBrainz) e para desenhar o mapa-múndi.
 */
const ISO_ALPHA2 = new Set<string>([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
])

/** Valida e normaliza um código de país (aceita "us", "Us", "US") ou devolve null. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  if (code.length !== 2 || !ISO_ALPHA2.has(code)) return null
  return code
}

/** Chave canônica de artista para o cache (lowercase, espaços colapsados). */
export function normalizeArtistName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface MusicBrainzArtist {
  country?: string | null
  area?: { 'iso-3166-1-codes'?: string[] } | null
}

interface MusicBrainzResponse {
  artists?: MusicBrainzArtist[]
}

type MusicBrainzLookupResult = { country: string | null } | { retryLater: true }

/**
 * Busca o país de origem de um artista na API pública do MusicBrainz
 * (ISO 3166-1 alpha-2). Best-effort: nunca lança. Rate limit/erro de rede
 * devolvem `retryLater` (para não cachear um resultado inconclusivo).
 */
async function lookupArtistCountryOnMusicBrainz(name: string): Promise<MusicBrainzLookupResult> {
  const query = encodeURIComponent(`artist:"${name}"`)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
  try {
    const response = await fetch(`${MUSICBRAINZ_API}?query=${query}&fmt=json&limit=5`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (response.status === 429 || response.status === 503) return { retryLater: true }
    if (!response.ok) return { country: null }
    const data = (await response.json()) as MusicBrainzResponse
    for (const artist of data.artists ?? []) {
      const code = artist.country ?? artist.area?.['iso-3166-1-codes']?.[0] ?? null
      const normalized = normalizeCountryCode(code)
      if (normalized) return { country: normalized }
    }
    return { country: null }
  } catch {
    return { retryLater: true }
  } finally {
    clearTimeout(timeout)
  }
}

/** Guarda (ou atualiza) o país cacheado de um artista. Cache de null evita reconsultar. */
export async function cacheArtistCountry(name: string, country: string | null): Promise<void> {
  const key = normalizeArtistName(name)
  if (!key) return
  await db
    .insert(artists)
    .values({ name: key, country, source: country ? 'musicbrainz' : null })
    .onConflictDoUpdate({
      target: artists.name,
      set: { country, source: country ? 'musicbrainz' : null, updatedAt: new Date() },
    })
}

/**
 * Devolve o país de origem de um artista (ISO alpha-2), consultando o cache
 * local (tabela `artists`) e, em miss, o MusicBrainz. Resultados conclusivos
 * (país encontrado ou "não encontrado") são cacheados para não repetir
 * chamadas externas; falhas transitórias (rede/rate limit) são re-tentadas.
 */
export async function resolveArtistCountry(artistName: string): Promise<string | null> {
  const key = normalizeArtistName(artistName)
  if (!key) return null

  const cached = await db
    .select({ country: artists.country })
    .from(artists)
    .where(eq(artists.name, key))
    .limit(1)
  if (cached[0]) return cached[0].country ?? null

  const result = await lookupArtistCountryOnMusicBrainz(artistName.trim())
  if ('retryLater' in result) return null
  await cacheArtistCountry(key, result.country)
  return result.country
}

import { normalizeCountryCode } from './country.js'

export interface AlbumMetadata {
  albumId: string
  genre: string | null
  year: number | null
  country: string | null
}

export interface DiversityBucket {
  label: string
  count: number
  percentage: number
}

export interface DiversityResult {
  totalAlbums: number
  score: number | null
  entropy: number | null
  maxEntropy: number | null
  distinctGenres: number
  albumsWithMetadata: { genre: number; year: number; country: number }
  genreDistribution: DiversityBucket[]
  decadeDistribution: DiversityBucket[]
  countryDistribution: DiversityBucket[]
}

function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`
}

function shannonEntropy(counts: number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return 0
  let entropy = 0
  for (const count of counts) {
    if (count <= 0) continue
    const p = count / total
    entropy -= p * Math.log2(p)
  }
  return entropy
}

function buildDistribution(values: (string | null)[]): DiversityBucket[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0)
  if (total === 0) return []
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function computeDiversity(albums: AlbumMetadata[]): DiversityResult {
  const totalAlbums = albums.length

  const genreValues = albums.map((album) => album.genre)
  const yearValues = albums.map((album) => album.year)
  const countryValues = albums.map((album) => normalizeCountryCode(album.country))

  const genreDistribution = buildDistribution(genreValues)
  const decadeDistribution = buildDistribution(
    yearValues.map((year) => (year !== null && year > 0 ? decadeOf(year) : null)),
  )
  const countryDistribution = buildDistribution(countryValues)

  const genreCounts = genreDistribution.map((bucket) => bucket.count)
  const distinctGenres = genreCounts.length
  const entropy = shannonEntropy(genreCounts)
  const maxEntropy = distinctGenres > 1 ? Math.log2(distinctGenres) : null

  const score =
    distinctGenres === 0
      ? null
      : distinctGenres === 1
        ? 0
        : Math.round((entropy / (maxEntropy ?? 1)) * 100)

  return {
    totalAlbums,
    score,
    entropy: distinctGenres > 0 ? Math.round(entropy * 1000) / 1000 : null,
    maxEntropy: maxEntropy !== null ? Math.round(maxEntropy * 1000) / 1000 : null,
    distinctGenres,
    albumsWithMetadata: {
      genre: genreDistribution.reduce((sum, bucket) => sum + bucket.count, 0),
      year: yearValues.filter((year) => year !== null && year > 0).length,
      country: countryDistribution.reduce((sum, bucket) => sum + bucket.count, 0),
    },
    genreDistribution,
    decadeDistribution,
    countryDistribution,
  }
}

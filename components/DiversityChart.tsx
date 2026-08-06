import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, spacing } from '../constants/theme'
import type { DiversityBucket } from '../lib/types'

const PALETTE = [
  '#E8493A',
  '#F2B705',
  '#4CAF6D',
  '#5B8DEF',
  '#B05CE6',
  '#35C2D8',
  '#F28B30',
  '#E65C8B',
  '#8FD14F',
  '#6C7AFF',
]

const MAX_SLICES = 6

function summarize(buckets: DiversityBucket[]): DiversityBucket[] {
  if (buckets.length <= MAX_SLICES) return buckets
  const top = buckets.slice(0, MAX_SLICES - 1)
  const rest = buckets.slice(MAX_SLICES - 1)
  const grandTotal = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const restCount = rest.reduce((sum, bucket) => sum + bucket.count, 0)
  if (grandTotal === 0) return top
  return [
    ...top,
    {
      label: 'Outros',
      count: restCount,
      percentage: Math.round((restCount / grandTotal) * 1000) / 10,
    },
  ]
}

interface DiversityChartProps {
  score: number | null
  totalAlbums: number
  genreDistribution: DiversityBucket[]
  decadeDistribution: DiversityBucket[]
  countryDistribution: DiversityBucket[]
}

function Donut({
  buckets,
  size,
  thickness,
}: {
  buckets: DiversityBucket[]
  size: number
  thickness: number
}) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const center = size / 2
  if (total === 0) return <Svg width={size} height={size} />

  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <Svg width={size} height={size}>
      {buckets.map((bucket, index) => {
        const length = (bucket.count / total) * circumference
        const start = cumulative
        cumulative += bucket.count
        return (
          <Circle
            key={`${bucket.label}-${index}`}
            cx={center}
            cy={center}
            r={radius}
            stroke={PALETTE[index % PALETTE.length]}
            strokeWidth={thickness}
            fill="none"
            strokeDasharray={`${length} ${circumference - length}`}
            transform={`rotate(${(start / total) * 360 - 90} ${center} ${center})`}
          />
        )
      })}
    </Svg>
  )
}

export default function DiversityChart({
  score,
  totalAlbums,
  genreDistribution,
  decadeDistribution,
  countryDistribution,
}: DiversityChartProps) {
  const slices = summarize(genreDistribution)

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Diversidade musical</Text>
        <Text style={styles.subtitle}>
          {totalAlbums === 1 ? '1 álbum ouvido' : `${totalAlbums} álbuns ouvidos`}
        </Text>
      </View>

      <View style={styles.chartWrap}>
        <Donut buckets={slices} size={170} thickness={20} />
        <View style={styles.center}>
          <Text style={styles.score}>{score !== null ? score : '—'}</Text>
          {score !== null ? <Text style={styles.scoreUnit}>/100</Text> : null}
          <Text style={styles.scoreCaption}>Diversidade</Text>
        </View>
      </View>

      {genreDistribution.length === 0 ? (
        <Text style={styles.emptyText}>
          Avalie mais álbuns para calcular seu índice de diversidade por gênero.
        </Text>
      ) : (
        <>
          <View style={styles.legend}>
            {slices.map((bucket, index) => (
              <View key={bucket.label} style={styles.legendRow}>
                <View
                  style={[styles.legendDot, { backgroundColor: PALETTE[index % PALETTE.length] }]}
                />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {bucket.label}
                </Text>
                <Text style={styles.legendValue}>
                  {bucket.count} · {bucket.percentage}%
                </Text>
              </View>
            ))}
          </View>

          {decadeDistribution.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Por década</Text>
              <View style={styles.chipRow}>
                {decadeDistribution.map((bucket) => (
                  <View key={bucket.label} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {bucket.label} · {bucket.count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {countryDistribution.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>País do artista</Text>
              <View style={styles.chipRow}>
                {countryDistribution.map((bucket) => (
                  <View key={bucket.label} style={styles.chip}>
                    <Text style={styles.chipText}>
                      {bucket.label} · {bucket.count}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  header: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chartWrap: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
  scoreUnit: {
    color: colors.textMuted,
    fontSize: 13,
  },
  scoreCaption: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  legend: {
    alignSelf: 'stretch',
    gap: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  legendValue: {
    color: colors.textMuted,
    fontSize: 12,
  },
  section: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyText: {
    alignSelf: 'stretch',
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
})

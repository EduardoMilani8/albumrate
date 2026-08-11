import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { fonts, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { useTheme } from '../lib/theme'
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
  genreDistribution: DiversityBucket[]
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

export default function DiversityChart({ score, genreDistribution }: DiversityChartProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const slices = summarize(genreDistribution)
  const hasData = genreDistribution.length > 0

  return (
    <View style={styles.row}>
      <View style={styles.donutWrap}>
        <Donut buckets={slices} size={96} thickness={14} />
        <View style={styles.center}>
          <Text style={styles.score}>{score !== null ? Math.round(score) : '—'}</Text>
          <Text style={styles.scoreCaption}>Diversidade</Text>
        </View>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Gêneros</Text>
        {!hasData ? (
          <Text style={styles.emptyText}>
            Avalie álbuns para calcular sua diversidade por gênero.
          </Text>
        ) : (
          slices.map((bucket, index) => (
            <View key={bucket.label} style={styles.legendRow}>
              <View
                style={[styles.legendDot, { backgroundColor: PALETTE[index % PALETTE.length] }]}
              />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {bucket.label}
              </Text>
              <Text style={styles.legendValue}>{Math.round(bucket.percentage)}%</Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    donutWrap: {
      width: 96,
      height: 96,
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
      fontFamily: fonts.headingRegular,
      color: colors.text,
      fontSize: 24,
      fontVariant: ['tabular-nums'],
    },
    scoreCaption: {
      fontFamily: fonts.kicker,
      color: colors.textMuted,
      fontSize: 7,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: 2,
    },
    legend: {
      flex: 1,
      gap: spacing.xs,
    },
    legendTitle: {
      fontFamily: fonts.kicker,
      color: colors.textMuted,
      fontSize: 10,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
    },
    legendLabel: {
      flex: 1,
      fontFamily: fonts.body,
      color: colors.text,
      fontSize: 13,
    },
    legendValue: {
      fontFamily: fonts.kicker,
      color: colors.textMuted,
      fontSize: 10,
      letterSpacing: 0.5,
    },
    emptyText: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 12,
    },
  })

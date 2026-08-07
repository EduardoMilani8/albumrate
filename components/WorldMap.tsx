import { useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import { colors, radius, spacing } from '../constants/theme'
import { WORLD_MAP } from '../lib/worldMapData'
import type { DiversityBucket } from '../lib/types'

const VIEW_WIDTH = 1010
const VIEW_HEIGHT = 666
const STROKE_WIDTH = 1
const SELECTED_STROKE_WIDTH = 2.5
const LEGEND_STEPS = 5

function hexToRgb(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function blend(from: string, to: string, t: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const channel = (index: number) =>
    Math.round(a[index] + (b[index] - a[index]) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(0)}${channel(1)}${channel(2)}`
}

function countryName(id: string): string {
  return WORLD_MAP.countries.find((country) => country.id === id)?.name ?? id.toUpperCase()
}

interface WorldMapProps {
  distribution: DiversityBucket[]
  pending?: boolean
}

export default function WorldMap({ distribution, pending = false }: WorldMapProps) {
  const [width, setWidth] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    let max = 0
    for (const bucket of distribution) {
      const id = bucket.label.toLowerCase()
      const current = map.get(id) ?? 0
      map.set(id, current + bucket.count)
      if (current + bucket.count > max) max = current + bucket.count
    }
    return { map, max }
  }, [distribution])

  const selected = useMemo(() => {
    if (!selectedId) return null
    const count = counts.map.get(selectedId)
    if (!count) return null
    return { name: countryName(selectedId), count }
  }, [selectedId, counts.map])

  const countriesCount = useMemo(
    () => WORLD_MAP.countries.filter((country) => (counts.map.get(country.id) ?? 0) > 0).length,
    [counts.map],
  )

  const height = width > 0 ? Math.round((width * VIEW_HEIGHT) / VIEW_WIDTH) : 0

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
  }

  const handleSelect = (id: string) => {
    setSelectedId((current) => (current === id ? null : id))
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Mapa de origens</Text>
        <Text style={styles.subtitle}>
          {countriesCount === 1 ? '1 país' : `${countriesCount} países`}
        </Text>
      </View>

      <View onLayout={handleLayout} style={styles.mapWrap}>
        {width > 0 && height > 0 ? (
          <Svg width={width} height={height} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
            <G>
              {WORLD_MAP.countries.map((country) => {
                const count = counts.map.get(country.id)
                const isSelected = selectedId === country.id
                const fill = count
                  ? blend(colors.surfaceAlt, colors.accent, Math.sqrt(count / counts.max))
                  : colors.surfaceAlt
                return (
                  <Path
                    key={country.id}
                    d={country.path}
                    fill={fill}
                    stroke={isSelected ? colors.text : colors.border}
                    strokeWidth={isSelected ? SELECTED_STROKE_WIDTH : STROKE_WIDTH}
                    onPress={() => handleSelect(country.id)}
                    {...(Platform.OS === 'web'
                      ? ({
                          onMouseEnter: () => setSelectedId(country.id),
                          onMouseLeave: () => setSelectedId(null),
                        } as unknown as object)
                      : {})}
                  />
                )
              })}
            </G>
          </Svg>
        ) : null}
      </View>

      {counts.max > 1 ? (
        <View style={styles.legend}>
          <Text style={styles.legendLabel}>1</Text>
          <View style={styles.legendBar}>
            {Array.from({ length: LEGEND_STEPS }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.legendStep,
                  {
                    backgroundColor: blend(
                      colors.surfaceAlt,
                      colors.accent,
                      index / (LEGEND_STEPS - 1),
                    ),
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.legendLabel}>{counts.max}</Text>
          <Text style={styles.legendCaption}>álbuns</Text>
        </View>
      ) : null}

      <View style={styles.info}>
        {pending ? (
          <Text style={styles.infoHint}>Buscando países de origem…</Text>
        ) : selected ? (
          <>
            <Text style={styles.infoName}>{selected.name}</Text>
            <Text style={styles.infoCount}>
              {selected.count === 1 ? '1 álbum ouvido' : `${selected.count} álbuns ouvidos`}
            </Text>
          </>
        ) : (
          <Text style={styles.infoHint}>Toque num país para ver quantos álbuns você ouviu.</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  header: {
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
  mapWrap: {
    alignSelf: 'stretch',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendBar: {
    flex: 1,
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  legendStep: {
    flex: 1,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    minWidth: 14,
  },
  legendCaption: {
    color: colors.textMuted,
    fontSize: 12,
  },
  info: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.xs,
  },
  infoName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  infoCount: {
    color: colors.textMuted,
    fontSize: 13,
  },
  infoHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
})

import { useMemo, useState } from 'react'
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { G, Path } from 'react-native-svg'
import { fonts, radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import { useTheme } from '../lib/theme'
import { WORLD_MAP } from '../lib/worldMapData'
import type { DiversityBucket } from '../lib/types'

const VIEW_WIDTH = 1010
const VIEW_HEIGHT = 666
const STROKE_WIDTH = 1
const SELECTED_STROKE_WIDTH = 2.5
const LEGEND_STEPS = 5
const MIN_SCALE = 1
const MAX_SCALE = 6

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
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [width, setWidth] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)

  const scale = useSharedValue(MIN_SCALE)
  const savedScale = useSharedValue(MIN_SCALE)
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const startTx = useSharedValue(0)
  const startTy = useSharedValue(0)
  const wasZoomed = useSharedValue(false)

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

  const syncZoomed = (value: boolean) => setZoomed(value)

  const pan = Gesture.Pan()
    .enabled(zoomed)
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onStart(() => {
      startTx.value = tx.value
      startTy.value = ty.value
    })
    .onUpdate((event) => {
      if (scale.value <= MIN_SCALE) return
      const maxX = (width * (scale.value - MIN_SCALE)) / 2
      const maxY = (height * (scale.value - MIN_SCALE)) / 2
      tx.value = Math.min(Math.max(startTx.value + event.translationX, -maxX), maxX)
      ty.value = Math.min(Math.max(startTy.value + event.translationY, -maxY), maxY)
    })

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE)
      const nextZoomed = scale.value > 1.01
      if (nextZoomed !== wasZoomed.value) {
        wasZoomed.value = nextZoomed
        runOnJS(syncZoomed)(nextZoomed)
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value
      if (scale.value <= 1.01) {
        scale.value = withTiming(MIN_SCALE)
        tx.value = withTiming(0)
        ty.value = withTiming(0)
        if (wasZoomed.value) {
          wasZoomed.value = false
          runOnJS(syncZoomed)(false)
        }
      }
    })

  const composed = Gesture.Simultaneous(pinch, pan)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }))

  return (
    <>
      <View onLayout={handleLayout} style={styles.frame}>
        <View style={styles.mapWrap}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[{ width, height }, animatedStyle]}>
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
            </Animated.View>
          </GestureDetector>
        </View>
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
          <Text style={styles.infoSelected}>
            {selected.name} · {selected.count === 1 ? '1 álbum' : `${selected.count} álbuns`}
          </Text>
        ) : (
          <Text style={styles.infoHint}>
            {countriesCount > 0
              ? 'Toque num país · use dois dedos para ampliar'
              : 'Sem dados de origem ainda'}
          </Text>
        )}
      </View>
    </>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
    frame: {
      padding: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.xs,
    },
    mapWrap: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.xs - 1,
      overflow: 'hidden',
      alignItems: 'stretch',
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    legendBar: {
      flex: 1,
      flexDirection: 'row',
      height: 6,
      borderRadius: 999,
      overflow: 'hidden',
    },
    legendStep: {
      flex: 1,
    },
    legendLabel: {
      fontFamily: fonts.kicker,
      color: colors.textMuted,
      fontSize: 10,
      minWidth: 14,
    },
    legendCaption: {
      fontFamily: fonts.kicker,
      color: colors.textMuted,
      fontSize: 10,
    },
    info: {
      minHeight: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    infoSelected: {
      fontFamily: fonts.bodySemiBold,
      color: colors.text,
      fontSize: 13,
    },
    infoHint: {
      fontFamily: fonts.body,
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
  })

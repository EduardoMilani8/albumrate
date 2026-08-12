import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { radius, spacing } from '../constants/theme'
import type { ThemeTokens } from '../constants/themes'
import type { MediaCondition, MediaReview, MediaType } from '../lib/types'
import { useTheme } from '../lib/theme'
import StarRating from './StarRating'

const MEDIA_LABELS: Record<MediaType, string> = {
  vinil: 'Vinil',
  cd: 'CD',
  cassete: 'Fita cassete',
  digital: 'Digital',
}

const CONDITION_LABELS: Record<MediaCondition, string> = {
  novo: 'Novo',
  usado: 'Usado',
  desgastado: 'Desgastado',
}

interface MediaReviewCardProps {
  mediaReview: MediaReview
}

export default function MediaReviewCard({ mediaReview }: MediaReviewCardProps) {
  const { colors } = useTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="albums-outline" size={14} color={colors.textMuted} />
          <Text style={styles.title}>Mídia física</Text>
        </View>
        <Text style={styles.condition}>{CONDITION_LABELS[mediaReview.condition]}</Text>
      </View>

      <View style={styles.qualityRow}>
        <Text style={styles.qualityLabel}>{MEDIA_LABELS[mediaReview.mediaType]}</Text>
        <View style={styles.qualityValueRow}>
          <StarRating rating={mediaReview.pressingQualityRating} size={12} readOnly />
          <Text style={styles.qualityValue}>{mediaReview.pressingQualityRating.toFixed(1)}</Text>
        </View>
      </View>

      {mediaReview.pricePaid ? (
        <Text style={styles.pricePaid}>R$ {mediaReview.pricePaid}</Text>
      ) : null}
    </View>
  )
}

const createStyles = (colors: ThemeTokens) =>
  StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  condition: {
    color: colors.textMuted,
    fontSize: 13,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qualityLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  qualityValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  qualityValue: {
    color: colors.star,
    fontSize: 13,
    fontWeight: '700',
  },
  pricePaid: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
})

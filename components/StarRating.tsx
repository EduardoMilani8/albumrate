import { Ionicons } from '@expo/vector-icons'
import { Pressable, View } from 'react-native'
import { colors } from '../constants/theme'

interface StarRatingProps {
  rating: number | null
  onChange?: (rating: number) => void
  size?: number
  readOnly?: boolean
}

export default function StarRating({
  rating,
  onChange,
  size = 32,
  readOnly = false,
}: StarRatingProps) {
  const handlePress = (index: number, locationX: number) => {
    if (readOnly || !onChange) return
    const half = locationX < size / 2
    onChange(index + (half ? 0.5 : 1))
  }

  return (
    <View style={{ flexDirection: 'row' }}>
      {[0, 1, 2, 3, 4].map((index) => {
        const value = rating ?? 0
        const full = value >= index + 1
        const half = value >= index + 0.5
        const icon = full ? 'star' : half ? 'star-half' : 'star-outline'
        return (
          <Pressable
            key={index}
            disabled={readOnly}
            hitSlop={4}
            onPress={(event) => handlePress(index, event.nativeEvent.locationX)}
          >
            <Ionicons
              name={icon}
              size={size}
              color={full || half ? colors.star : colors.textMuted}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

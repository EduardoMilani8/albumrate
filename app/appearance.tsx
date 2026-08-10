import { Ionicons } from '@expo/vector-icons'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { themes } from '../constants/themes'
import { radius, spacing } from '../constants/theme'
import { useTheme } from '../lib/theme'

export default function AppearanceScreen() {
  const { colors, themeId, setTheme } = useTheme()

  return (
    <FlatList
      data={themes}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Escolha o tema do aplicativo. Ele é aplicado na hora e salvo no seu perfil.
        </Text>
      }
      renderItem={({ item }) => {
        const selected = item.id === themeId
        return (
          <Pressable
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: selected ? item.colors.accent : colors.border,
                borderWidth: selected ? 2 : 1,
              },
            ]}
            onPress={() => setTheme(item.id)}
          >
            <View style={styles.mockupWrap}>
              <View
                style={[
                  styles.mockup,
                  { backgroundColor: item.colors.background, borderColor: item.colors.border },
                ]}
              >
                <View
                  style={[
                    styles.mockHeader,
                    { backgroundColor: item.colors.surface, borderBottomColor: item.colors.border },
                  ]}
                >
                  <View style={[styles.mockDot, { backgroundColor: item.colors.accent }]} />
                  <View style={[styles.mockLine, { backgroundColor: item.colors.text, width: '55%' }]} />
                  <View style={[styles.mockLine, { backgroundColor: item.colors.textMuted, width: '22%' }]} />
                </View>
                <View
                  style={[
                    styles.mockCard,
                    { backgroundColor: item.colors.surface, borderColor: item.colors.border },
                  ]}
                >
                  <View style={[styles.mockLine, { backgroundColor: item.colors.text, width: '70%' }]} />
                  <View style={[styles.mockLine, { backgroundColor: item.colors.textMuted, width: '45%' }]} />
                  <View style={styles.mockStars}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Ionicons key={i} name="star" size={8} color={item.colors.star} />
                    ))}
                  </View>
                </View>
                <View style={[styles.mockButton, { backgroundColor: item.colors.accent }]}>
                  <Ionicons name="checkmark" size={9} color={item.colors.background} />
                </View>
              </View>
              {selected ? (
                <View style={[styles.checkBadge, { backgroundColor: item.colors.accent }]}>
                  <Ionicons name="checkmark" size={12} color={item.colors.background} />
                </View>
              ) : null}
            </View>
            <View style={styles.cardFooter}>
              <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
              {selected ? <Text style={[styles.cardActive, { color: colors.accent }]}>Ativo</Text> : null}
            </View>
          </Pressable>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    gap: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  card: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  mockupWrap: {
    position: 'relative',
  },
  mockup: {
    height: 148,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 30,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
  },
  mockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mockLine: {
    height: 4,
    borderRadius: 2,
  },
  mockCard: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  mockStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  mockButton: {
    marginTop: 'auto',
    height: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardActive: {
    fontSize: 12,
    fontWeight: '700',
  },
})

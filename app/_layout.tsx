import { Ionicons } from '@expo/vector-icons'
import { router, Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { colors, spacing } from '../constants/theme'
import { AuthProvider, useAuth } from '../lib/auth'
import { initDb } from '../lib/db'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="albumrate.db" onInit={initDb}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!!user}>
          <Stack.Screen
            name="index"
            options={{
              title: 'Meus Álbuns',
              headerRight: () => (
                <Pressable
                  onPress={() => router.push('/profile')}
                  hitSlop={8}
                  style={{ marginRight: spacing.xs }}
                >
                  <Ionicons name="person-circle-outline" size={26} color={colors.text} />
                </Pressable>
              ),
            }}
          />
          <Stack.Screen
            name="search"
            options={{ title: 'Buscar Álbum', presentation: 'modal' }}
          />
          <Stack.Screen name="album/[id]" options={{ title: '' }} />
          <Stack.Screen name="diary" options={{ title: 'Meu Diário' }} />
          <Stack.Screen name="lists" options={{ title: 'Minhas Listas' }} />
          <Stack.Screen name="list/[id]" options={{ title: '' }} />
          <Stack.Screen name="album-of-month" options={{ title: 'Álbum do Mês' }} />
          <Stack.Screen
            name="album-of-month-history"
            options={{ title: 'Histórico do Álbum do Mês' }}
          />
          <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
          <Stack.Screen name="user/[id]" options={{ title: '' }} />
          <Stack.Screen name="spotify-onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}

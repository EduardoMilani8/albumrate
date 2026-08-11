import { CormorantGaramond_400Regular, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond'
import { CourierPrime_400Regular, CourierPrime_700Bold } from '@expo-google-fonts/courier-prime'
import { Lora_400Regular, Lora_400Regular_Italic, Lora_500Medium, Lora_600SemiBold } from '@expo-google-fonts/lora'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider, useAuth } from '../lib/auth'
import { initDb } from '../lib/db'
import { ThemeProvider, useTheme } from '../lib/theme'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_400Regular_Italic,
    CourierPrime_400Regular,
    CourierPrime_700Bold,
  })

  if (!fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="albumrate.db" onInit={initDb}>
        <AuthProvider>
          <ThemeProvider>
            <RootNavigator />
          </ThemeProvider>
        </AuthProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigator() {
  const { user, initializing } = useAuth()
  const { colors, isDark } = useTheme()

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
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="activity" options={{ title: 'Atividade' }} />
          <Stack.Screen name="search" options={{ title: 'Buscar' }} />
          <Stack.Screen name="album/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="diary" options={{ title: 'Meu Diário' }} />
          <Stack.Screen name="collection" options={{ title: 'Minha Coleção' }} />
          <Stack.Screen name="lists" options={{ title: 'Minhas Listas' }} />
          <Stack.Screen name="list/[id]" options={{ title: '' }} />
          <Stack.Screen name="album-of-month" options={{ title: 'Álbum do Mês' }} />
          <Stack.Screen
            name="album-of-month-history"
            options={{ title: 'Histórico do Álbum do Mês' }}
          />
          <Stack.Screen name="profile" options={{ title: 'Perfil' }} />
          <Stack.Screen name="appearance" options={{ title: 'Aparência' }} />
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

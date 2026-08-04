import { Stack } from 'expo-router'
import { SQLiteProvider } from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { colors } from '../constants/theme'
import { initDb } from '../lib/db'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="albumrate.db" onInit={initDb}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Meus Álbuns' }} />
          <Stack.Screen
            name="search"
            options={{ title: 'Buscar Álbum', presentation: 'modal' }}
          />
          <Stack.Screen name="album/[id]" options={{ title: '' }} />
        </Stack>
      </SQLiteProvider>
    </GestureHandlerRootView>
  )
}

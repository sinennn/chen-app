import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { AuthProvider } from '@/contexts/AuthContext';
import { AppThemeProvider, useAppTheme } from '@/contexts/ThemeContext';
import { UnlocksProvider } from '@/contexts/UnlocksContext';

function RootNavigator() {
  const { themeKey } = useAppTheme();

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack key={themeKey}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="messages/[friendId]" options={{ headerShown: false }} />
        <Stack.Screen name="notifications/index" options={{ headerShown: false }} />
        <Stack.Screen name="friends/[username]" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <UnlocksProvider>
        <AppThemeProvider>
          <RootNavigator />
        </AppThemeProvider>
      </UnlocksProvider>
    </AuthProvider>
  );
}

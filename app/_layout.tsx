import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { Colors } from '@/constants/theme';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppThemeProvider, useAppTheme } from '@/contexts/ThemeContext';
import { UnlocksProvider } from '@/contexts/UnlocksContext';

function RootNavigator() {
  const { themeKey } = useAppTheme();
  const navigationTheme = {
    dark: true,
    colors: {
      primary: Colors.orange,
      background: Colors.bg,
      card: Colors.bgCard,
      text: Colors.textPrimary,
      border: Colors.border,
      notification: Colors.orange,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '800' as const },
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
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

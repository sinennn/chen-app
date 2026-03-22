import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
//@ts-ignore
import { ActivityIndicator, View } from 'react-native';

export default function AuthLayout() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const lastUserState = useRef<boolean>(false);

  // Reset redirect flag when user state changes
  useEffect(() => {
    const currentUserState = !!user;
    if (lastUserState.current !== currentUserState) {
      hasRedirected.current = false;
      lastUserState.current = currentUserState;
    }
  }, [user]);

  useEffect(() => {
    if (loading || hasRedirected.current) return;

    if (user && profile !== null) {
      hasRedirected.current = true;

      if (profile.username && profile.avatar_id) {
        router.replace('/(tabs)');
      } else {
        if (profile.username) {
          router.replace({
            pathname: '/(auth)/avatar',
            params: { username: profile.username },
          });
          return;
        }

        router.replace('/(auth)/username');
      }
    }
  }, [user, profile, loading, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  if (user && profile === null) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

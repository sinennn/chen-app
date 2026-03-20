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
      
      if (profile.avatar_id && profile.username) {
        console.log('AuthLayout: User has completed onboarding, navigating to tabs');
        router.replace('/(tabs)');
      } else if (profile.username) {
        console.log('AuthLayout: User has username but no avatar, navigating to avatar selection');
        router.replace('/(auth)/avatar');
      } else {
        console.log('AuthLayout: User needs username, navigating to username selection');
        router.replace('/(auth)/username');
      }
    }
  }, [user, profile, loading, router]);

  console.log('AuthLayout: Rendering - user:', !!user, 'profile:', !!profile, 'loading:', loading, 'hasRedirected:', hasRedirected.current);

  if (loading) {
    console.log('AuthLayout: Still loading, showing spinner');
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  if (user && profile === null) {
    console.log('AuthLayout: Profile is null, waiting for profile data');
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  console.log('AuthLayout: Showing auth stack');
  return <Stack screenOptions={{ headerShown: false }} />;
}
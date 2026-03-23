import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/theme';

export default function IntroScreen() {
  const router = useRouter();

  useEffect(() => {
    // Add a small delay to ensure navigation works on first load
    const timer = setTimeout(() => {
      router.push('/(auth)/welcome');
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );
}


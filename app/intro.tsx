import { useRouter } from 'expo-router';
import { useEffect } from 'react';
//@ts-ignore
import { ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/theme';

export default function IntroScreen() {
  const router = useRouter();

  useEffect(() => {
      const timer = setTimeout(() => {
      router.push('/(auth)/welcome');
    }, 75);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.orange} />
    </View>
  );
}


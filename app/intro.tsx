import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';

export default function IntroScreen() {
  const router = useRouter();

  useEffect(() => {
    router.push('/(auth)/welcome');
  }, [router]);

  return <View className="flex-1" style={{ backgroundColor: Colors.bg }} />;
}


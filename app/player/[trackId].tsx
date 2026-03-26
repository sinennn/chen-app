import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Text, View } from 'react-native';

export default function PlayerScreen() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();

  return (
    <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: Colors.bg }}>
      <Text className="mb-2 text-xs uppercase tracking-[0.3em]" style={{ color: Colors.textMuted }}>
        now playing
      </Text>
      <Text className="mb-4 text-3xl font-semibold" style={{ color: Colors.textPrimary }}>
        Track {trackId ?? ''}
      </Text>
      <Text className="text-center text-base" style={{ color: Colors.textSecondary }}>
        This is the expanded player view. We&apos;ll add shared album art transitions, playback
        controls and reactions here.
      </Text>
    </View>
  );
}


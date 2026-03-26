import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { Text, View } from 'react-native';

export default function MessagesScreen() {
  const { friendId, username } = useLocalSearchParams<{ friendId: string; username?: string }>();
  const displayName = username || friendId || 'friend';

  return (
    <View className="flex-1 px-4 pt-16" style={{ backgroundColor: Colors.bg }}>
      <Text className="mb-2 text-sm" style={{ color: Colors.textSecondary }}>
        Messages
      </Text>
      <Text className="mb-4 text-2xl font-semibold" style={{ color: Colors.textPrimary }}>
        Chat with {displayName}
      </Text>
      <View
        className="flex-1 items-center justify-center rounded-3xl border border-dashed px-4"
        style={{ borderColor: Colors.border }}
      >
        <Text className="text-center text-base" style={{ color: Colors.textMuted }}>
          DM thread UI coming soon — text bubbles, voice notes and reactions will live here.
        </Text>
      </View>
    </View>
  );
}

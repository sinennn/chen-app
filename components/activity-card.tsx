import { View, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { AvatarRing } from '@/components/ui/avatar-ring';
import { GlassCard } from '@/components/ui/glass-card';

type ActivityCardProps = {
  username: string;
  track: string;
  artist: string;
  platform: 'spotify' | 'audiomack';
  timeAgo: string;
  isPlaying?: boolean;
};

export function ActivityCard({
  username,
  track,
  artist,
  platform,
  timeAgo,
  isPlaying,
}: ActivityCardProps) {
  return (
    <GlassCard className="mb-3 flex-row items-center gap-3">
      <AvatarRing
        isPlaying={Boolean(isPlaying)}
        source={require('@/assets/images/react-logo.png')}
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold" style={{ color: Colors.textPrimary }}>
          {username}
        </Text>
        <Text className="text-sm" style={{ color: Colors.textSecondary }}>
          {track} · {artist}
        </Text>
        <Text className="mt-1 text-xs" style={{ color: Colors.textMuted }}>
          {platform} · {timeAgo}
        </Text>
      </View>
    </GlassCard>
  );
}


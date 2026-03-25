//@ts-nocheck
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { PublicProfileData, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native';

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <View style={{ width: 3, height: 16, backgroundColor: Colors.orange, borderRadius: 2, marginRight: 8 }} />
      <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
      <Text style={{ color: Colors.textMuted, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return 'now';
  const now = new Date();
  const playedAt = new Date(timestamp);
  const diffMs = now.getTime() - playedAt.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfileData | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError('User not found');
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.profile.user(userId);
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load profile');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop' }}
        style={{ position: 'absolute', width: '100%', height: 300, top: 0 }}
        blurRadius={30}
      />
      <LinearGradient
        colors={['rgba(13,11,9,0.5)', 'rgba(13,11,9,0.85)', Colors.bg]}
        style={{ position: 'absolute', width: '100%', height: 300, top: 0 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(232,100,10,0.15)' }}
        >
          <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2.5, textTransform: 'uppercase' }}>Profile</Text>
        <View style={{ width: 38, height: 38 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : error || !profile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Couldn’t load profile</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center' }}>{error || 'Something went wrong.'}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 }}>
            <Image
              source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${profile.user.avatar_id || 'default'}&size=120&backgroundColor=0D0B09` }}
              style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 2.5, borderColor: Colors.orange, marginBottom: 16 }}
            />
            <Text style={{ color: Colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 }}>
              {profile.user.username || '--'}
            </Text>
            {profile.user.user_tag ? (
              <Text style={{ color: Colors.orange, fontSize: 13, fontWeight: '600', opacity: 0.85 }}>
                @{profile.user.user_tag}
              </Text>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { value: profile.stats.totalPlays || '--', label: 'total plays' },
                { value: profile.stats.artistsPlayed || '--', label: 'artists played' },
                { value: profile.stats.topArtist || '--', label: 'top artist' },
              ].map((stat, index) => (
                <View key={index} style={{ flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(232, 100, 10, 0.12)' }}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={{ color: Colors.orange, fontSize: 22, fontWeight: '800', marginBottom: 4, width: '100%', textAlign: 'center' }}>
                    {stat.value}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center' }}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(232,100,10,0.2)' }}>
              <LinearGradient colors={['rgba(232,100,10,0.18)', 'rgba(232,100,10,0.04)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
                <SectionLabel>Now Playing</SectionLabel>
                {profile.nowPlaying ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={{ uri: profile.nowPlaying.album_art_url }} style={{ width: 70, height: 70, borderRadius: 14, marginRight: 14 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                        {profile.nowPlaying.track_name}
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                        {profile.nowPlaying.artist_name}
                      </Text>
                    </View>
                    <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: '#1DB954' }}>
                      <Text style={{ color: '#05120b', fontSize: 10, fontWeight: '800' }}>LIVE</Text>
                    </View>
                  </View>
                ) : (
                  <EmptyState message="Not listening to anything live right now" />
                )}
              </LinearGradient>
            </View>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(232, 100, 10, 0.12)' }}>
              <SectionLabel>Top Artists</SectionLabel>
              {profile.topArtists.length > 0 ? profile.topArtists.map((artist, index) => (
                <View key={`${artist.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: index < profile.topArtists.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  <Image source={{ uri: artist.imageUrl || `https://api.dicebear.com/7.x/shapes/png?seed=${encodeURIComponent(artist.name)}&size=64` }} style={{ width: 46, height: 46, borderRadius: 12, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{artist.name}</Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{artist.playCount} plays</Text>
                  </View>
                </View>
              )) : <EmptyState message="No top artists yet" />}
            </View>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(232, 100, 10, 0.12)' }}>
              <SectionLabel>Top Tracks</SectionLabel>
              {profile.topTracks.length > 0 ? profile.topTracks.map((track, index) => (
                <View key={`${track.name}-${track.artist}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: index < profile.topTracks.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700', width: 20, marginRight: 10 }}>{index + 1}</Text>
                  <Image source={{ uri: track.imageUrl }} style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{track.name}</Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{track.artist}</Text>
                  </View>
                  <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '700' }}>{track.playCount}x</Text>
                </View>
              )) : <EmptyState message="No top tracks yet" />}
            </View>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(232, 100, 10, 0.12)' }}>
              <SectionLabel>Recent Activity</SectionLabel>
              {profile.recentTracks.length > 0 ? profile.recentTracks.map((track, index) => (
                <View key={`${track.id}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: index < profile.recentTracks.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                  <Image source={{ uri: track.album_art_url }} style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{track.track_name}</Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{track.artist_name}</Text>
                  </View>
                  <Text style={{ color: Colors.textMuted, fontSize: 12 }}>{formatTimestamp(track.played_at || track.started_at)}</Text>
                </View>
              )) : <EmptyState message="No recent listening activity" />}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

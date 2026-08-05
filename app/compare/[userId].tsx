//@ts-nocheck
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { CompatibilityArtist, CompatibilityData, CompatibilityTrack, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

function MatchColor(score: number) {
  if (score >= 85) return Colors.orange;
  if (score >= 65) return Colors.success;
  if (score > 0) return Colors.accentSecondary;
  return Colors.surfaceStrong;
}

function avatarURL(seed: string) {
  return `https://api.dicebear.com/7.x/adventurer/png?seed=${seed || 'default'}&size=120&backgroundColor=0D0B09`;
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 420, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function SectionHeader({ title, subtitle, color = Colors.textPrimary }: { title: string; subtitle?: string; color?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color, fontSize: 20, fontWeight: '800' }}>{title}</Text>
      {subtitle ? <Text style={{ color: Colors.textMuted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text> : null}
    </View>
  );
}

function ArtistCard({ artist, index }: { artist: CompatibilityArtist; index: number }) {
  return (
    <FadeIn delay={index * 70}>
      <View style={{ alignItems: 'center', marginRight: 14, width: 84 }}>
        {artist.imageUrl ? (
          <Image
            source={{ uri: artist.imageUrl }}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              marginBottom: 8,
              borderWidth: 2,
              borderColor: 'rgba(255,255,255,0.16)',
            }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              marginBottom: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: Colors.surfaceMuted,
              borderWidth: 1,
              borderColor: Colors.surfaceStrong,
            }}
          >
            <IconSymbol name="music.note" size={24} color={Colors.orange} />
          </View>
        )}
        <Text numberOfLines={2} style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 }}>
          {artist.name}
        </Text>
      </View>
    </FadeIn>
  );
}

function TrackRow({ track, index }: { track: CompatibilityTrack; index: number }) {
  return (
    <FadeIn delay={index * 60}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: index < 2 ? 1 : 0,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {track.imageUrl ? (
          <Image source={{ uri: track.imageUrl }} style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12 }} />
        ) : (
          <View style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="music.note" size={18} color={Colors.orange} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{track.name}</Text>
          <Text numberOfLines={1} style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{track.artist}</Text>
        </View>
      </View>
    </FadeIn>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <View style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center' }}>{message}</Text>
    </View>
  );
}

function ArtistSection({
  title,
  subtitle,
  artists,
  color,
  empty,
}: {
  title: string;
  subtitle: string;
  artists: CompatibilityArtist[];
  color?: string;
  empty: string;
}) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 34 }}>
      <SectionHeader title={title} subtitle={subtitle} color={color} />
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.09)',
        }}
      >
        {artists.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {artists.map((artist, index) => <ArtistCard key={`${artist.name}-${index}`} artist={artist} index={index} />)}
          </ScrollView>
        ) : (
          <EmptySection message={empty} />
        )}
      </View>
    </View>
  );
}

export default function CompareScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [data, setData] = useState<CompatibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCompatibility() {
      const targetUserId = Array.isArray(userId) ? userId[0] : userId;
      if (!targetUserId) {
        setError('No user selected.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const result = await api.compatibility.user(targetUserId);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load compatibility.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCompatibility();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const scoreColor = MatchColor(data?.score || 0);
  const backgroundImage =
    data?.sharedArtists[0]?.imageUrl ||
    data?.sharedTracks[0]?.imageUrl ||
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ImageBackground source={{ uri: backgroundImage }} style={{ flex: 1 }} blurRadius={28}>
        <LinearGradient colors={['rgba(13,11,9,0.84)', 'rgba(13,11,9,0.92)', Colors.bg]} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 18 }}>
            <Pressable
              onPress={() => router.back()}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
            >
              <IconSymbol name="chevron.left" size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.textMuted, letterSpacing: 2.2, textTransform: 'uppercase' }}>
              Music Match
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Colors.orange} size="large" />
            </View>
          ) : error || !data ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Couldn&apos;t compare taste</Text>
              <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 18 }}>{error || 'Try again in a moment.'}</Text>
              <Pressable onPress={() => router.back()} style={{ backgroundColor: Colors.orange, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 11 }}>
                <Text style={{ color: Colors.white, fontSize: 14, fontWeight: '800' }}>Go back</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <FadeIn>
                <View style={{ alignItems: 'center', paddingHorizontal: 20, marginBottom: 34 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
                    <Image source={{ uri: avatarURL(data.you.avatar_id) }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: scoreColor }} />
                    <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: '900', marginHorizontal: 15 }}>vs</Text>
                    <Image source={{ uri: avatarURL(data.them.avatar_id) }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: scoreColor }} />
                  </View>
                  <Text style={{ color: Colors.textPrimary, fontSize: 25, fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>
                    {data.you.username} + {data.them.username}
                  </Text>
                  <View style={{ backgroundColor: scoreColor, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22 }}>
                    <Text style={{ color: Colors.white, fontSize: 17, fontWeight: '900' }}>{data.score}% compatible</Text>
                  </View>
                </View>
              </FadeIn>

              <ArtistSection
                title="Shared Artists"
                subtitle="Artists sitting in both rotations"
                artists={data.sharedArtists}
                color={Colors.orange}
                empty="No shared top artists yet. Your overlap will improve as listening history grows."
              />

              {data.sharedTracks.length > 0 ? (
                <View style={{ paddingHorizontal: 20, marginBottom: 34 }}>
                  <SectionHeader title="Shared Tracks" subtitle="Songs you both keep close" color={Colors.orange} />
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' }}>
                    {data.sharedTracks.slice(0, 3).map((track, index) => <TrackRow key={`${track.name}-${track.artist}-${index}`} track={track} index={index} />)}
                  </View>
                </View>
              ) : null}

              <ArtistSection
                title="Only You"
                subtitle="Your side of the aux cable"
                artists={data.yourUniqueArtists}
                empty="No unique artists found yet."
              />

              <ArtistSection
                title={`Only ${data.them.username}`}
                subtitle="Their side of the aux cable"
                artists={data.theirUniqueArtists}
                empty="No unique artists found yet."
              />

              <View style={{ paddingHorizontal: 20 }}>
                <View style={{ backgroundColor: 'rgba(232,100,10,0.08)', borderRadius: 20, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,100,10,0.22)' }}>
                  <IconSymbol name="music.note" size={30} color={Colors.orange} />
                  <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '900', marginTop: 12, marginBottom: 8, textAlign: 'center' }}>
                    Discover Together
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                    {data.insight}
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

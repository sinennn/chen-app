//@ts-nocheck
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { PublicProfileData, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <View style={{ width: 3, height: 16, backgroundColor: Colors.orange, borderRadius: 2, marginRight: 8 }} />
      <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>{children}</Text>
    </View>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: any }) {
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: 'rgba(232, 100, 10, 0.12)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function FadeSlide({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function EqualizerBars() {
  const bars = [
    useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.7)).current,
    useRef(new Animated.Value(0.5)).current,
    useRef(new Animated.Value(0.9)).current,
  ];

  useEffect(() => {
    const animate = () => {
      Animated.parallel(
        bars.map((bar) =>
          Animated.sequence([
            Animated.timing(bar, { toValue: Math.random() * 0.7 + 0.3, duration: 250 + Math.random() * 200, useNativeDriver: false }),
            Animated.timing(bar, { toValue: Math.random() * 0.7 + 0.3, duration: 250 + Math.random() * 200, useNativeDriver: false }),
          ])
        )
      ).start(() => animate());
    };

    animate();
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{ width: 3, height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 18] }), backgroundColor: Colors.orange, borderRadius: 2 }} />
      ))}
    </View>
  );
}

function LiveDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.orange, marginLeft: 7, opacity: pulse, alignSelf: 'center' }} />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
      <Text style={{ color: Colors.textMuted, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  fill = true,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  fill?: boolean;
}) {
  const primary = variant === 'primary';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: fill ? 1 : undefined,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 24,
        backgroundColor: primary ? Colors.orange : 'transparent',
        borderWidth: 1.5,
        borderColor: primary ? Colors.orange : 'rgba(232,100,10,0.25)',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <IconSymbol name={icon as any} size={15} color={primary ? Colors.white : Colors.orange} />
      <Text style={{ color: primary ? Colors.white : Colors.orange, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }}>
        {label}
      </Text>
    </Pressable>
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

function getRelationshipCopy(profile: PublicProfileData | null) {
  const status = profile?.relationship?.status;

  switch (status) {
    case 'friends':
      return {
        eyebrow: 'already in your circle',
        description: 'Message them, compare notes, and keep the taste network growing.',
        primaryLabel: 'Message',
        secondaryLabel: 'Friends',
      };
    case 'incoming_pending':
      return {
        eyebrow: 'wants to connect',
        description: 'They already sent a request. Accept it and open the door to messaging.',
        primaryLabel: 'Accept request',
        secondaryLabel: 'Message',
      };
    case 'outgoing_pending':
      return {
        eyebrow: 'request sent',
        description: 'The invite is out. Once they accept, this profile becomes a real social touchpoint.',
        primaryLabel: 'Requested',
        secondaryLabel: 'Message',
      };
    case 'self':
      return {
        eyebrow: 'this is you',
        description: 'Jump back to your own profile tab to edit your setup and see your full private view.',
        primaryLabel: 'Open my profile',
        secondaryLabel: '',
      };
    case 'none':
    default:
      return {
        eyebrow: 'discovering their taste',
        description: 'See the music story first, then send a friend request if the vibe checks out.',
        primaryLabel: 'Ask to be friends',
        secondaryLabel: 'Message',
      };
  }
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed?.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {}

  return error.message;
}

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const avatarScale = useRef(new Animated.Value(0.85)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  const loadProfile = async (showSpinner = true, fresh = false) => {
    if (!userId) {
      setLoading(false);
      setError('User not found');
      return;
    }

    try {
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);
      const data = await api.profile.user(userId, { fresh });
      setProfile(data);
    } catch (err) {
      setError(parseErrorMessage(err, 'Failed to load profile'));
    } finally {
      if (showSpinner) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId) {
        setLoading(false);
        setError('User not found');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await api.profile.user(userId, { fresh: true });
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(parseErrorMessage(err, 'Failed to load profile'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(avatarOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleMessagePress = () => {
    if (!profile) return;

    if (profile.relationship.status === 'self' || profile.user.id === user?.id) {
      router.push('/(tabs)/profile');
      return;
    }

    if (!profile.relationship.canMessage) {
      Alert.alert('Messaging locked', 'Become friends first and messaging will open here.');
      return;
    }

    router.push({
      pathname: '/messages/[friendId]',
      params: {
        friendId: profile.user.id,
        username: profile.user.username,
      },
    });
  };

  const handlePrimaryAction = async () => {
    if (!profile || submitting) return;

    if (profile.relationship.status === 'self' || profile.user.id === user?.id) {
      router.push('/(tabs)/profile');
      return;
    }

    if (profile.relationship.status === 'friends') {
      handleMessagePress();
      return;
    }

    if (profile.relationship.status === 'outgoing_pending') {
      return;
    }

    setSubmitting(true);
    try {
      if (profile.relationship.status === 'incoming_pending' && profile.relationship.friendshipId) {
        await api.friends.accept(profile.relationship.friendshipId);
      } else {
        await api.friends.add(profile.user.username);
      }

      await loadProfile(false);
    } catch (err) {
      Alert.alert('Action failed', parseErrorMessage(err, 'Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const relationshipCopy = getRelationshipCopy(profile);
  const showSecondaryAction = Boolean(profile && profile.relationship.status !== 'self');
  const headerUsername = profile?.user?.username || 'Profile';

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
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2.5, textTransform: 'uppercase' }}>
          {`${headerUsername}'s Profile`}
        </Text>
        <View style={{ width: 38, height: 38 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.orange} size="large" />
        </View>
      ) : error || !profile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Couldn&apos;t load profile</Text>
          <Text style={{ color: Colors.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 18 }}>{error || 'Something went wrong.'}</Text>
          <ActionButton icon="arrow.clockwise" label="Try again" onPress={() => loadProfile(true, true)} fill={false} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          <FadeSlide delay={0}>
            <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 }}>
              <Animated.View style={{ position: 'absolute', top: 6, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(232,100,10,0.2)', opacity: glowOpacity }} />
              <Animated.View style={{ opacity: avatarOpacity, transform: [{ scale: avatarScale }], marginBottom: 16 }}>
                <Image
                  source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${profile.user.avatar_id || 'default'}&size=120&backgroundColor=0D0B09` }}
                  style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 2.5, borderColor: Colors.orange }}
                />
              </Animated.View>
              <Text style={{ color: Colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 }}>
                {profile.user.username || '--'}
              </Text>
              {profile.user.user_tag ? (
                <Text style={{ color: Colors.orange, fontSize: 13, fontWeight: '600', marginBottom: 4, opacity: 0.8 }}>
                  @{profile.user.user_tag}
                </Text>
              ) : null}
              <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 10 }}>
                {relationshipCopy.eyebrow}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 20 }}>
                {relationshipCopy.description}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <ActionButton
                  icon={profile.relationship.status === 'friends' ? 'message.fill' : 'person.badge.plus'}
                  label={submitting ? 'Working...' : relationshipCopy.primaryLabel}
                  onPress={handlePrimaryAction}
                  disabled={submitting || profile.relationship.status === 'outgoing_pending'}
                />
                {showSecondaryAction ? (
                  <ActionButton
                    icon={
                      profile.relationship.status === 'friends'
                        ? 'person.2.fill'
                        : profile.relationship.canMessage
                          ? 'message.fill'
                          : 'lock.fill'
                    }
                    label={relationshipCopy.secondaryLabel}
                    variant="secondary"
                    onPress={handleMessagePress}
                    disabled={profile.relationship.status === 'friends' || !profile.relationship.canMessage}
                  />
                ) : null}
              </View>
              {!profile.relationship.canMessage && profile.relationship.status !== 'self' ? (
                <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 14 }}>
                  Messaging unlocks once you are connected as friends.
                </Text>
              ) : null}
            </View>
          </FadeSlide>

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <FadeSlide delay={100}>
              <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(232,100,10,0.2)' }}>
                <LinearGradient colors={['rgba(232,100,10,0.18)', 'rgba(232,100,10,0.04)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                    <SectionLabel>Now Playing</SectionLabel>
                    {profile.nowPlaying?.is_playing && <LiveDot />}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {profile.nowPlaying?.album_art_url ? (
                      <Image source={{ uri: profile.nowPlaying.album_art_url }} style={{ width: 70, height: 70, borderRadius: 14, marginRight: 14 }} />
                    ) : (
                      <View style={{ width: 70, height: 70, borderRadius: 14, marginRight: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: Colors.textMuted, fontSize: 24 }}>♪</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                        {profile.nowPlaying?.track_name || "Nothing's playing rn"}
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                        {profile.nowPlaying?.artist_name || "and no one's singing either"}
                      </Text>
                    </View>
                    {profile.nowPlaying?.is_playing && <EqualizerBars />}
                  </View>
                </LinearGradient>
              </View>
            </FadeSlide>

            <FadeSlide delay={160}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { value: profile.stats.minutesListened > 0 ? profile.stats.minutesListened.toLocaleString() : '--', label: 'min this week' },
                  { value: profile.stats.artistsPlayed > 0 ? profile.stats.artistsPlayed.toString() : '--', label: 'artists played' },
                  { value: profile.stats.topGenre || '--', label: 'top genre' },
                ].map((stat, i) => (
                  <Card key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: Colors.orange, fontSize: 22, fontWeight: '800', marginBottom: 4, width: '100%', textAlign: 'center' }}>
                      {stat.value}
                    </Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center' }}>{stat.label}</Text>
                  </Card>
                ))}
              </View>
            </FadeSlide>

            <FadeSlide delay={220}>
              <View>
                <SectionLabel>Top Artists</SectionLabel>
                {profile.topArtists.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                    {profile.topArtists.slice(0, 5).map((artist, i) => (
                      <Pressable key={`${artist.name}-${i}`} style={{ width: 120, height: 130, borderRadius: 18, overflow: 'hidden', marginHorizontal: 5, borderWidth: 1, borderColor: 'rgba(232,100,10,0.1)' }}>
                        {artist.imageUrl ? (
                          <Image source={{ uri: artist.imageUrl }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                        ) : (
                          <View style={{ width: '100%', height: '100%', position: 'absolute', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 24 }}>♪</Text>
                          </View>
                        )}
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 30 }}>
                          <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700' }}>{artist.name}</Text>
                        </LinearGradient>
                        <Text style={{ position: 'absolute', bottom: 6, right: 8, color: 'rgba(232,100,10,0.8)', fontSize: 26, fontWeight: '900', lineHeight: 28 }}>{i + 1}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ height: 130, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(232,100,10,0.08)' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No top artists yet</Text>
                  </View>
                )}
              </View>
            </FadeSlide>

            <FadeSlide delay={280}>
              <Card>
                <SectionLabel>Top Tracks</SectionLabel>
                {profile.topTracks.length > 0 ? profile.topTracks.slice(0, 3).map((track, i) => (
                  <Pressable key={`${track.name}-${track.artist}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i < Math.min(profile.topTracks.length, 3) - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700', width: 20, marginRight: 10 }}>{i + 1}</Text>
                    <Image source={{ uri: track.imageUrl }} style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{track.name}</Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{track.artist}</Text>
                    </View>
                    <IconSymbol name="play.fill" size={14} color="rgba(232,100,10,0.5)" />
                  </Pressable>
                )) : <EmptyState message="No top tracks yet" />}
              </Card>
            </FadeSlide>

            <FadeSlide delay={340}>
              <View style={{ paddingBottom: 6 }}>
                <SectionLabel>Recently Played</SectionLabel>
                {profile.recentTracks.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 2, paddingRight: 14 }}>
                    {profile.recentTracks.slice(0, 10).map((track, i) => (
                      <Pressable key={`${track.id}-${i}`} style={{ width: 112, marginRight: 12 }}>
                        <Image
                          source={{ uri: track.album_art_url }}
                          style={{
                            width: 112,
                            height: 120,
                            borderRadius: 7,
                            borderWidth: 1,
                            borderColor: 'rgba(232,100,10,0.14)',
                            marginBottom: 10,
                          }}
                        />
                        <Text numberOfLines={3} style={{ color: Colors.white, fontSize: 12, fontWeight: '700', lineHeight: 16, marginBottom: 4, minHeight: 32 }}>
                          {track.track_name}
                        </Text>
                        <Text numberOfLines={1} style={{ color: Colors.orange, fontSize: 11, fontWeight: '600', marginBottom: 2 }}>
                          {track.artist_name}
                        </Text>
                        <Text numberOfLines={1} style={{ color: Colors.textMuted, fontSize: 10 }}>
                          {formatTimestamp(track.played_at)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={{ height: 126, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(232,100,10,0.08)' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No recent tracks</Text>
                  </View>
                )}
              </View>
            </FadeSlide>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

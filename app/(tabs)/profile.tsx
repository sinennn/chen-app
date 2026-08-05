//@ts-nocheck
import { EditProfileModal } from '@/components/edit-profile-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useUnlocks } from '@/contexts/UnlocksContext';
import { useCurrentUserIdentity } from '@/hooks/use-current-user-identity';
import { RecommendedTrack, ReferralPerkKey, SpotifyArtist, api } from '@/lib/api';
import AsyncStorage from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View
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
    <View style={[{ backgroundColor: Colors.surfaceSoft, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.border }, style]}>
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
        bars.map(bar => Animated.sequence([
          Animated.timing(bar, { toValue: Math.random() * 0.7 + 0.3, duration: 250 + Math.random() * 200, useNativeDriver: false }),
          Animated.timing(bar, { toValue: Math.random() * 0.7 + 0.3, duration: 250 + Math.random() * 200, useNativeDriver: false }),
        ]))
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
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
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

function hasImageURI(value?: string | null) {
  return typeof value === 'string' && value.trim().length > 0;
}

function getArtistPerkKey(rank: number): ReferralPerkKey | null {
  switch (rank) {
    case 3:
      return 'top_artist_3';
    case 4:
      return 'top_artist_4';
    case 5:
      return 'top_artist_5';
    default:
      return null;
  }
}

const PROFILE_SCREEN_CACHE_KEY = 'chen_profile_screen_data_v2';

async function loadProfileScreenCache() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_SCREEN_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveProfileScreenCache(data: any) {
  try {
    await AsyncStorage.setItem(PROFILE_SCREEN_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore cache save errors
  }
}

function dedupeRecentTracks(tracks: any[]) {
  const seen = new Set<string>();
  const unique: any[] = [];

  for (const track of tracks) {
    const key = `${(track.track_name || '').trim().toLowerCase()}::${(track.artist_name || '').trim().toLowerCase()}::${(track.album_name || '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(track);
  }

  return unique;
}

function SpotifyStatusCard({ connected, loading, onReconnect }: {
  connected: boolean | null;
  loading: boolean;
  onReconnect: () => void;
}) {
  return (
    
    // <View style={{
    //   borderRadius: 20, overflow: 'hidden',
    //   borderWidth: 1,
    //   borderColor: isConnected ? 'rgba(29,185,84,0.25)' : 'rgba(232,100,10,0.2)',
    // }}>
    //   <LinearGradient
    //     colors={isConnected
    //       ? ['rgba(29,185,84,0.12)', 'rgba(29,185,84,0.03)', 'transparent']
    //       : ['rgba(232,100,10,0.15)', 'rgba(232,100,10,0.03)', 'transparent']}
    //     start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    //     style={{ padding: 16 }}
    //   >
    //     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          
    //       <View style={{
    //         width: 44, height: 44, borderRadius: 13,
    //         backgroundColor: '#1DB954',
    //         alignItems: 'center', justifyContent: 'center',
    //         marginRight: 14,
    //         shadowColor: '#1DB954',
    //         shadowOffset: { width: 0, height: 4 },
    //         shadowOpacity: 0.4, shadowRadius: 8,
    //       }}>
    //         <Text style={{ fontSize: 20 }}>♫</Text>
    //       </View>

    //       <View style={{ flex: 1 }}>
    //         <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 2 }}>
    //           Spotify
    //         </Text>
    //         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    //           <View style={{
    //             width: 6, height: 6, borderRadius: 3,
    //             backgroundColor: isConnected ? '#1DB954' : Colors.textMuted,
    //             marginRight: 6,
    //           }} />
    //           <Text style={{ color: isConnected ? '#1DB954' : Colors.textMuted, fontSize: 12, fontWeight: '500' }}>
    //             {loading ? 'Checking...' : isConnected ? 'Connected' : 'Not connected'}
    //           </Text>
    //         </View>
    //       </View>

    //       {isConnected && (
    //         <View style={{
    //           paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    //           backgroundColor: 'rgba(29,185,84,0.12)',
    //           borderWidth: 1, borderColor: 'rgba(29,185,84,0.25)',
    //         }}>
    //           <Text style={{ color: '#1DB954', fontSize: 11, fontWeight: '700' }}>Active</Text>
    //         </View>
    //       )}
    //     </View>

    //     {!isConnected && !loading && (
    //       <Pressable
    //         onPress={onReconnect}
    //         style={{
    //           marginTop: 14,
    //           backgroundColor: '#1DB954',
    //           borderRadius: 13, paddingVertical: 12,
    //           alignItems: 'center',
    //           shadowColor: '#1DB954',
    //           shadowOffset: { width: 0, height: 4 },
    //           shadowOpacity: 0.3, shadowRadius: 10,
    //         }}
    //       >
    //         <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
    //           Reconnect Spotify
    //         </Text>
    //       </Pressable>
    //     )}
    //   </LinearGradient>
    // </View>

    <View></View>
  );
}

export default function ProfileScreen() {
  const { user, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { isTopArtistUnlocked, status } = useUnlocks();
  const currentUser = useCurrentUserIdentity();
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [nowPlaying, setNowPlaying] = useState<any>(null);
  const [recentTracks, setRecentTracks] = useState<any[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [recommendedTracks, setRecommendedTracks] = useState<RecommendedTrack[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [stats, setStats] = useState({ minutesListened: 0, artistsPlayed: 0, topGenre: '--' });
  const [statsLoading, setStatsLoading] = useState(true);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [lockedArtistRank, setLockedArtistRank] = useState<number | null>(null);

  const avatarScale = useRef(new Animated.Value(0.85)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;
  const isNowPlayingLive = !!nowPlaying?.is_playing;
  const featuredPlayback = isNowPlayingLive ? nowPlaying : (recentTracks[0] ?? nowPlaying);
  const playbackLabel = isNowPlayingLive ? 'Now Playing' : 'Last Played';

  const checkSpotifyConnection = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setSpotifyConnected(false); return; }
      const { data } = await supabase
        .from('spotify_connections')
        .select('access_token, expires_at')
        .eq('user_id', authUser.id)
        .single();
      setSpotifyConnected(!!(data?.access_token));
    } catch {
      setSpotifyConnected(false);
    }
  };

  const fetchProfileData = async ({ freshTopArtists = false }: { freshTopArtists?: boolean } = {}) => {
    if (authLoading || !user) {
      return;
    }

    checkSpotifyConnection();

    api.spotify.nowPlaying()
      .then((data) => {
        setNowPlaying(data);
      })
      .catch(() => {
        // keep existing nowPlaying cached value on error
      });

    api.spotify.recent()
      .then((data) => {
        const unique = dedupeRecentTracks(data || []);
        setRecentTracks(unique.slice(0, 10));
      })
      .catch(() => {
        // keep existing recentTracks from cache
      });

    api.friends.list()
      .then((data) => {
        setFriends((data || []).slice(0, 3));
      })
      .catch(() => {
        // keep existing friends from cache
      });

    setStatsLoading(true);
    api.profile.stats()
      .then((data) => {
        const nextStats = data || { minutesListened: 0, artistsPlayed: 0, topGenre: '--' };
        setStats((prev) => ({
          minutesListened: nextStats.minutesListened ?? 0,
          artistsPlayed: nextStats.artistsPlayed ?? 0,
          topGenre:
            typeof nextStats.topGenre === 'string' &&
            nextStats.topGenre.trim() !== '' &&
            nextStats.topGenre !== '--'
              ? nextStats.topGenre
              : prev.topGenre,
        }));
      })
      .catch(() => {
        // keep existing stats from cache
      })
      .finally(() => setStatsLoading(false));

    api.spotify.topArtists('short_term', 5, { fresh: freshTopArtists })
      .then((data) => {
        const artists = data?.items || [];
        setTopArtists(artists);
        const topGenre = deriveTopGenreFromArtists(artists);
        if (topGenre) {
          setStats((prev) => ({ ...prev, topGenre }));
        }
      })
      .catch(() => {
        // keep existing topArtists from cache
      });

    api.profile.topTracks()
      .then((data) => setTopTracks(data || []))
      .catch(() => {
        // keep existing topTracks from cache
      });

    api.spotify.recommendations()
      .then((data) => setRecommendedTracks(data || []))
      .catch(() => {
        // keep existing recommended tracks from cache
      });
  };

  const handleReconnectSpotify = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        Alert.alert('Error', 'No authenticated user found');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('avatar_id, username')
        .eq('id', authUser.id)
        .single();
      if (userError) {
        Alert.alert('Error', 'Failed to prepare Spotify reconnection');
        return;
      }

      const { error: deleteError } = await supabase.from('spotify_connections').delete().eq('user_id', authUser.id);
      if (deleteError) {
        Alert.alert('Error', 'Failed to clear existing Spotify connection');
        return;
      }

      const params: any = {};
      if (userData?.avatar_id) params.avatarSeed = userData.avatar_id;
      if (userData?.username) params.username = userData.username;

      router.push({ pathname: '/(auth)/music-services' as any, params });
    } catch {
      Alert.alert('Error', 'Failed to reconnect Spotify. Please try again.');
    }
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const init = async () => {
      const cached = await loadProfileScreenCache();
      if (cached) {
        setSpotifyConnected(cached.spotifyConnected ?? null);
        setNowPlaying(cached.nowPlaying ?? null);
        setRecentTracks(dedupeRecentTracks(cached.recentTracks ?? []));
        setTopArtists(cached.topArtists ?? []);
        setTopTracks(cached.topTracks ?? []);
        setRecommendedTracks(cached.recommendedTracks ?? []);
        setFriends(cached.friends ?? []);
        setStats(cached.stats ?? { minutesListened: 0, artistsPlayed: 0, topGenre: '--' });
        setStatsLoading(cached.statsLoading ?? true);
      }

      await fetchProfileData({ freshTopArtists: true });
    };

    init();
  }, [authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !user) {
        return;
      }

      fetchProfileData();
    }, [authLoading, user?.id])
  );

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`profile_now_playing_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listening_activity',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const activity = payload.new as any;
          if (!activity) {
            return;
          }

          if (activity.is_playing) {
            setNowPlaying({
              track_name: activity.track_name,
              artist_name: activity.artist_name,
              album_name: activity.album_name,
              album_art_url: activity.album_art_url,
              is_playing: true,
            });
            return;
          }

          setNowPlaying({
            track_name: activity.track_name,
            artist_name: activity.artist_name,
            album_name: activity.album_name,
            album_art_url: activity.album_art_url,
            is_playing: false,
          });
          setRecentTracks((prev) =>
            dedupeRecentTracks([activity, ...prev]).slice(0, 10)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(avatarOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    saveProfileScreenCache({
      spotifyConnected,
      nowPlaying,
      recentTracks,
      topArtists,
      topTracks,
      recommendedTracks,
      friends,
      stats,
      statsLoading,
    });
  }, [spotifyConnected, nowPlaying, recentTracks, topArtists, topTracks, recommendedTracks, friends, stats, statsLoading]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const selectedArtistPerk = lockedArtistRank ? getArtistPerkKey(lockedArtistRank) : null;
  const selectedArtistInviteURL =
    lockedArtistRank && selectedArtistPerk && status?.referral_code
      ? Linking.createURL('/(auth)/login', {
          queryParams: {
            referral_code: status.referral_code,
            perk_key: selectedArtistPerk,
          },
        })
      : '';

  const handleShareLockedArtist = async () => {
    if (!lockedArtistRank || !selectedArtistPerk || !selectedArtistInviteURL) {
      Alert.alert('Invite unavailable', 'Refresh your profile and try again.');
      return;
    }

    try {
      await Share.share({
        message: `Join Chen with my invite and finish onboarding so I can unlock Top Artist #${lockedArtistRank}. ${selectedArtistInviteURL}`,
      });
    } catch (error) {
      console.error('Profile: Failed to share locked artist invite', error);
      Alert.alert('Share failed', 'Could not open the share sheet right now.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Warm blurred top section */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop' }}
        style={{ position: 'absolute', width: '100%', height: 300, top: 0 }}
        blurRadius={30}
      />
      <LinearGradient
        colors={[Colors.bgHeroFrom, Colors.overlaySoft, Colors.bg]}
        style={{ position: 'absolute', width: '100%', height: 300, top: 0 }}
      />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 }}>
        <Pressable style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong }}>
          <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} />
        </Pressable>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 2.5, textTransform: 'uppercase' }}>Profile</Text>
        <Pressable onPress={() => router.push('/settings')} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderStrong }}>
          <IconSymbol name="gearshape" size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* Hero */}
        <FadeSlide delay={0}>
          <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 28, paddingHorizontal: 20 }}>
            <Animated.View style={{ position: 'absolute', top: 6, width: 140, height: 140, borderRadius: 70, backgroundColor: Colors.bgHeroFrom, opacity: glowOpacity }} />
            <Animated.View style={{ opacity: avatarOpacity, transform: [{ scale: avatarScale }], marginBottom: 16 }}>
              <Image
                source={{ uri: currentUser.getAvatarUri(120) }}
                style={{ width: 110, height: 110, borderRadius: 55, borderWidth: 2.5, borderColor: Colors.orange }}
              />
            </Animated.View>
            <Text style={{ color: Colors.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 }}>
              {currentUser.username}
            </Text>
            {currentUser.hasUserTag && (
              <Text style={{ color: Colors.orange, fontSize: 13, fontWeight: '600', marginBottom: 4, opacity: 0.8 }}>
                @{currentUser.userTag}
              </Text>
            )}
            <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 20 }}>
              {friends.length > 0 ? `${friends.length} friends` : 'no friends yet'}
            </Text>
            <Pressable onPress={() => setEditProfileVisible(true)} style={{ borderWidth: 1.5, borderColor: Colors.orange, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 9 }}>
              <Text style={{ color: Colors.orange, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }}>Edit Profile</Text>
            </Pressable>
          </View>
        </FadeSlide>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>

          {/* Now Playing */}
          <FadeSlide delay={100}>
            <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderStrong }}>
              <LinearGradient colors={[Colors.bgHeroFrom, Colors.bgHeroTo, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <SectionLabel>{playbackLabel}</SectionLabel>
                  {isNowPlayingLive && <LiveDot />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {hasImageURI(featuredPlayback?.album_art_url) ? (
                    <Image source={{ uri: featuredPlayback.album_art_url }} style={{ width: 70, height: 70, borderRadius: 14, marginRight: 14 }} />
                  ) : (
                    <View style={{ width: 70, height: 70, borderRadius: 14, marginRight: 14, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 24 }}>♪</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                      {featuredPlayback?.track_name || (recentTracks[0]?.track_name || "Nothing's playing rn")}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                      {featuredPlayback?.artist_name || (recentTracks[0]?.artist_name || "and no one's singing either")}
                    </Text>
                  </View>
                  {isNowPlayingLive && <EqualizerBars />}
                </View>
              </LinearGradient>
            </View>
          </FadeSlide>

          {/* Spotify Status */}
          <FadeSlide delay={160}>
            <SpotifyStatusCard
              connected={spotifyConnected}
              loading={spotifyConnected === null}
              onReconnect={handleReconnectSpotify}
            />
          </FadeSlide>

          {/* Stats */}
          <FadeSlide delay={220}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { value: stats.minutesListened > 0 ? stats.minutesListened.toLocaleString() : '--', label: 'min this week' },
                { value: stats.artistsPlayed > 0 ? stats.artistsPlayed.toString() : '--', label: 'artists played' },
                { value: stats.topGenre || '--', label: 'top genre' },
              ].map((stat, i) => (
                <Card key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 }}>
                  {stat.value === '--' && statsLoading ? (
                    <View style={{ height: 30, justifyContent: 'center', marginBottom: 4 }}>
                      <ActivityIndicator size="small" color={Colors.orange} />
                    </View>
                  ) : (
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ color: Colors.orange, fontSize: 22, fontWeight: '800', marginBottom: 4, width: '100%', textAlign: 'center' }}>
                      {stat.value}
                    </Text>
                  )}
                  <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center' }}>{stat.label}</Text>
                </Card>
              ))}
            </View>
          </FadeSlide>

          {/* Top Artists */}
          <FadeSlide delay={280}>
            <View>
              <SectionLabel>Top Artists</SectionLabel>
              {topArtists.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                  {[1, 2, 3, 4, 5].map((rank) => {
                    const artist = topArtists[rank - 1];
                    const unlocked = isTopArtistUnlocked(rank);

                    if (!unlocked) {
                      return (
                        <Pressable
                          key={rank}
                          onPress={() => setLockedArtistRank(rank)}
                        style={{
                          width: 120,
                          height: 130,
                            borderRadius: 18,
                            overflow: 'hidden',
                          marginHorizontal: 5,
                          borderWidth: 1,
                          borderColor: Colors.borderStrong,
                          backgroundColor: Colors.surfaceSoft,
                        }}
                      >
                        <LinearGradient
                          colors={[Colors.bgHeroFrom, Colors.surfaceMuted, Colors.surfaceSoft]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                          />

                          <View
                            style={{
                              position: 'absolute',
                              top: -30,
                              right: -22,
                              width: 92,
                              height: 92,
                              borderRadius: 46,
                              backgroundColor: Colors.accentSurface,
                            }}
                          />

                          <View
                            style={{
                              position: 'absolute',
                              bottom: -28,
                              left: -14,
                              width: 82,
                              height: 82,
                              borderRadius: 41,
                              backgroundColor: Colors.surfaceSoft,
                            }}
                          />

                          <View
                            style={{
                              position: 'absolute',
                              top: 16,
                              left: 16,
                              right: 16,
                              bottom: 16,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: Colors.surfaceStrong,
                            }}
                          />

                          <View
                            style={{
                              flex: 1,
                              alignItems: 'center',
                              justifyContent: 'center',
                              paddingHorizontal: 12,
                            }}
                          >
                            <View
                              style={{
                                width: 86,
                                height: 86,
                                borderRadius: 43,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: Colors.surfaceMuted,
                                borderWidth: 1,
                                borderColor: Colors.borderStrong,
                                shadowColor: Colors.orange,
                                shadowOpacity: 0.16,
                                shadowRadius: 18,
                                shadowOffset: { width: 0, height: 8 },
                              }}
                            >
                              <View
                                style={{
                                  position: 'absolute',
                                  width: 54,
                                  height: 54,
                                  borderRadius: 27,
                                  backgroundColor: Colors.accentSurface,
                                }}
                              />
                              <IconSymbol name="lock.fill" size={36} color={Colors.orange} />
                              <Text style={{ position: 'absolute', bottom: 6, right: 8, color: Colors.accentSecondary, fontSize: 26, fontWeight: '900', lineHeight: 28 }}>{rank}</Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    }

                    return (
                      <Pressable key={rank} style={{ width: 120, height: 130, borderRadius: 18, overflow: 'hidden', marginHorizontal: 5, borderWidth: 1, borderColor: Colors.border }}>
                        {hasImageURI(artist?.images?.[0]?.url) ? (
                          <Image source={{ uri: artist.images[0].url }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
                        ) : (
                          <View style={{ width: '100%', height: '100%', position: 'absolute', backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 24, marginBottom: 8 }}>♪</Text>
                            <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center' }}>Still shaping this slot</Text>
                          </View>
                        )}
                        <LinearGradient colors={['transparent', Colors.overlay]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 30 }}>
                          <Text numberOfLines={1} style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                            {artist?.name || `Top Artist #${rank}`}
                          </Text>
                        </LinearGradient>
                        <Text style={{ position: 'absolute', bottom: 6, right: 8, color: Colors.accentSecondary, fontSize: 26, fontWeight: '900', lineHeight: 28 }}>{rank}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={{ height: 130, borderRadius: 18, backgroundColor: Colors.surfaceSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Connect Spotify to see your top artists</Text>
                </View>
              )}
            </View>
          </FadeSlide>

          {/* Top Tracks */}
          <FadeSlide delay={340}>
            <Card>
              <SectionLabel>Top Tracks</SectionLabel>
              {topTracks.length > 0 ? topTracks.slice(0, 3).map((track, i) => (
                <Pressable key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: Colors.surfaceStrong }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700', width: 20, marginRight: 10 }}>{i + 1}</Text>
                  {hasImageURI(track.imageUrl || track.image_url || track.album_art_url) ? (
                    <Image source={{ uri: track.imageUrl || track.image_url || track.album_art_url }} style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12 }} />
                  ) : (
                    <View style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: Colors.textMuted, fontSize: 18 }}>♪</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>{track.name}</Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>{track.artist}</Text>
                  </View>
                  <IconSymbol name="play.fill" size={14} color={Colors.accentSecondary} />
                </Pressable>
              )) : <EmptyState message="No top tracks yet" />}
            </Card>
          </FadeSlide>

          {/* Recently Played */}
          <FadeSlide delay={400}>
            <View className="pb-6">
              <SectionLabel>Recently Played</SectionLabel>
              {recentTracks.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 2, paddingRight: 14 }}
                >
                  {recentTracks.map((track, i) => (
                    <Pressable
                      key={i}
                      style={{
                        width: 112,
                        marginRight: 12,
                      }}
                    >
                      {hasImageURI(track.album_art_url) ? (
                        <Image
                          source={{ uri: track.album_art_url }}
                          style={{
                            width: 112,
                            height: 120,
                            borderRadius: 7,
                            borderWidth: 1,
                            borderColor: Colors.borderStrong,
                            marginBottom: 10,
                          }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 112,
                            height: 120,
                            borderRadius: 7,
                            borderWidth: 1,
                            borderColor: Colors.borderStrong,
                            marginBottom: 10,
                            backgroundColor: Colors.surfaceMuted,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: Colors.textMuted, fontSize: 24 }}>♪</Text>
                        </View>
                      )}
                      <Text
                        numberOfLines={3}
                        style={{
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: '700',
                          lineHeight: 16,
                          marginBottom: 4,
                          minHeight: 32,
                        }}
                      >
                        {track.track_name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: Colors.orange,
                          fontSize: 11,
                          fontWeight: '600'
                        }}
                      >
                        {track.artist_name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={{ height: 126, borderRadius: 20, backgroundColor: Colors.surfaceSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No recent tracks</Text>
                </View>
              )}
            </View>
          </FadeSlide>

          {/* Recommended Tracks */}
          <FadeSlide delay={460}>
            <View className="pb-6">
              <SectionLabel>Recommended Tracks</SectionLabel>
              {recommendedTracks.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 2, paddingRight: 14 }}
                >
                  {recommendedTracks.slice(0, 6).map((track, i) => (
                    <Pressable
                      key={i}
                      style={{
                        width: 144,
                        marginRight: 12,
                      }}
                    >
                      <View style={{ position: 'relative', borderRadius: 24, overflow: 'hidden' }}>
                        {hasImageURI(track.album_art) ? (
                          <Image
                            source={{ uri: track.album_art }}
                            style={{ width: '100%', height: 138 }}
                          />
                        ) : (
                          <View style={{ width: '100%', height: 138, backgroundColor: Colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: Colors.textMuted, fontSize: 24 }}>♪</Text>
                          </View>
                        )}
                        <LinearGradient
                          colors={['transparent', Colors.overlay]}
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 70,
                          }}
                        />
                        <View
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: Colors.overlaySoft,
                            borderWidth: 1,
                            borderColor: Colors.surfaceStrong,
                          }}
                        >
                          <Text style={{ color: Colors.orange, fontSize: 10, fontWeight: '700' }}>
                            #{i + 1}
                          </Text>
                        </View>
                      </View>

                      <Text
                        numberOfLines={2}
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 13,
                          fontWeight: '700',
                          lineHeight: 17,
                          minHeight: 34,
                          marginTop: 10,
                          marginBottom: 4,
                        }}
                      >
                        {track.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          color: Colors.orange,
                          fontSize: 11,
                          fontWeight: '600',
                        }}
                      >
                        {track.artist}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : (
                <View style={{ height: 126, borderRadius: 20, backgroundColor: Colors.surfaceSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>No recommendations yet</Text>
                </View>
              )}
            </View>
          </FadeSlide>

          {/* Taste Network */}
          <FadeSlide delay={520}>
            <Card>
              <SectionLabel>Taste Network</SectionLabel>
              {friends.length > 0 ? friends.map((friend, i) => (
                <Pressable key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: i < friends.length - 1 ? 1 : 0, borderBottomColor: Colors.surfaceStrong }}>
                  <Image source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${friend.avatar_id}&size=50&backgroundColor=0D0B09` }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12, borderWidth: 1.5, borderColor: Colors.borderStrong }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{friend.username}</Text>
                  </View>
                  <View style={{ backgroundColor: Colors.accentSurface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.borderStrong }}>
                    <Text style={{ color: Colors.orange, fontSize: 13, fontWeight: '700' }}>{friend.compatibility}%</Text>
                  </View>
                </Pressable>
              )) : <EmptyState message="Add friends to see your taste network" />}
            </Card>
          </FadeSlide>

          {/* Sign Out */}
          <FadeSlide delay={580}>
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Pressable onPress={handleSignOut} style={{ backgroundColor: 'rgba(231,76,60,0.08)', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(231,76,60,0.18)', alignItems: 'center' }}>
                <Text style={{ color: '#E74C3C', fontSize: 16, fontWeight: '600' }}>Sign Out</Text>
              </Pressable>
            </View>
          </FadeSlide>

        </View>
      </ScrollView>

      <Modal
        visible={lockedArtistRank !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLockedArtistRank(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: Colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 22,
          }}
        >
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setLockedArtistRank(null)}
          />

          <View
            style={{
              width: '100%',
              maxWidth: 360,
              borderRadius: 28,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: Colors.borderStrong,
              backgroundColor: Colors.bgElevated,
            }}
          >
            <LinearGradient
              colors={[Colors.bgHeroFrom, Colors.surfaceMuted, Colors.surfaceSoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ padding: 22 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: Colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: Colors.borderStrong,
                  }}
                >
                  <IconSymbol name="lock.fill" size={24} color={Colors.orange} />
                </View>

                <Pressable
                  onPress={() => setLockedArtistRank(null)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: Colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: Colors.surfaceStrong,
                  }}
                >
                  <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '700' }}>×</Text>
                </Pressable>
              </View>

              <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 8 }}>
                Unlock Top Artist #{lockedArtistRank}
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 18 }}>
                Share this exact invite link. Once someone signs up from it and finishes onboarding, this artist slot unlocks for you.
              </Text>

              <View
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: Colors.surfaceSoft,
                  borderWidth: 1,
                  borderColor: Colors.surfaceStrong,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 }}>
                  SHARE LINK
                </Text>
                <Text selectable style={{ color: Colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
                  {selectedArtistInviteURL || 'Invite link will appear once your referral code is ready.'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setLockedArtistRank(null)}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: 'center',
                    backgroundColor: Colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: Colors.surfaceStrong,
                  }}
                >
                  <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                    Not now
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleShareLockedArtist}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    paddingVertical: 14,
                    alignItems: 'center',
                    backgroundColor: Colors.orange,
                    borderWidth: 1,
                    borderColor: Colors.surfaceStrong,
                    shadowColor: Colors.orange,
                    shadowOpacity: 0.25,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 8 },
                  }}
                >
                  <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '800' }}>
                    Share link
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        onProfileUpdated={async () => { await refreshProfile(); fetchProfileData(); }}
      />
    </View>
  );
}

function deriveTopGenreFromArtists(artists: SpotifyArtist[]) {
  const genreCounts: Record<string, number> = {};
  let topGenre = '';
  let topCount = 0;

  for (const artist of artists) {
    for (const genre of artist.genres || []) {
      const normalized = genre.trim().toLowerCase();
      if (!normalized) {
        continue;
      }

      genreCounts[normalized] = (genreCounts[normalized] || 0) + 1;
      if (genreCounts[normalized] > topCount) {
        topCount = genreCounts[normalized];
        topGenre = genre;
      }
    }
  }

  return topGenre;
}

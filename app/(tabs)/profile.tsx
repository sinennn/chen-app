import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native';

const mockUserData = {
  username: 'alex.wav',
  bio: 'Late-night electronic + indie',
  friendCount: 24,
  avatar: 'https://api.dicebear.com/7.x/adventurer/png?seed=user&size=120&backgroundColor=0D0B09',
  nowPlaying: {
    track: 'Nights',
    artist: 'Frank Ocean',
    albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop',
    isPlaying: true,
  },
  weeklyStats: {
    minutesListened: 1482,
    artistsPlayed: 63,
    topGenre: 'Alternative',
  },
  topArtists: [
    { name: 'Frank Ocean', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop' },
    { name: 'Bicep', image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=200&h=200&fit=crop' },
    { name: 'Phoebe Bridgers', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop' },
    { name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop' },
  ],
  topTracks: [
    { track: 'Nights', artist: 'Frank Ocean', albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop' },
    { track: 'Glue', artist: 'Bicep', albumArt: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=60&h=60&fit=crop' },
    { track: 'Motion Sickness', artist: 'Phoebe Bridgers', albumArt: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=60&h=60&fit=crop' },
  ],
  recentlyPlayed: [
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1571974599782-87624638275c?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1571974599782-87624638275c?w=80&h=80&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=80&h=80&fit=crop',
  ],
  onRepeat: [
    { track: 'Blinding Lights', artist: 'The Weeknd', albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop' },
    { track: 'Pink + White', artist: 'Frank Ocean', albumArt: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=100&h=100&fit=crop' },
    { track: 'Apricots', artist: 'Bicep', albumArt: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100&h=100&fit=crop' },
  ],
  tasteNetwork: [
    { username: 'sarah_beats', avatar: 'https://api.dicebear.com/7.x/adventurer/png?seed=sarah&size=50', compatibility: 92 },
    { username: 'mike_vibes', avatar: 'https://api.dicebear.com/7.x/adventurer/png?seed=mike&size=50', compatibility: 88 },
    { username: 'luna.music', avatar: 'https://api.dicebear.com/7.x/adventurer/png?seed=luna&size=50', compatibility: 85 },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <View
        style={{
          width: 3,
          height: 16,
          backgroundColor: Colors.orange,
          borderRadius: 2,
          marginRight: 8,
        }}
      />
      <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>
        {children}
      </Text>
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

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
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
            Animated.timing(bar, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 250 + Math.random() * 200,
              useNativeDriver: false,
            }),
            Animated.timing(bar, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 250 + Math.random() * 200,
              useNativeDriver: false,
            }),
          ])
        )
      ).start(() => animate());
    };
    animate();
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3,
            height: bar.interpolate({ inputRange: [0, 1], outputRange: [4, 18] }),
            backgroundColor: Colors.orange,
            borderRadius: 2,
          }}
        />
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

  return (
    <Animated.View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: Colors.orange,
        marginLeft: 7,
        opacity: pulse,
        alignSelf: 'center',
      }}
    />
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const avatarScale = useRef(new Animated.Value(0.85)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: () => signOut()
        }
      ]
    );
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 60,
          paddingBottom: 8,
        }}
      >
        <Pressable
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(232, 100, 10, 0.15)',
          }}
        >
          <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} />
        </Pressable>

        <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Profile
        </Text>

        <Pressable
          onPress={() => router.push('/settings')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(232, 100, 10, 0.15)',
          }}
        >
          <IconSymbol name="gearshape" size={16} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Hero ── */}
        <FadeSlide delay={0}>
          <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 32, paddingHorizontal: 20 }}>
            {/* Glow */}
            <Animated.View
              style={{
                position: 'absolute',
                top: 14,
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: 'rgba(232, 100, 10, 0.18)',
                opacity: glowOpacity,
              }}
            />

            {/* Avatar */}
            <Animated.View
              style={{
                opacity: avatarOpacity,
                transform: [{ scale: avatarScale }],
                marginBottom: 18,
              }}
            >
              <Image
                source={{ uri: mockUserData.avatar }}
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  borderWidth: 2.5,
                  borderColor: Colors.orange,
                }}
              />
            </Animated.View>

            <Text style={{ color: Colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 }}>
              {user?.user_metadata?.full_name || user?.email || mockUserData.username}
            </Text>

            <Text style={{ color: Colors.textSecondary, fontSize: 14, marginBottom: 10, textAlign: 'center' }}>
              {mockUserData.bio}
            </Text>

            <Text style={{ color: Colors.textMuted, fontSize: 13, marginBottom: 22 }}>
              {mockUserData.friendCount} friends
            </Text>

            {/* Edit Profile — orange outline */}
            <Pressable
              style={{
                borderWidth: 1.5,
                borderColor: Colors.orange,
                borderRadius: 24,
                paddingHorizontal: 32,
                paddingVertical: 9,
              }}
            >
              <Text style={{ color: Colors.orange, fontSize: 14, fontWeight: '600', letterSpacing: 0.3 }}>
                Edit Profile
              </Text>
            </Pressable>
          </View>
        </FadeSlide>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>

          {/* ── Now Playing ── */}
          <FadeSlide delay={100}>
            <View
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(232, 100, 10, 0.2)',
              }}
            >
              <LinearGradient
                colors={['rgba(232, 100, 10, 0.18)', 'rgba(232, 100, 10, 0.04)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                  <SectionLabel>Now Playing</SectionLabel>
                  <LiveDot />
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={{ uri: mockUserData.nowPlaying.albumArt }}
                    style={{ width: 70, height: 70, borderRadius: 14, marginRight: 14 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                      {mockUserData.nowPlaying.track}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 14 }}>
                      {mockUserData.nowPlaying.artist}
                    </Text>
                  </View>
                  <EqualizerBars />
                </View>
              </LinearGradient>
            </View>
          </FadeSlide>

          {/* ── Stats ── */}
          <FadeSlide delay={180}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { value: '1,482', label: 'min this week' },
                { value: '63', label: 'artists played' },
                { value: mockUserData.weeklyStats.topGenre, label: 'top genre' },
              ].map((stat, i) => (
                <Card key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    style={{ color: Colors.orange, fontSize: 22, fontWeight: '800', marginBottom: 4, width: '100%', textAlign: 'center' }}
                  >
                    {stat.value}
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center' }}>
                    {stat.label}
                  </Text>
                </Card>
              ))}
            </View>
          </FadeSlide>

          {/* ── Top Artists ── */}
          <FadeSlide delay={260}>
            <View>
              <SectionLabel>Top Artists</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {mockUserData.topArtists.map((artist, i) => (
                  <Pressable
                    key={i}
                    style={{
                      width: 120,
                      height: 130,
                      borderRadius: 18,
                      overflow: 'hidden',
                      marginHorizontal: 5,
                      borderWidth: 1,
                      borderColor: 'rgba(232, 100, 10, 0.1)',
                    }}
                  >
                    <Image
                      source={{ uri: artist.image }}
                      style={{ width: '100%', height: '100%', position: 'absolute' }}
                    />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.75)']}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        paddingHorizontal: 10,
                        paddingBottom: 10,
                        paddingTop: 30,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700' }}
                      >
                        {artist.name}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </FadeSlide>

          {/* ── Top Tracks ── */}
          <FadeSlide delay={340}>
            <Card>
              <SectionLabel>Top Tracks</SectionLabel>
              {mockUserData.topTracks.map((track, i) => (
                <Pressable
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 11,
                    borderBottomWidth: i < mockUserData.topTracks.length - 1 ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text style={{ color: Colors.textMuted, fontSize: 13, fontWeight: '700', width: 20, marginRight: 10 }}>
                    {i + 1}
                  </Text>
                  <Image
                    source={{ uri: track.albumArt }}
                    style={{ width: 46, height: 46, borderRadius: 10, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                      {track.track}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                      {track.artist}
                    </Text>
                  </View>
                  <IconSymbol name="play.fill" size={14} color="rgba(232,100,10,0.5)" />
                </Pressable>
              ))}
            </Card>
          </FadeSlide>

          {/* ── Recently Played ── */}
          <FadeSlide delay={400}>
            <View>
              <SectionLabel>Recently Played</SectionLabel>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {mockUserData.recentlyPlayed.map((art, i) => (
                  <Pressable key={i} style={{ marginHorizontal: 5 }}>
                    <Image
                      source={{ uri: art }}
                      style={{
                        width: 78,
                        height: 78,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(232,100,10,0.1)',
                      }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </FadeSlide>

          {/* ── On Repeat ── */}
          <FadeSlide delay={460}>
            <View>
              <SectionLabel>On Repeat</SectionLabel>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {mockUserData.onRepeat.map((track, i) => (
                  <Card key={i} style={{ flex: 1, alignItems: 'center', padding: 12 }}>
                    <Image
                      source={{ uri: track.albumArt }}
                      style={{ width: 56, height: 56, borderRadius: 12, marginBottom: 10 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{ color: Colors.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 2 }}
                    >
                      {track.track}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: Colors.textMuted, fontSize: 10, textAlign: 'center' }}
                    >
                      {track.artist}
                    </Text>
                  </Card>
                ))}
              </View>
            </View>
          </FadeSlide>

          {/* ── Taste Network ── */}
          <FadeSlide delay={520}>
            <Card>
              <SectionLabel>Taste Network</SectionLabel>
              {mockUserData.tasteNetwork.map((friend, i) => (
                <Pressable
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 11,
                    borderBottomWidth: i < mockUserData.tasteNetwork.length - 1 ? 1 : 0,
                    borderBottomColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Image
                    source={{ uri: friend.avatar }}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      marginRight: 12,
                      borderWidth: 1.5,
                      borderColor: 'rgba(232,100,10,0.3)',
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                      {friend.username}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: 'rgba(232,100,10,0.12)',
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderWidth: 1,
                      borderColor: 'rgba(232,100,10,0.25)',
                    }}
                  >
                    <Text style={{ color: Colors.orange, fontSize: 13, fontWeight: '700' }}>
                      {friend.compatibility}%
                    </Text>
                  </View>
                </Pressable>
              ))}
            </Card>
          </FadeSlide>

          {/* Sign Out Button */}
          <FadeSlide delay={580}>
            <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
              <Pressable
                onPress={handleSignOut}
                style={{
                  backgroundColor: 'rgba(231, 76, 60, 0.1)',
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(231, 76, 60, 0.2)',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#E74C3C', fontSize: 16, fontWeight: '600' }}>
                  Sign Out
                </Text>
              </Pressable>
            </View>
          </FadeSlide>

        </View>
      </ScrollView>
    </View>
  );
}
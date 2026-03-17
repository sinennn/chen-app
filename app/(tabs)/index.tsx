import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Mock data for demonstration
const mockFeedData = [
  {
    id: '1',
    username: 'alex_music',
    profilePicture: 'https://api.dicebear.com/7.x/avataaars/png?seed=alex&size=40',
    timestamp: '2m ago',
    albumArt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
    trackName: 'Blinding Lights',
    artistName: 'The Weeknd',
    likes: 24,
    isPlaying: true
  },
  {
    id: '2',
    username: 'sarah_beats',
    profilePicture: 'https://api.dicebear.com/7.x/avataaars/png?seed=sarah&size=40',
    timestamp: '5m ago',
    albumArt: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=300&h=300&fit=crop',
    trackName: 'Good 4 U',
    artistName: 'Olivia Rodrigo',
    likes: 18,
    isPlaying: false
  },
  {
    id: '3',
    username: 'mike_vibes',
    profilePicture: 'https://api.dicebear.com/7.x/avataaars/png?seed=mike&size=40',
    timestamp: '12m ago',
    albumArt: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop',
    trackName: 'Levitating',
    artistName: 'Dua Lipa',
    likes: 31,
    isPlaying: false
  }
];

function FeedCard({ item, index }: { item: any; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;

  const lastTap = useRef<number | null>(null);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes);

  const contextOptions = [
    "is obsessed with",
    "discovered",
    "can't stop playing",
    "has on repeat",
  ];

  const context =
    contextOptions[index % contextOptions.length];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: index * 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: index * 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const triggerHeart = () => {
    Animated.sequence([
      Animated.timing(heartAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDoubleTap = () => {
    const now = Date.now();

    if (lastTap.current && now - lastTap.current < 300) {
      setLiked(true);
      setLikeCount((prev: number) => prev + 1);
      triggerHeart();
    }

    lastTap.current = now;
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        marginBottom: 22,
      }}
    >
      <Pressable onPress={handleDoubleTap}>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.07)",
            borderRadius: 26,
            padding: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 25,
          }}
        >
          {/* TOP ROW */}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Image
              source={{ uri: item.profilePicture }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                marginRight: 10,
              }}
            />

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: Colors.textPrimary,
                  fontWeight: "600",
                  fontSize: 15,
                }}
              >
                {item.username}
              </Text>

              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                }}
              >
                {context}
              </Text>
            </View>

            {item.isPlaying && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 12,
                  backgroundColor: "#1DB954",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "600" }}>
                  LIVE
                </Text>
              </View>
            )}

            <Text
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                marginLeft: 10,
              }}
            >
              {item.timestamp}
            </Text>
          </View>

          {/* SONG */}

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
              }}
            >
              <Image
                source={{ uri: item.albumArt }}
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 16,
                  marginRight: 16,
                }}
              />
            </Animated.View>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: Colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "700",
                }}
                numberOfLines={1}
              >
                {item.trackName}
              </Text>

              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 14,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {item.artistName}
              </Text>
            </View>
          </View>

          {/* ACTION ROW */}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                gap: 18,
                alignItems: "center",
              }}
            >
              <Pressable
                onPress={() => {
                  setLiked(!liked);
                  setLikeCount((prev: number) =>
                    liked ? prev - 1 : prev + 1
                  );
                }}
              >
                <Text style={{ fontSize: 18 }}>
                  {liked ? "🧡" : "🤍"} {likeCount}
                </Text>
              </Pressable>

              <Pressable>
                <Text style={{ fontSize: 18 }}>🔥</Text>
              </Pressable>

              <Pressable>
                <Text style={{ fontSize: 18 }}>🎧</Text>
              </Pressable>
            </View>

            <IconSymbol
              name="bubble.right"
              size={20}
              color="rgba(255,255,255,0.6)"
            />
          </View>

          {/* FLOATING HEART */}

          <Animated.Text
            style={{
              position: "absolute",
              top: 40,
              alignSelf: "center",
              fontSize: 80,
              opacity: heartAnim,
              transform: [
                {
                  translateY: heartAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, -60],
                  }),
                },
                {
                  scale: heartAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1],
                  }),
                },
              ],
            }}
          >
            💜
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 1000);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Background */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop' }}
        style={{ flex: 1 }}
        blurRadius={20}
      >
        <LinearGradient
          colors={['rgba(0, 1, 6, 0.7)', 'rgba(0, 1, 6, 0.9)', 'rgba(0, 1, 6, 0.95)']}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 60,
              paddingBottom: 20,
            }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: '700',
                color: Colors.textPrimary,
              }}
            >
              Feed
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Pressable
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <IconSymbol name="bell" size={20} color={Colors.textPrimary} />
              </Pressable>

              <Image
                source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=user&size=40' }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 2,
                  borderColor: Colors.orange,
                }}
              />
            </View>
          </View>

          {/* Feed Content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              [...Array(3)].map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: 120,
                    borderRadius: 24,
                    backgroundColor: "rgba(255,255,255,0.06)",
                    marginBottom: 20,
                  }}
                />
              ))
            ) : (
              mockFeedData.map((item, index) => (
                <FeedCard key={item.id} item={item} index={index} />
              ))
            )}
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}


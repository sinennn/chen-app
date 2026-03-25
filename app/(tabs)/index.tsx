//@ts-nocheck
import { CommentModal } from '@/components/comment-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityItem, api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from 'react-native';
import { WebView } from 'react-native-webview';

const { width: screenWidth } = Dimensions.get('window');

type ReactionType = 'love' | 'fire' | 'headphones';

type FeedEngagement = {
  commentCount: number;
  reactions: Record<ReactionType, number>;
  userReactions: Record<ReactionType, boolean>;
};

function isRenderableFeedItem(item: ActivityItem | null | undefined) {
  if (!item) {
    return false;
  }

  const trackName = item.track_name?.trim();
  const artistName = item.artist_name?.trim();
  const albumName = item.album_name?.trim();
  const albumArtURL = item.album_art_url?.trim();

  return !!(trackName || artistName || albumName || albumArtURL);
}

function getSpotifyTrackID(item: Pick<ActivityItem, 'track_id' | 'spotify_url'> | null | undefined) {
  const directID = item?.track_id?.trim();
  if (directID) {
    return directID;
  }

  const spotifyURL = item?.spotify_url?.trim();
  if (!spotifyURL) {
    return '';
  }

  const match = spotifyURL.match(/track\/([A-Za-z0-9]+)/);
  return match?.[1] || '';
}

function buildSpotifyEmbedHTML(trackID: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #0b0b0b;
        overflow: hidden;
      }
      #embed-iframe {
        width: 100%;
        min-height: 232px;
      }
    </style>
  </head>
  <body>
    <div id="embed-iframe"></div>
    <script src="https://open.spotify.com/embed/iframe-api/v1" async></script>
    <script>
      window.onSpotifyIframeApiReady = function(IFrameAPI) {
        var element = document.getElementById('embed-iframe');
        var options = {
          uri: 'spotify:track:${trackID}',
          width: '100%',
          height: '232',
          theme: 0
        };
        IFrameAPI.createController(element, options, function() {});
      };
    </script>
  </body>
</html>`;
}

function SpotifyPreviewModal({
  item,
  visible,
  onClose,
}: {
  item: ActivityItem | null;
  visible: boolean;
  onClose: () => void;
}) {
  const trackID = getSpotifyTrackID(item);

  if (!visible || !item || !trackID) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.76)',
          justifyContent: 'center',
          paddingHorizontal: 18,
        }}
      >
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={onClose} />

        <View
          style={{
            borderRadius: 30,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 16 },
          }}
        >
          <LinearGradient
            colors={['rgba(31, 31, 31, 0.98)', 'rgba(12, 12, 12, 0.98)', 'rgba(8, 8, 8, 1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 18,
              position: 'relative',
            }}
          >
            {/* Decorative blobs — orange tint */}
            <View
              style={{
                position: 'absolute',
                width: 180,
                height: 180,
                borderRadius: 999,
                backgroundColor: 'rgba(232,100,10,0.12)',
                top: -70,
                right: -40,
              }}
            />
            <View
              style={{
                position: 'absolute',
                width: 130,
                height: 130,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.05)',
                bottom: -45,
                left: -35,
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              </View>

              <Pressable
                onPress={onClose}
                hitSlop={8}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }}>×</Text>
              </Pressable>
            </View>

            <View
              style={{
                height: 232,
                borderRadius: 22,
                overflow: 'hidden',
                backgroundColor: '#121212',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <WebView
                originWhitelist={['*']}
                source={{ html: buildSpotifyEmbedHTML(trackID) }}
                style={{ flex: 1, backgroundColor: '#121212' }}
                javaScriptEnabled
                scrollEnabled={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 14,
              }}
            >
              <Text style={{ color: 'rgba(18, 16, 16, 0.42)', fontSize: 11, fontWeight: '600' }}>
               
              </Text>

              
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

function FeedCard({
  item,
  index,
  engagement,
  onCommentPress,
  onToggleReaction,
  onAvatarPress,
  onOpenSpotifyPress,
  onPreviewPress,
}: {
  item: ActivityItem;
  index: number;
  engagement?: FeedEngagement;
  onCommentPress: (item: ActivityItem) => void;
  onToggleReaction: (activityId: string, reactionType: ReactionType) => void;
  onAvatarPress: (item: ActivityItem) => void;
  onOpenSpotifyPress: (item: ActivityItem) => void;
  onPreviewPress: (item: ActivityItem) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;

  const lastTap = useRef<number | null>(null);

  const contextOptions = [
    "is obsessed with",
    "discovered",
    "can't stop playing",
    "has on repeat",
  ];

  const context = contextOptions[index % contextOptions.length];

  // Fallback values for missing user data
  const displayUsername = item.username || "Unknown User";
  const displayAvatarId = item.avatar_id || "default";

  // Format timestamp as "Xm ago"
  const getDiffMins = (timestamp?: string) => {
    if (!timestamp) return 0;
    const now = new Date();
    const startedAt = new Date(timestamp);
    const diffMs = now.getTime() - startedAt.getTime();
    return Math.floor(diffMs / (1000 * 60));
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'now';
    const diffMins = getDiffMins(timestamp);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

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
      onToggleReaction(item.id, 'love');
      triggerHeart();
    }

    lastTap.current = now;
  };

  const reactions = engagement?.reactions || { love: 0, fire: 0, headphones: 0 };
  const userReactions = engagement?.userReactions || { love: false, fire: false, headphones: false };
  const commentCount = engagement?.commentCount || 0;
  const activityTimestamp = item.played_at || item.started_at;
  const isLive = item.is_playing && getDiffMins(activityTimestamp) < 1;
  const hasPreview = !!getSpotifyTrackID(item);
  const hasAlbumArt = !!item.album_art_url?.trim();

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
            <Pressable onPress={() => onAvatarPress(item)} hitSlop={8}>
              <Image
                source={{ 
                  uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${displayAvatarId}&size=40&backgroundColor=0D0B09`
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  marginRight: 10,
                }}
              />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Pressable onPress={() => onAvatarPress(item)} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
                <Text
                  style={{
                    color: Colors.textPrimary,
                    fontWeight: "600",
                    fontSize: 15,
                  }}
                >
                  {displayUsername}
                </Text>
              </Pressable>

              <Text
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 12,
                }}
              >
                {context}
              </Text>
            </View>

            {isLive && (
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
              {formatTimestamp(activityTimestamp)}
            </Text>
          </View>

          {/* SONG */}
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Animated.View
              style={{
                transform: [{ scale: scaleAnim }],
              }}
            >
              {hasAlbumArt ? (
                <Image
                  source={{ uri: item.album_art_url }}
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 16,
                    marginRight: 16,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 16,
                    marginRight: 16,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 20, fontWeight: '700' }}>
                    ♪
                  </Text>
                </View>
              )}
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
                {item.track_name}
              </Text>

              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 14,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {item.artist_name}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <Pressable
                  onPress={() => onPreviewPress(item)}
                  disabled={!hasPreview}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: hasPreview ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: hasPreview ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text style={{ color: hasPreview ? Colors.textPrimary : 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: '700' }}>
                    {hasPreview ? '▶' : 'No preview'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => onOpenSpotifyPress(item)}
                  disabled={!item.spotify_url}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.spotify_url ? 'rgba(29,185,84,0.16)' : 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: item.spotify_url ? 'rgba(29,185,84,0.35)' : 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Image
                    source={require('@/assets/onboarding/spotify.png')}
                    style={{
                      width: 16,
                      height: 16,
                      opacity: item.spotify_url ? 1 : 0.35,
                    }}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>
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
                onPress={() => onToggleReaction(item.id, 'love')}
              >
                <Text style={{ fontSize: 18, color: userReactions.love ? Colors.orange : Colors.textPrimary }}>
                  {userReactions.love ? "🧡" : "🤍"} {reactions.love}
                </Text>
              </Pressable>

              <Pressable onPress={() => onToggleReaction(item.id, 'fire')}>
                <Text style={{ fontSize: 18, color: userReactions.fire ? Colors.orange : Colors.textPrimary }}>
                  🔥 {reactions.fire}
                </Text>
              </Pressable>

              <Pressable onPress={() => onToggleReaction(item.id, 'headphones')}>
                <Text style={{ fontSize: 18, color: userReactions.headphones ? Colors.orange : Colors.textPrimary }}>
                  🎧 {reactions.headphones}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => onCommentPress(item)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol
                  name="bubble.right"
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' }}>
                  {commentCount}
                </Text>
              </View>
            </Pressable>
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

function EmptyStateComponent({ onChenPress }: { onChenPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const eqBars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.4))).current;

  useEffect(() => {
    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    // EQ bars
    const delays = [0, 200, 400, 100, 300];
    eqBars.forEach((bar, i) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(delays[i]),
          Animated.timing(bar, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
    });
  }, []);

  const eqHeights = [6, 14, 9, 16, 7];

  return (
    <View style={{
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      position: 'relative',
      overflow: 'hidden',
      paddingTop: 100,
    }}>
      {/* Ambient glow */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(232,100,10,0.13)',
          top: 40,
          alignSelf: 'center',
          transform: [{ scale: pulse }],
        }}
      />

      {/* Glassmorphism icon */}
      <View style={{
        width: 72,
        height: 72,
        marginBottom: 22,
        position: 'relative',
      }}>
        <View style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.13)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {/* Global music icon */}
          <View style={{
            width: 36,
            height: 36,
            position: 'relative',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <View style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: Colors.orange,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{
                color: Colors.orange,
                fontSize: 14,
                fontWeight: '700',
              }}>
                ♪
              </Text>
            </View>
          </View>
        </View>

        {/* Glass inner highlight */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.07)',
        }} />
      </View>

      {/* EQ bars */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 3,
        marginBottom: 24,
        height: 18,
        opacity: 0.45,
      }}>
        {eqBars.map((bar, i) => (
          <Animated.View
            key={i}
            style={{
              width: 3,
              height: eqHeights[i],
              borderRadius: 2,
              backgroundColor: Colors.orange,
              transform: [{ scaleY: bar }],
            }}
          />
        ))}
      </View>

      {/* Title */}
      <Text style={{
        fontSize: 24,
        fontWeight: '800',
        color: Colors.textPrimary,
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 10,
      }}>
        The world is quiet
      </Text>

      {/* Subtitle */}
      <Text style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
      }}>
        No one is listening to music right now…{'\n'}Be the first to share what you&apos;re playing!
      </Text>

      {/* Chen pill */}
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 18,
          paddingVertical: 11,
          borderRadius: 100,
          backgroundColor: 'rgba(232,100,10,0.10)',
          borderWidth: 1,
          borderColor: 'rgba(232,100,10,0.28)',
          overflow: 'hidden',
        }}
        onPress={onChenPress}
      >
        <View style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: 'rgba(232,100,10,0.30)',
          borderWidth: 1,
          borderColor: 'rgba(232,100,10,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{
            color: Colors.orange,
            fontSize: 11,
            fontWeight: '700',
          }}>
            C
          </Text>
        </View>
        <Text style={{
          color: Colors.orange,
          fontSize: 13,
          fontWeight: '600',
          letterSpacing: 0.1,
        }}>
          Ask Chen for something to vibe to 🎧
        </Text>
      </Pressable>
    </View>
  );
}

function SkeletonCard({ index }: { index: number }) {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        marginBottom: 22,
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 26,
          padding: 18,
          height: 140,
        }}
      />
    </Animated.View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { user, profile: authProfile, refreshProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feed, setFeed] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<ActivityItem | null>(null);
  const [engagementByActivity, setEngagementByActivity] = useState<Record<string, FeedEngagement>>({});

  // Update local profile when auth profile changes
  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  const fetchEngagement = async (activityIds: string[]) => {
    if (activityIds.length === 0 || !user?.id) {
      setEngagementByActivity({});
      return;
    }

    try {
      const nextState = await api.reactions.engagement(activityIds);
      setEngagementByActivity(nextState);
    } catch (error) {
      console.error('Error fetching engagement:', error);
      setEngagementByActivity({});
    }
  };

  const fetchFeed = async (isRefresh = false) => {
    if (authLoading || !user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      
      // Refresh profile to get latest avatar
      await refreshProfile();
      
      const feedData = (await api.feed.get()).filter(isRenderableFeedItem);
      setFeed(feedData);
      await fetchEngagement(feedData.map((item) => item.id));
    } catch (err) {
      setError('Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFeed(true);
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    fetchFeed();

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => {
        fetchFeed(true);
      }, 400);
    };

    // Subscribe to realtime updates on listening_activity table
    const channel = supabase
      .channel('listening_activity_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listening_activity',
        },
        () => {
          scheduleRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'listening_activity',
        },
        () => {
          scheduleRefresh();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user?.id) {
      return;
    }

    const feedIds = feed.map((item) => item.id);
    if (feedIds.length === 0) {
      return;
    }

    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    const activityIdSet = new Set(feedIds);
    const scheduleRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => {
        fetchEngagement(feedIds);
      }, 250);
    };

    const shouldRefresh = (payload: any) => {
      const activityId = payload?.new?.activity_id || payload?.old?.activity_id;
      return !!activityId && activityIdSet.has(activityId);
    };

    const channel = supabase
      .channel(`feed_engagement_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_comments' },
        (payload) => {
          if (shouldRefresh(payload)) {
            scheduleRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_reactions' },
        (payload) => {
          if (shouldRefresh(payload)) {
            scheduleRefresh();
          }
        }
      )
      .subscribe();

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, feed.map((item) => item.id).join(',')]);

  const handleCommentPress = (item: ActivityItem) => {
    setSelectedActivity(item);
    setCommentModalVisible(true);
  };

  const handleCloseCommentModal = () => {
    setCommentModalVisible(false);
    setSelectedActivity(null);
  };

  const handleCommentCountChange = (activityId: string, count: number) => {
    setEngagementByActivity((prev) => ({
      ...prev,
      [activityId]: {
        commentCount: count,
        reactions: prev[activityId]?.reactions || { love: 0, fire: 0, headphones: 0 },
        userReactions: prev[activityId]?.userReactions || { love: false, fire: false, headphones: false },
      },
    }));
  };

  const handleToggleReaction = async (activityId: string, reactionType: ReactionType) => {
    if (!user?.id) return;

    const current = engagementByActivity[activityId] || {
      commentCount: 0,
      reactions: { love: 0, fire: 0, headphones: 0 },
      userReactions: { love: false, fire: false, headphones: false },
    };
    const isActive = current.userReactions[reactionType];

    setEngagementByActivity((prev) => {
      const existing = prev[activityId] || current;
      return {
        ...prev,
        [activityId]: {
          ...existing,
          reactions: {
            ...existing.reactions,
            [reactionType]: Math.max(0, existing.reactions[reactionType] + (isActive ? -1 : 1)),
          },
          userReactions: {
            ...existing.userReactions,
            [reactionType]: !isActive,
          },
        },
      };
    });

    try {
      await api.reactions.toggle(activityId, reactionType);
    } catch (error) {
      setEngagementByActivity((prev) => ({
        ...prev,
        [activityId]: current,
      }));
      Alert.alert('Reaction failed', 'We could not update that reaction right now.');
    }
  };

  const handlePreviewPress = async (item: ActivityItem) => {
    if (!getSpotifyTrackID(item)) {
      Alert.alert('Preview unavailable', 'We could not build a Spotify player for this track yet.');
      return;
    }

    setSelectedPreviewItem(item);
  };

  const handleOpenSpotifyPress = async (item: ActivityItem) => {
    if (!item.spotify_url) {
      Alert.alert('Link unavailable', 'There is no Spotify link stored for this track yet.');
      return;
    }

    try {
      await Linking.openURL(item.spotify_url);
    } catch {
      Alert.alert('Unable to open Spotify', 'Please try again in a moment.');
    }
  };

  const handleAvatarPress = (item: ActivityItem) => {
    if (!item.user_id) {
      return;
    }

    if (item.user_id === user?.id) {
      router.push('/(tabs)/profile');
      return;
    }

    router.push(`/profile/${item.user_id}`);
  };

  const renderEmptyState = () => (
    <EmptyStateComponent onChenPress={() => router.push('/(tabs)/chen')} />
  );

  return (
    <View style={{ flex: 1 }} >
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
            <View>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: Colors.textPrimary,
                }}

                className="pt-5"
              >
                Feed
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.6)',
                  marginTop: 2,
                }}
              >
                see what everyone&apos;s jamming to
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }} className="pt-5">
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
                source={{ 
                  uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${profile?.avatar_id || 'default'}&size=40&backgroundColor=0D0B09`
                }}
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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.orange}
                colors={[Colors.orange]}
              />
            }
          >
            {loading ? (
              [...Array(3)].map((_, i) => (
                <SkeletonCard key={i} index={i} />
              ))
            ) : feed.length === 0 ? (
              renderEmptyState()
            ) : (
              feed.map((item, index) => (
                <FeedCard
                  key={`${item.id}-${index}`}
                  item={item}
                  index={index}
                  engagement={engagementByActivity[item.id]}
                  onCommentPress={handleCommentPress}
                  onToggleReaction={handleToggleReaction}
                  onAvatarPress={handleAvatarPress}
                  onOpenSpotifyPress={handleOpenSpotifyPress}
                  onPreviewPress={handlePreviewPress}
                />
              ))
            )}
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
      
      {/* Comment Modal */}
      {selectedActivity && (
        <CommentModal
          visible={commentModalVisible}
          onClose={handleCloseCommentModal}
          activityId={selectedActivity.id}
          trackName={selectedActivity.track_name}
          artistName={selectedActivity.artist_name}
          onCommentCountChange={(count) => handleCommentCountChange(selectedActivity.id, count)}
        />
      )}

      <SpotifyPreviewModal
        item={selectedPreviewItem}
        visible={!!selectedPreviewItem}
        onClose={() => setSelectedPreviewItem(null)}
      />
    </View>
  );
}

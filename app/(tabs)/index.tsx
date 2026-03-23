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
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

type ReactionType = 'love' | 'fire' | 'headphones';

type FeedEngagement = {
  commentCount: number;
  reactions: Record<ReactionType, number>;
  userReactions: Record<ReactionType, boolean>;
};

function FeedCard({
  item,
  index,
  engagement,
  onCommentPress,
  onToggleReaction,
}: {
  item: ActivityItem;
  index: number;
  engagement?: FeedEngagement;
  onCommentPress: (item: ActivityItem) => void;
  onToggleReaction: (activityId: string, reactionType: ReactionType) => void;
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
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'now';
    const now = new Date();
    const startedAt = new Date(timestamp);
    const diffMs = now.getTime() - startedAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
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

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: Colors.textPrimary,
                  fontWeight: "600",
                  fontSize: 15,
                }}
              >
                {displayUsername}
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

            {item.is_playing && (
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
              {formatTimestamp(item.played_at || item.started_at)}
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
                source={{ uri: item.album_art_url }}
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
  const eqBars = Array.from({ length: 5 }, () => useRef(new Animated.Value(0.4)).current);

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
        No one is listening to music right now…{'\n'}Be the first to share what you're playing!
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

    const [commentsResult, reactionsResult] = await Promise.all([
      supabase
        .from('activity_comments')
        .select('activity_id')
        .in('activity_id', activityIds),
      supabase
        .from('activity_reactions')
        .select('activity_id,reaction_type,user_id')
        .in('activity_id', activityIds),
    ]);

    const nextState: Record<string, FeedEngagement> = {};
    for (const activityId of activityIds) {
      nextState[activityId] = {
        commentCount: 0,
        reactions: { love: 0, fire: 0, headphones: 0 },
        userReactions: { love: false, fire: false, headphones: false },
      };
    }

    for (const comment of commentsResult.data || []) {
      if (nextState[comment.activity_id]) {
        nextState[comment.activity_id].commentCount += 1;
      }
    }

    for (const reaction of reactionsResult.data || []) {
      const item = nextState[reaction.activity_id];
      if (!item) continue;

      item.reactions[reaction.reaction_type as ReactionType] += 1;
      if (reaction.user_id === user.id) {
        item.userReactions[reaction.reaction_type as ReactionType] = true;
      }
    }

    setEngagementByActivity(nextState);
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
      
      const feedData = await api.feed.get();
      setFeed(feedData);
      await fetchEngagement(feedData.map((item) => item.id));
    } catch (err) {
      setFeed([]);
      setEngagementByActivity({});
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
      if (isActive) {
        await supabase
          .from('activity_reactions')
          .delete()
          .eq('activity_id', activityId)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType);
        return;
      }

      await supabase
        .from('activity_reactions')
        .insert({
          activity_id: activityId,
          user_id: user.id,
          reaction_type: reactionType,
        });
    } catch (error) {
      setEngagementByActivity((prev) => ({
        ...prev,
        [activityId]: current,
      }));
    }
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
                What everyone's listening to
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
    </View>
  );
}

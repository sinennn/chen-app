//@ts-nocheck
import { AddFriendModal } from '@/components/add-friend-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Friend, FriendDiscoverResult, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

function FriendCard({ friend, index, onPress }: { friend: Friend; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: index * 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: index * 100, useNativeDriver: true }),
    ]).start();

    const timeout = setTimeout(() => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, index * 100 + 800);

    return () => clearTimeout(timeout);
  }, [fadeAnim, index, pulseAnim, slideAnim]);

  const getColor = (score: number) =>
    score >= 85 ? Colors.orange : score >= 70 ? Colors.success : 'rgba(255,255,255,0.3)';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginRight: 18, width: 150 }}>
      <Pressable
        onPress={onPress}
        style={{
          borderRadius: 28,
          padding: 16,
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          shadowColor: getColor(friend.compatibility),
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.35,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${friend.avatar_id}&size=80&backgroundColor=0D0B09` }}
            style={{ width: 70, height: 70, borderRadius: 35, marginBottom: 12 }}
          />
          {friend.is_online && (
            <View
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: Colors.success,
                borderWidth: 2,
                borderColor: 'rgba(0,0,0,0.3)',
              }}
            />
          )}
        </View>

        <Text
          style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6, textAlign: 'center' }}
          numberOfLines={1}
        >
          {friend.username || '--'}
        </Text>

        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            backgroundColor: getColor(friend.compatibility),
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 14,
            marginBottom: 6,
          }}
        >
          <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 12 }}>{friend.compatibility}%</Text>
        </Animated.View>

        <Text
          style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', lineHeight: 14 }}
          numberOfLines={2}
        >
          {friend.current_track ? `Listening to ${friend.current_track.artist_name}` : 'No active track right now'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function FriendListRow({
  friend,
  onProfilePress,
  onMessagePress,
}: {
  friend: Friend;
  onProfilePress: () => void;
  onMessagePress: () => void;
}) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onProfilePress} hitSlop={8}>
          <View style={{ marginRight: 12, position: 'relative' }}>
            <Image
              source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${friend.avatar_id || 'default'}&size=90&backgroundColor=0D0B09` }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
            {friend.is_online ? (
              <View
                style={{
                  position: 'absolute',
                  right: 2,
                  bottom: 2,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: Colors.success,
                  borderWidth: 2,
                  borderColor: 'rgba(0,0,0,0.35)',
                }}
              />
            ) : null}
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Pressable onPress={onProfilePress} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
              {friend.username}
            </Text>
          </Pressable>
          <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {friend.current_track ? `Listening to ${friend.current_track.artist_name}` : 'Part of your taste network'}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(232,100,10,0.14)',
            borderRadius: 16,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: 'rgba(232,100,10,0.2)',
          }}
        >
          <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '700' }}>
            {friend.compatibility}% match
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <Pressable
          onPress={onMessagePress}
          style={{
            flex: 1,
            backgroundColor: Colors.orange,
            borderRadius: 18,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '700' }}>Message</Text>
        </Pressable>
        <Pressable
          onPress={onProfilePress}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: 18,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Open profile</Text>
        </Pressable>
      </View>
    </View>
  );
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

function getDiscoverActionMeta(status: FriendDiscoverResult['relationship_status']) {
  switch (status) {
    case 'outgoing_pending':
      return {
        label: 'Request sent',
        backgroundColor: 'rgba(232,100,10,0.12)',
        borderColor: 'rgba(232,100,10,0.24)',
        textColor: Colors.orange,
        disabled: true,
      };
    case 'incoming_pending':
      return {
        label: 'Open profile',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderColor: 'rgba(255,255,255,0.12)',
        textColor: Colors.textPrimary,
        disabled: false,
      };
    case 'friends':
      return {
        label: 'Friends',
        backgroundColor: 'rgba(39,174,96,0.14)',
        borderColor: 'rgba(39,174,96,0.28)',
        textColor: Colors.success,
        disabled: true,
      };
    default:
      return {
        label: 'Ask to be friends',
        backgroundColor: Colors.orange,
        borderColor: Colors.orange,
        textColor: Colors.white,
        disabled: false,
      };
  }
}

function DiscoverUserRow({
  user,
  loading,
  onAvatarPress,
  onActionPress,
}: {
  user: FriendDiscoverResult;
  loading: boolean;
  onAvatarPress: () => void;
  onActionPress: () => void;
}) {
  const actionMeta = getDiscoverActionMeta(user.relationship_status);
  const subtitle = user.current_track
    ? `Listening to ${user.current_track.artist_name}`
    : user.user_tag
      ? `@${user.user_tag}`
      : 'Chen listener';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 22,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 }}>
        <Pressable onPress={onAvatarPress} hitSlop={8}>
          <View style={{ marginRight: 12, position: 'relative' }}>
            <Image
              source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${user.avatar_id || 'default'}&size=80&backgroundColor=0D0B09` }}
              style={{ width: 50, height: 50, borderRadius: 25 }}
            />
            {user.is_online ? (
              <View
                style={{
                  position: 'absolute',
                  right: 1,
                  bottom: 1,
                  width: 13,
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: Colors.success,
                  borderWidth: 2,
                  borderColor: 'rgba(0,0,0,0.35)',
                }}
              />
            ) : null}
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Pressable onPress={onAvatarPress} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {user.username}
            </Text>
          </Pressable>
          <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onActionPress}
        disabled={loading || actionMeta.disabled}
        style={{
          minWidth: 132,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: actionMeta.backgroundColor,
          borderWidth: 1,
          borderColor: actionMeta.borderColor,
          opacity: loading ? 0.72 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <Text style={{ color: actionMeta.textColor, fontSize: 12, fontWeight: '700' }}>
            {actionMeta.label}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function EmptyState({ onAddFriend }: { onAddFriend: () => void }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 2200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fadeAnim, floatAnim]);

  const seeds = ['ghost1', 'ghost2', 'ghost3'];

  return (
    <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', paddingTop: 40, paddingHorizontal: 32, paddingBottom: 30 }}>
      <Animated.View style={{ transform: [{ translateY: floatAnim }], marginBottom: 36 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {seeds.map((seed, i) => (
            <View
              key={seed}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: 'rgba(232,100,10,0.08)',
                borderWidth: 1.5,
                borderColor: 'rgba(232,100,10,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: i > 0 ? -16 : 0,
                zIndex: seeds.length - i,
              }}
            >
              <Image
                source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}&size=60&backgroundColor=0D0B09` }}
                style={{ width: 52, height: 52, borderRadius: 26, opacity: 0.35 }}
              />
            </View>
          ))}

          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(232,100,10,0.1)',
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: Colors.orange,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -16,
              zIndex: 0,
            }}
          >
            <Text style={{ color: Colors.orange, fontSize: 26, fontWeight: '300', lineHeight: 30 }}>+</Text>
          </View>
        </View>
      </Animated.View>

      <Text
        style={{
          color: Colors.textPrimary,
          fontSize: 22,
          fontWeight: '800',
          letterSpacing: -0.5,
          marginBottom: 10,
          textAlign: 'center',
        }}
      >
        Your circle is empty
      </Text>
      <Text
        style={{
          color: Colors.textSecondary,
          fontSize: 14,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 36,
        }}
      >
        Add friends to see what they&apos;re listening to in real time. Music hits different when you share it.
      </Text>

      <Pressable
        onPress={onAddFriend}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: Colors.orange,
          paddingHorizontal: 28,
          paddingVertical: 14,
          borderRadius: 28,
          shadowColor: Colors.orange,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
          elevation: 10,
        }}
      >
        <IconSymbol name="person.badge.plus" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 }}>
          Add your first friend
        </Text>
      </Pressable>

      <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 18, textAlign: 'center' }}>
        Share your username to get started
      </Text>
    </Animated.View>
  );
}

export default function FriendsScreen() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [discoverUsers, setDiscoverUsers] = useState<FriendDiscoverResult[]>([]);
  const [submittingDiscoverUserId, setSubmittingDiscoverUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const router = useRouter();
  const { profile, user, loading: authLoading } = useAuth();

  const generateFriendLink = () => {
    if (!profile?.username) {
      Alert.alert('Error', 'Username not found');
      return null;
    }

    return `https://chen.app/friends/${profile.username}`;
  };

  const shareFriendLink = async () => {
    const friendLink = generateFriendLink();
    if (!friendLink) {
      return;
    }

    try {
      await Share.share({
        message: `Join me on Chen! Let's share music together.\n\nMy friend link: ${friendLink}`,
        url: friendLink,
      });
    } catch {
      Alert.alert('Error', 'Failed to share link');
    }
  };

  const handleAddFriend = () => {
    setAddFriendModalVisible(true);
  };

  const handleSearchByUsername = () => {
    Alert.alert('Find Friends', 'How would you like to add friends?', [
      {
        text: 'Share Your Link',
        onPress: () => {
          Alert.alert('Share Your Friend Link', 'Share your friend link so others can add you!', [
            {
              text: 'Share Link',
              onPress: shareFriendLink,
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]);
        },
      },
      {
        text: 'Search by Username',
        onPress: () => setAddFriendModalVisible(true),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const fetchFriends = async () => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [friendsData, discoverData] = await Promise.all([
        api.friends.list(),
        api.friends.discover(),
      ]);
      const currentUserId = user.id;
      const acceptedFromDiscover = (discoverData || [])
        .filter((entry) => entry.id !== currentUserId && entry.relationship_status === 'friends')
        .map((entry) => ({
          id: entry.id,
          username: entry.username,
          avatar_id: entry.avatar_id,
          compatibility: 0,
          is_online: entry.is_online,
          current_track: entry.current_track,
        }));
      const mergedFriends = [...friendsData];
      for (const candidate of acceptedFromDiscover) {
        if (!mergedFriends.some((friend) => friend.id === candidate.id)) {
          mergedFriends.push(candidate);
        }
      }
      const friendIds = new Set(mergedFriends.map((friend) => friend.id));
      setFriends(mergedFriends);
      setDiscoverUsers(
        (discoverData || []).filter(
          (entry) =>
            entry.id !== currentUserId &&
            entry.relationship_status !== 'friends' &&
            !friendIds.has(entry.id)
        )
      );
    } catch {
      setError('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const openUserProfile = (targetUserId: string) => {
    router.push({ pathname: '/profile/[userId]', params: { userId: targetUserId } });
  };

  const openThread = (friend: Friend) => {
    router.push({
      pathname: '/messages/[friendId]',
      params: {
        friendId: friend.id,
        username: friend.username,
      },
    });
  };

  const handleDiscoverAction = async (discoverUser: FriendDiscoverResult) => {
    if (discoverUser.relationship_status === 'incoming_pending') {
      openUserProfile(discoverUser.id);
      return;
    }

    if (discoverUser.relationship_status !== 'none') {
      return;
    }

    setSubmittingDiscoverUserId(discoverUser.id);
    try {
      await api.friends.add(discoverUser.username);
      setDiscoverUsers((current) =>
        current.map((entry) =>
          entry.id === discoverUser.id
            ? { ...entry, relationship_status: 'outgoing_pending' }
            : entry
        )
      );
      Alert.alert('Success!', `Friend request sent to ${discoverUser.username}.`);
      fetchFriends();
    } catch (error) {
      Alert.alert('Error', parseErrorMessage(error, 'Failed to send friend request.'));
    } finally {
      setSubmittingDiscoverUserId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !user) {
        return;
      }

      fetchFriends();
    }, [authLoading, user?.id])
  );

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=1200&fit=crop' }}
        style={{ flex: 1 }}
        blurRadius={30}
      >
        <LinearGradient colors={['rgba(0,1,6,0.85)', 'rgba(0,1,6,0.9)', 'rgba(0,1,6,0.95)']} style={{ flex: 1 }}>
          <View
            style={{
              position: 'absolute',
              width: 300,
              height: 300,
              borderRadius: 150,
              backgroundColor: Colors.orange,
              opacity: 0.04,
              top: -60,
              right: -60,
            }}
          />

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
            <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>Friends</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={handleSearchByUsername}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(232,100,10,0.15)',
                }}
              >
                <IconSymbol name="person.badge.plus" size={20} color={Colors.orange} />
              </Pressable>
              <Pressable
                onPress={() => setAddFriendModalVisible(true)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(232,100,10,0.15)',
                }}
              >
                <IconSymbol name="magnifyingglass" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Colors.orange} size="large" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 14 }}>
                Loading your network...
              </Text>
            </View>
          ) : error ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 20 }}>
                {error}
              </Text>
              <Pressable
                onPress={fetchFriends}
                style={{ backgroundColor: Colors.orange, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
              {friends.length === 0 ? (
                <EmptyState onAddFriend={handleAddFriend} />
              ) : (
                <View style={{ marginBottom: 32 }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '700',
                      color: Colors.textMuted,
                      marginLeft: 20,
                      marginBottom: 16,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    Your Network
                  </Text>
                  <View style={{ paddingHorizontal: 20 }}>
                    {friends.map((friend) => (
                      <FriendListRow
                        key={friend.id}
                        friend={friend}
                        onProfilePress={() => openUserProfile(friend.id)}
                        onMessagePress={() => openThread(friend)}
                      />
                    ))}
                  </View>
                </View>
              )}

              <View style={{ paddingHorizontal: 20 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: Colors.textMuted,
                    marginBottom: 16,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Discover People
                </Text>
                {discoverUsers.length > 0 ? (
                  <>
                    {discoverUsers.map((discoverUser) => (
                      <DiscoverUserRow
                        key={discoverUser.id}
                        user={discoverUser}
                        loading={submittingDiscoverUserId === discoverUser.id}
                        onAvatarPress={() => openUserProfile(discoverUser.id)}
                        onActionPress={() => handleDiscoverAction(discoverUser)}
                      />
                    ))}
                  </>
                ) : (
                  <View
                    style={{
                      alignItems: 'center',
                      paddingVertical: 28,
                      paddingHorizontal: 20,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(232,100,10,0.08)',
                    }}
                  >
                    <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 8 }}>
                      No people to discover yet
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 18 }}>
                      Try searching by username while more people join your corner of Chen.
                    </Text>
                    <Pressable
                      onPress={() => setAddFriendModalVisible(true)}
                      style={{
                        backgroundColor: 'rgba(232,100,10,0.14)',
                        borderRadius: 18,
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(232,100,10,0.22)',
                      }}
                    >
                      <Text style={{ color: Colors.orange, fontWeight: '700', fontSize: 13 }}>Open search</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </LinearGradient>
      </ImageBackground>

      <AddFriendModal
        visible={addFriendModalVisible}
        onClose={() => setAddFriendModalVisible(false)}
        onFriendAdded={fetchFriends}
      />
    </View>
  );
}

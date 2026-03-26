//@ts-nocheck
import { AddFriendModal } from '@/components/add-friend-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Friend, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
    <Animated.View style={{ opacity: fadeAnim, flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
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
      const friendsData = await api.friends.list();
      setFriends(friendsData);
    } catch {
      setError('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    fetchFriends();
  }, [authLoading, user]);

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
          ) : friends.length === 0 ? (
            <EmptyState onAddFriend={handleAddFriend} />
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
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
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                  {friends.map((friend, index) => (
                    <FriendCard
                      key={friend.id}
                      friend={friend}
                      index={index}
                      onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: friend.id } })}
                    />
                  ))}
                </ScrollView>
              </View>

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
                    Find people by username
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 18 }}>
                    Search anyone on Chen and send requests without leaving this screen.
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

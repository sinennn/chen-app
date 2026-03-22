import { AddFriendModal } from '@/components/add-friend-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Friend, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  View
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
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, index * 100 + 800);
  }, []);

  const getColor = (score: number) =>
    score >= 85 ? Colors.orange : score >= 70 ? '#4CAF50' : 'rgba(255,255,255,0.3)';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginRight: 20, width: 150 }}>
      <Pressable
        onPress={onPress}
        style={{
          borderRadius: 28, padding: 16, alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          shadowColor: getColor(friend.compatibility),
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.35, shadowRadius: 20, elevation: 12,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${friend.avatar_id}&size=80&backgroundColor=0D0B09` }}
            style={{ width: 70, height: 70, borderRadius: 35, marginBottom: 12 }}
          />
          {friend.is_online && (
            <View style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 16, height: 16, borderRadius: 8,
              backgroundColor: Colors.success,
              borderWidth: 2, borderColor: 'rgba(0,0,0,0.3)',
            }} />
          )}
        </View>
        <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6, textAlign: 'center' }} numberOfLines={1}>
          {friend.username || '--'}
        </Text>
        <Animated.View style={{
          transform: [{ scale: pulseAnim }],
          backgroundColor: getColor(friend.compatibility),
          paddingHorizontal: 10, paddingVertical: 4,
          borderRadius: 14, marginBottom: 6,
        }}>
          <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 12 }}>{friend.compatibility}%</Text>
        </Animated.View>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', lineHeight: 14 }} numberOfLines={2}>
          {friend.current_track ? `Listening to ${friend.current_track.artist_name}` : '--'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function UserProfileCard({ username, onAddFriend }: { username: string; onAddFriend: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    
    // Pulse animation for add button
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, marginHorizontal: 20, marginBottom: 32 }}>
      <View style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(232,100,10,0.15)',
        alignItems: 'center',
      }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: 'rgba(232,100,10,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}>
          <Text style={{ color: Colors.orange, fontSize: 24, fontWeight: '700' }}>
            {username.charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
          {username}
        </Text>
        
        <Text style={{ color: Colors.textSecondary, fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
          Tap below to add this person to your friends list
        </Text>
        
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            onPress={onAddFriend}
            style={{
              backgroundColor: Colors.orange,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              shadowColor: Colors.orange,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <IconSymbol name="person.badge.plus" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              Add Friend
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default function FriendsPage() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [targetUsername, setTargetUsername] = useState<string | null>(null);
  const router = useRouter();
  const { profile } = useAuth();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Check if we have a username parameter from a friend link
    if (params.username && typeof params.username === 'string') {
      setTargetUsername(params.username);
    }
  }, [params]);

  const generateFriendLink = () => {
    if (!profile?.username) {
      Alert.alert('Error', 'Username not found');
      return;
    }
    
    const friendLink = `https://chen.app/friends/${profile.username}`;
    return friendLink;
  };

  const shareFriendLink = async () => {
    const friendLink = generateFriendLink();
    if (!friendLink) return;

    try {
      await Share.share({
        message: `Join me on Chen! Let's share music together 🎧\n\nMy friend link: ${friendLink}`,
        url: friendLink,
      });
    } catch (error) {
      console.error('Failed to share link:', error);
      Alert.alert('Error', 'Failed to share link');
    }
  };

  const handleAddSpecificFriend = (username: string) => {
    Alert.alert(
      'Add Friend',
      `Do you want to send a friend request to ${username}?`,
      [
        {
          text: 'Add Friend',
          onPress: async () => {
            try {
              await api.friends.add(username);
              Alert.alert('Success!', `Friend request sent to ${username}!`);
              setTargetUsername(null); // Clear the target username after successful request
              router.push('/(tabs)/friends'); // Navigate back to main friends page
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send friend request');
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleSearchByUsername = () => {
    Alert.alert(
      'Find Friends',
      'How would you like to add friends?',
      [
        {
          text: 'Share Your Link',
          onPress: () => {
            Alert.alert(
              'Share Your Friend Link',
              'Share your friend link so others can add you!',
              [
                {
                  text: 'Share Link',
                  onPress: shareFriendLink,
                },
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
              ]
            );
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
      ]
    );
  };

  const fetchFriends = async () => {
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
    if (!targetUsername) {
      fetchFriends(); 
    } else {
      setLoading(false); // Don't fetch friends if we're showing a specific user profile
    }
  }, [targetUsername]);

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=1200&fit=crop' }}
        style={{ flex: 1 }}
        blurRadius={30}
      >
        <LinearGradient
          colors={['rgba(0,1,6,0.85)', 'rgba(0,1,6,0.9)', 'rgba(0,1,6,0.95)']}
          style={{ flex: 1 }}
        >
          {/* Ambient glow */}
          <View style={{
            position: 'absolute',
            width: 300, height: 300, borderRadius: 150,
            backgroundColor: Colors.orange, opacity: 0.04,
            top: -60, right: -60,
          }} />

          {/* Header */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
          }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.textPrimary }}>
              {targetUsername ? 'Add Friend' : 'Friends'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable 
                onPress={handleSearchByUsername}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: 'rgba(232,100,10,0.15)',
                }}
              >
                <IconSymbol name="person.badge.plus" size={20} color={Colors.orange} />
              </Pressable>
              <Pressable style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: 'rgba(232,100,10,0.15)',
              }}>
                <IconSymbol name="magnifyingglass" size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Body */}
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={Colors.orange} size="large" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16, fontSize: 14 }}>
                Loading...
              </Text>
            </View>
          ) : targetUsername ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              <UserProfileCard 
                username={targetUsername} 
                onAddFriend={() => handleAddSpecificFriend(targetUsername)} 
              />
            </ScrollView>
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
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' }}>
                Your circle is empty
              </Text>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 36 }}>
                Add friends to see what they&apos;re listening to in real time. Music hits different when you share it.
              </Text>
              <Pressable
                onPress={handleSearchByUsername}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: Colors.orange,
                  paddingHorizontal: 28, paddingVertical: 14,
                  borderRadius: 28,
                  shadowColor: Colors.orange,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
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
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ marginBottom: 32 }}>
                <Text style={{
                  fontSize: 13, fontWeight: '700', color: Colors.textMuted,
                  marginLeft: 20, marginBottom: 16,
                  letterSpacing: 1.5, textTransform: 'uppercase',
                }}>
                  Your Network
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                  {friends.map((friend, index) => (
                    <FriendCard
                      key={friend.id}
                      friend={friend}
                      index={index}
                      onPress={() => router.push(`/profile/${friend.id}`)}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={{ paddingHorizontal: 20 }}>
                <Text style={{
                  fontSize: 13, fontWeight: '700', color: Colors.textMuted,
                  marginBottom: 16, letterSpacing: 1.5, textTransform: 'uppercase',
                }}>
                  Discover People
                </Text>
                <View style={{
                  alignItems: 'center', paddingVertical: 40,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderRadius: 20, borderWidth: 1,
                  borderColor: 'rgba(232,100,10,0.08)',
                }}>
                  <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Coming soon</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </LinearGradient>
      </ImageBackground>
      
      {/* Add Friend Modal */}
      <AddFriendModal
        visible={addFriendModalVisible}
        onClose={() => setAddFriendModalVisible(false)}
      />
    </View>
  );
}

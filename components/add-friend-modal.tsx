import { Colors } from '@/constants/theme';
import { FriendSearchResult, api } from '@/lib/api';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Keyboard,
    Modal,
    Pressable,
    Text,
    ScrollView,
    TextInput,
    TouchableWithoutFeedback,
    View
} from 'react-native';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddFriendModal({ visible, onClose }: AddFriendModalProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setUsername('');
      setSearchResults([]);
      // Animate in
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const searchUsers = async (searchUsername: string) => {
    setSearching(true);
    try {
      const results = await api.friends.search(searchUsername.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddFriend = async (friendUsername: string) => {
    setLoading(true);
    try {
      await api.friends.add(friendUsername);
      Alert.alert('Success!', 'Friend request sent!');
      setUsername('');
      setSearchResults([]);
      onClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text);
  };

  useEffect(() => {
    if (username.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timeout = setTimeout(() => {
      searchUsers(username);
    }, 300);

    return () => clearTimeout(timeout);
  }, [username]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.7)',
              opacity: backdropOpacity,
            }}
          >
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: Colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 40,
              transform: [{ translateY: slideAnim }],
              borderTopWidth: 1,
              borderTopColor: 'rgba(232, 100, 10, 0.2)',
              maxHeight: '80%',
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                Add Friend
              </Text>
              <Pressable onPress={onClose}>
                <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={{ marginBottom: 20 }}>
              <TextInput
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="Enter username..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 20,
                  padding: 12,
                  paddingHorizontal: 16,
                  color: Colors.textPrimary,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(232, 100, 10, 0.2)',
                }}
              />
            </View>

            {/* Search Results */}
            <ScrollView 
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            >
              {searching ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: Colors.textSecondary }}>Searching...</Text>
                </View>
              ) : searchResults.length === 0 && username.trim().length >= 2 ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: Colors.textSecondary }}>No users found</Text>
                </View>
              ) : (
                searchResults.map((user) => (
                  <View key={user.id} style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: 'rgba(232, 100, 10, 0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ color: Colors.orange, fontSize: 14, fontWeight: '700' }}>
                          {user.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                          {user.username}
                        </Text>
                        {!!user.user_tag && (
                          <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>
                            @{user.user_tag}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => handleAddFriend(user.username)}
                      disabled={loading}
                      style={{
                        backgroundColor: loading ? 'rgba(232, 100, 10, 0.3)' : Colors.orange,
                        borderRadius: 20,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
                        {loading ? '...' : 'Add'}
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

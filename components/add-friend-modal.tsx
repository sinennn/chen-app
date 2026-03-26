import { Colors } from '@/constants/theme';
import { FriendSearchResult, api } from '@/lib/api';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onFriendAdded?: () => void;
}

function parseErrorMessage(error: unknown) {
  if (!(error instanceof Error) || !error.message) {
    return 'Failed to send friend request';
  }

  try {
    const parsed = JSON.parse(error.message);
    if (parsed?.error) {
      return parsed.error;
    }
  } catch {
    // fall through to raw message
  }

  return error.message;
}

function getStatusMeta(status: FriendSearchResult['relationship_status']) {
  switch (status) {
    case 'friends':
      return {
        label: 'Friends',
        backgroundColor: 'rgba(39, 174, 96, 0.14)',
        borderColor: 'rgba(39, 174, 96, 0.28)',
        textColor: Colors.success,
      };
    case 'outgoing_pending':
      return {
        label: 'Request sent',
        backgroundColor: 'rgba(232, 100, 10, 0.12)',
        borderColor: 'rgba(232, 100, 10, 0.24)',
        textColor: Colors.orange,
      };
    case 'incoming_pending':
      return {
        label: 'Incoming request',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        textColor: Colors.textPrimary,
      };
    case 'self':
      return {
        label: 'You',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        textColor: Colors.textSecondary,
      };
    default:
      return {
        label: 'Add',
        backgroundColor: Colors.orange,
        borderColor: Colors.orange,
        textColor: Colors.white,
      };
  }
}

export function AddFriendModal({ visible, onClose, onFriendAdded }: AddFriendModalProps) {
  const [username, setUsername] = useState('');
  const [loadingUsername, setLoadingUsername] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setUsername('');
      setSearchResults([]);
      setLoadingUsername(null);
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
      return;
    }

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
  }, [backdropOpacity, slideAnim, visible]);

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

  const handleAddFriend = async (user: FriendSearchResult) => {
    if (user.relationship_status !== 'none') {
      return;
    }

    setLoadingUsername(user.username);
    try {
      await api.friends.add(user.username);
      setSearchResults((current) =>
        current.map((entry) =>
          entry.id === user.id
            ? { ...entry, relationship_status: 'outgoing_pending' }
            : entry
        )
      );
      onFriendAdded?.();
      Alert.alert('Success!', `Friend request sent to ${user.username}.`);
    } catch (error) {
      Alert.alert('Error', parseErrorMessage(error));
    } finally {
      setLoadingUsername(null);
    }
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 40,
              transform: [{ translateY: slideAnim }],
              borderTopWidth: 1,
              borderTopColor: 'rgba(232, 100, 10, 0.2)',
              maxHeight: '82%',
            }}
          >
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

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
              }}
            >
              <View>
                <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
                  Find friends
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                  Search by username or tag
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>Close</Text>
              </Pressable>
            </View>

            <View
              style={{
                marginBottom: 18,
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: 22,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderWidth: 1,
                borderColor: 'rgba(232, 100, 10, 0.16)',
              }}
            >
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Search username..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  color: Colors.textPrimary,
                  fontSize: 16,
                }}
              />
            </View>

            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {searching ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <ActivityIndicator color={Colors.orange} />
                  <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Searching...</Text>
                </View>
              ) : searchResults.length === 0 && username.trim().length >= 2 ? (
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: 32,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '600' }}>
                    No users found
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                    Try a different username or tag.
                  </Text>
                </View>
              ) : username.trim().length < 2 ? (
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: 32,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '600' }}>
                    Start typing to search
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 6 }}>
                    We&apos;ll show matching people as you type.
                  </Text>
                </View>
              ) : (
                searchResults.map((user) => {
                  const statusMeta = getStatusMeta(user.relationship_status);
                  const isLoading = loadingUsername === user.username;
                  const isAddable = user.relationship_status === 'none';

                  return (
                    <View
                      key={user.id}
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
                        <Image
                          source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${user.avatar_id}&size=80&backgroundColor=0D0B09` }}
                          style={{ width: 46, height: 46, borderRadius: 23, marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '600' }}
                            numberOfLines={1}
                          >
                            {user.username}
                          </Text>
                          <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                            {user.user_tag ? `@${user.user_tag}` : 'Chen listener'}
                          </Text>
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleAddFriend(user)}
                        disabled={!isAddable || isLoading}
                        style={{
                          minWidth: 104,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: statusMeta.backgroundColor,
                          borderWidth: 1,
                          borderColor: statusMeta.borderColor,
                          opacity: isLoading ? 0.72 : 1,
                        }}
                      >
                        {isLoading ? (
                          <ActivityIndicator color={Colors.white} size="small" />
                        ) : (
                          <Text style={{ color: statusMeta.textColor, fontSize: 12, fontWeight: '700' }}>
                            {statusMeta.label}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

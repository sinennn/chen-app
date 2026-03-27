//@ts-nocheck
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { MessageThread, NotificationItem, PendingFriendRequest, api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

function formatRelativeTime(timestamp?: string) {
  if (!timestamp) {
    return 'just now';
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [requests, setRequests] = useState<PendingFriendRequest[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [notificationData, requestData, threadData] = await Promise.all([
        api.notifications.list(),
        api.friends.requests(),
        api.messages.threads(),
      ]);
      setNotifications(notificationData.items || []);
      setUnreadCount(notificationData.unreadCount || 0);
      setRequests(requestData || []);
      setThreads((threadData || []).filter((thread) => thread.lastMessage));
    } catch (error) {
      Alert.alert('Unable to load notifications', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleAccept = async (request: PendingFriendRequest) => {
    try {
      await api.friends.accept(request.friendship_id);
      await loadData();
    } catch (error) {
      Alert.alert('Unable to accept request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleDecline = async (request: PendingFriendRequest) => {
    try {
      await api.friends.decline(request.friendship_id);
      await loadData();
    } catch (error) {
      Alert.alert('Unable to decline request', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleOpenThread = async (thread: MessageThread) => {
    try {
      await api.messages.markRead(thread.friend.id);
    } catch {}

    router.push({
      pathname: '/messages/[friendId]',
      params: {
        friendId: thread.friend.id,
        username: thread.friend.username,
      },
    });
  };

  const handleNotificationPress = async (item: NotificationItem) => {
    try {
      if (!item.read_at) {
        await api.notifications.markRead(item.id);
        setNotifications((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry
          )
        );
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch {}

    if (item.type === 'message' && item.metadata?.friendId) {
      router.push({
        pathname: '/messages/[friendId]',
        params: {
          friendId: item.metadata.friendId,
          username: item.actor?.username,
        },
      });
      return;
    }

    const targetProfileId = item.metadata?.requesterId || item.metadata?.friendId;
    if ((item.type === 'friend_request' || item.type === 'friend_accept') && targetProfileId) {
      router.push({
        pathname: '/profile/[userId]',
        params: { userId: targetProfileId },
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAllRead(true);
      await api.notifications.markAllRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (error) {
      Alert.alert('Unable to mark notifications as read', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <LinearGradient colors={['rgba(13,11,9,0.7)', 'rgba(13,11,9,0.94)', Colors.bg]} style={{ flex: 1 }}>
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
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: 'rgba(232,100,10,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSymbol name="chevron.left" size={18} color={Colors.textPrimary} />
          </Pressable>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: '700' }}>Notifications</Text>
            <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
            </Text>
          </View>

          <Pressable
            onPress={handleMarkAllRead}
            disabled={markingAllRead || unreadCount === 0}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 18,
              backgroundColor: unreadCount > 0 ? 'rgba(232,100,10,0.14)' : 'rgba(255,255,255,0.06)',
              borderWidth: 1,
              borderColor: unreadCount > 0 ? 'rgba(232,100,10,0.22)' : 'rgba(255,255,255,0.08)',
            }}
          >
            {markingAllRead ? (
              <ActivityIndicator color={Colors.orange} size="small" />
            ) : (
              <Text style={{ color: unreadCount > 0 ? Colors.orange : Colors.textMuted, fontSize: 12, fontWeight: '700' }}>
                Read all
              </Text>
            )}
          </Pressable>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.orange} size="large" />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 12 }}>
              Friend requests
            </Text>
            {requests.length > 0 ? (
              requests.map((request) => (
                <View
                  key={request.friendship_id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 24,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(232,100,10,0.12)',
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: request.requester.id } })}
                    >
                      <Image
                        source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${request.requester.avatar_id}&size=80&backgroundColor=0D0B09` }}
                        style={{ width: 54, height: 54, borderRadius: 27, marginRight: 12 }}
                      />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                        {request.requester.username}
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                        {request.current_track ? `Listening to ${request.current_track.artist_name}` : 'Wants to join your circle'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable
                      onPress={() => handleAccept(request)}
                      style={{
                        flex: 1,
                        backgroundColor: Colors.orange,
                        borderRadius: 18,
                        paddingVertical: 12,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '700' }}>Accept</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDecline(request)}
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 18,
                        paddingVertical: 12,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ marginBottom: 24, borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                  No pending requests right now.
                </Text>
              </View>
            )}

            <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 12 }}>
              Messages
            </Text>
            {threads.length > 0 ? (
              threads.map((thread) => (
                <Pressable
                  key={thread.friend.id}
                  onPress={() => handleOpenThread(thread)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: 22,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)',
                    marginBottom: 12,
                  }}
                >
                  <Image
                    source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${thread.friend.avatar_id}&size=80&backgroundColor=0D0B09` }}
                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                      {thread.friend.username}
                    </Text>
                    <Text numberOfLines={1} style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                      {thread.lastMessage?.content || 'Open thread'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                      {formatRelativeTime(thread.lastMessage?.created_at)}
                    </Text>
                    {thread.unreadCount > 0 ? (
                      <View
                        style={{
                          minWidth: 22,
                          height: 22,
                          paddingHorizontal: 6,
                          borderRadius: 11,
                          backgroundColor: Colors.orange,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: 8,
                        }}
                      >
                        <Text style={{ color: Colors.white, fontSize: 11, fontWeight: '700' }}>
                          {thread.unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={{ marginBottom: 24, borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                  No conversations yet.
                </Text>
              </View>
            )}

            <Text style={{ color: Colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 12 }}>
              Activity
            </Text>
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleNotificationPress(item)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: item.read_at ? 'rgba(255,255,255,0.04)' : 'rgba(232,100,10,0.08)',
                    borderRadius: 22,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: item.read_at ? 'rgba(255,255,255,0.06)' : 'rgba(232,100,10,0.18)',
                    marginBottom: 12,
                  }}
                >
                  <Image
                    source={{ uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${item.actor?.avatar_id || 'default'}&size=80&backgroundColor=0D0B09` }}
                    style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 3 }}>
                      {item.body}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                      {formatRelativeTime(item.created_at)}
                    </Text>
                    {!item.read_at ? (
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.orange, marginTop: 8 }} />
                    ) : null}
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={{ borderRadius: 22, padding: 18, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                  No notifications yet.
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </LinearGradient>
    </View>
  );
}

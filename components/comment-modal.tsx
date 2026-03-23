//@ts-nocheck
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';

type FlatComment = {
  id: string;
  user_id: string;
  username: string;
  avatar_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
};

type CommentNode = FlatComment & {
  replies: CommentNode[];
};

interface CommentModalProps {
  visible: boolean;
  onClose: () => void;
  activityId: string;
  trackName: string;
  artistName: string;
  onCommentCountChange?: (count: number) => void;
}

export function CommentModal({
  visible,
  onClose,
  activityId,
  trackName,
  artistName,
  onCommentCountChange,
}: CommentModalProps) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<FlatComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingComments, setFetchingComments] = useState(false);
  const [replyTo, setReplyTo] = useState<FlatComment | null>(null);

  const slideAnim = React.useRef(new Animated.Value(300)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fetchComments();
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

    setReplyTo(null);
    setNewComment('');
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
  }, [visible, activityId]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  const fetchComments = async () => {
    setFetchingComments(true);
    try {
      const { data, error } = await supabase
        .from('activity_comments')
        .select(`
          id,
          user_id,
          content,
          parent_comment_id,
          created_at,
          users!inner(username, avatar_id)
        `)
        .eq('activity_id', activityId)
        .order('created_at', { ascending: true });

      if (error) {
        if (error.code === 'PGRST205') {
          setComments([]);
          onCommentCountChange?.(0);
          return;
        }
        throw error;
      }

      const formattedComments: FlatComment[] = (data || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        username: item.users.username,
        avatar_id: item.users.avatar_id,
        content: item.content,
        parent_comment_id: item.parent_comment_id,
        created_at: item.created_at,
      }));

      setComments(formattedComments);
      onCommentCountChange?.(formattedComments.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
      onCommentCountChange?.(0);
    } finally {
      setFetchingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || loading || !profile?.id) return;

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        activity_id: activityId,
        user_id: profile.id,
        content: newComment.trim(),
      };

      if (replyTo?.id) {
        payload.parent_comment_id = replyTo.id;
      }

      const { error } = await supabase
        .from('activity_comments')
        .insert(payload);

      if (error) {
        if (error.code === 'PGRST205') {
          Alert.alert('Comments Not Available', 'Comments are not configured yet.');
          return;
        }
        throw error;
      }

      setNewComment('');
      setReplyTo(null);
      await fetchComments();
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const createdAt = new Date(timestamp);
    const diffMs = now.getTime() - createdAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const renderComment = (comment: CommentNode, depth = 0) => (
    <View key={comment.id} style={{ marginBottom: 16, marginLeft: depth > 0 ? 20 : 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(232, 100, 10, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '700' }}>
            {comment.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600' }}>
              {comment.username}
            </Text>
            <Text style={{ color: Colors.textMuted, fontSize: 12, marginLeft: 8 }}>
              {formatTimestamp(comment.created_at)}
            </Text>
          </View>
          <Text style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 18 }}>
            {comment.content}
          </Text>
          <Pressable onPress={() => setReplyTo(comment)} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '600' }}>
              Reply
            </Text>
          </Pressable>
        </View>
      </View>

      {comment.replies.length > 0 && (
        <View style={{ marginTop: 12 }}>
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </View>
      )}
    </View>
  );

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

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                  Comments
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {trackName} • {artistName}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 260, marginBottom: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {fetchingComments ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: Colors.textSecondary }}>Loading comments...</Text>
                </View>
              ) : commentTree.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <Text style={{ color: Colors.textSecondary }}>No comments yet. Be the first!</Text>
                </View>
              ) : (
                commentTree.map((comment) => renderComment(comment))
              )}
            </ScrollView>

            {replyTo && (
              <View
                style={{
                  marginBottom: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(232, 100, 10, 0.18)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: Colors.textSecondary, fontSize: 12, flex: 1 }}>
                  Replying to {replyTo.username}
                </Text>
                <Pressable onPress={() => setReplyTo(null)}>
                  <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                value={newComment}
                onChangeText={setNewComment}
                placeholder={replyTo ? `Reply to ${replyTo.username}...` : 'Add a comment...'}
                placeholderTextColor={Colors.textMuted}
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 20,
                  padding: 12,
                  paddingHorizontal: 16,
                  color: Colors.textPrimary,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(232, 100, 10, 0.2)',
                  maxHeight: 80,
                }}
                multiline
                textAlignVertical="center"
              />
              <Pressable
                onPress={handlePostComment}
                disabled={!newComment.trim() || loading}
                style={{
                  backgroundColor: newComment.trim() && !loading ? Colors.orange : 'rgba(232, 100, 10, 0.3)',
                  borderRadius: 20,
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                  {loading ? '...' : '→'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function buildCommentTree(comments: FlatComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    byId.set(comment.id, { ...comment, replies: [] });
  }

  for (const comment of comments) {
    const node = byId.get(comment.id);
    if (!node) continue;

    if (comment.parent_comment_id) {
      const parent = byId.get(comment.parent_comment_id);
      if (parent) {
        parent.replies.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  return roots;
}

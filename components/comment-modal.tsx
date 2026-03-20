//@ts-nocheck
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
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

interface Comment {
    id: string;
    user_id: string;
    username: string;
    avatar_id: string;
    content: string;
    created_at: string;
}

interface CommentModalProps {
    visible: boolean;
    onClose: () => void;
    activityId: string;
    trackName: string;
    artistName: string;
}

export function CommentModal({ visible, onClose, activityId, trackName, artistName }: CommentModalProps) {
    const { profile } = useAuth();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingComments, setFetchingComments] = useState(false);

    const slideAnim = React.useRef(new Animated.Value(300)).current;
    const backdropOpacity = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            fetchComments();
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

    const fetchComments = async () => {
        setFetchingComments(true);
        try {
            const { data, error } = await supabase
                .from('activity_comments')
                .select(`
                    id,
                    user_id,
                    content,
                    created_at,
                    users!inner(username, avatar_id)
                `)
                .eq('activity_id', activityId)
                .order('created_at', { ascending: true });

            if (error) {
                // Handle case where table doesn't exist yet
                if (error.code === 'PGRST205') {
                    console.log('Comments table not created yet - showing empty state');
                    setComments([]);
                    return;
                }
                throw error;
            }

            const formattedComments: Comment[] = data?.map(item => ({
                id: item.id,
                user_id: item.user_id,
                username: item.users.username,
                avatar_id: item.users.avatar_id,
                content: item.content,
                created_at: item.created_at
            })) || [];

            setComments(formattedComments);
        } catch (error) {
            console.error('Error fetching comments:', error);
            setComments([]);
        } finally {
            setFetchingComments(false);
        }
    };

    const handlePostComment = async () => {
        if (!newComment.trim() || loading) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('activity_comments')
                .insert({
                    activity_id: activityId,
                    user_id: profile?.id,
                    content: newComment.trim()
                })
                .select(`
                    id,
                    user_id,
                    content,
                    created_at,
                    users!inner(username, avatar_id)
                `)
                .single();

            if (error) {
                // Handle case where table doesn't exist yet
                if (error.code === 'PGRST205') {
                    Alert.alert('Comments Not Available', 'The comment feature is not set up yet. Please contact the administrator to enable comments.');
                    return;
                }
                throw error;
            }

            const newCommentData: Comment = {
                id: data.id,
                user_id: data.user_id,
                username: data.users.username,
                avatar_id: data.users.avatar_id,
                content: data.content,
                created_at: data.created_at
            };

            setComments(prev => [...prev, newCommentData]);
            setNewComment('');
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

                        {/* Comments List */}
                        <ScrollView 
                            style={{ maxHeight: 200, marginBottom: 16 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {fetchingComments ? (
                                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                    <Text style={{ color: Colors.textSecondary }}>Loading comments...</Text>
                                </View>
                            ) : comments.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                                    <Text style={{ color: Colors.textSecondary }}>No comments yet. Be the first!</Text>
                                </View>
                            ) : (
                                comments.map((comment) => (
                                    <View key={comment.id} style={{ marginBottom: 16 }}>
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
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        {/* Comment Input */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                            <TextInput
                                value={newComment}
                                onChangeText={setNewComment}
                                placeholder="Add a comment..."
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

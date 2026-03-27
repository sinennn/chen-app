//@ts-nocheck
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { DirectMessage, api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

const starterPrompts = [
  'What have you had on repeat lately?',
  'Send me your current obsession',
  'Need a recommendation tonight?',
];

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDayPill(timestamp?: string) {
  if (!timestamp) {
    return 'Now';
  }

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) {
    return 'Today';
  }

  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDuration(durationMs?: number) {
  const totalSeconds = Math.max(0, Math.floor((durationMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function VoiceWave({ progress = 0, active = false }: { progress?: number; active?: boolean }) {
  const heights = [10, 16, 12, 18, 9, 15, 11, 17, 13, 8, 14, 10];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 }}>
      {heights.map((height, index) => {
        const threshold = (index + 1) / heights.length;
        const filled = progress >= threshold;

        return (
          <View
            key={`${height}-${index}`}
            style={{
              width: 4,
              height,
              borderRadius: 3,
              backgroundColor: filled
                ? Colors.orange
                : active
                  ? 'rgba(255,255,255,0.35)'
                  : 'rgba(255,255,255,0.16)',
            }}
          />
        );
      })}
    </View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { friendId, username } = useLocalSearchParams<{ friendId: string; username?: string }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [friend, setFriend] = useState<{ id: string; username: string; avatar_id: string } | null>(
    friendId
      ? {
          id: friendId,
          username: username || 'Friend',
          avatar_id: 'default',
        }
      : null
  );
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordedVoiceNote, setRecordedVoiceNote] = useState<{ uri: string; durationMs: number } | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [playbackState, setPlaybackState] = useState<{
    sourceId: string | null;
    isPlaying: boolean;
    positionMs: number;
    durationMs: number;
  }>({
    sourceId: null,
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
  });

  const scrollViewRef = useRef<ScrollView | null>(null);
  const playerRef = useRef<any>(null);
  const activePlaybackSourceIdRef = useRef<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);

  const stopPlayback = async () => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
    }
    activePlaybackSourceIdRef.current = null;

    setPlaybackState({
      sourceId: null,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
    });
  };

  const loadThread = async () => {
    if (!friendId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await api.messages.thread(friendId);
      setFriend(result.friend);
      setMessages(result.messages || []);
      await api.messages.markRead(friendId);
    } catch (error) {
      Alert.alert('Unable to load chat', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThread();
  }, [friendId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => clearTimeout(timeout);
  }, [messages.length, recordedVoiceNote?.uri]);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (playerRef.current) {
        try {
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const player = createAudioPlayer(null, {
      updateInterval: 100,
      keepAudioSessionActive: true,
    });

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      setPlaybackState({
        sourceId: activePlaybackSourceIdRef.current,
        isPlaying: status.playing,
        positionMs: Math.max(0, Math.round((status.currentTime || 0) * 1000)),
        durationMs: Math.max(0, Math.round((status.duration || 0) * 1000)),
      });

      if (status.didJustFinish || (!status.playing && status.currentTime >= status.duration && status.duration > 0)) {
        activePlaybackSourceIdRef.current = null;
        setPlaybackState({
          sourceId: null,
          isPlaying: false,
          positionMs: 0,
          durationMs: Math.max(0, Math.round((status.duration || 0) * 1000)),
        });
      }
    });

    playerRef.current = player;

    return () => {
      subscription.remove();
      try {
        player.remove();
      } catch {}
      if (playerRef.current === player) {
        playerRef.current = null;
      }
    };
  }, []);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !friendId || sending || isRecording || uploadingVoice) {
      return;
    }

    const optimisticMessage: DirectMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user?.id || 'me',
      recipient_id: friendId,
      content,
      message_type: 'text',
      created_at: new Date().toISOString(),
      is_mine: true,
    };

    setDraft('');
    setSending(true);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const created = await api.messages.send(friendId, content);
      setMessages((current) =>
        current.map((message) => (message.id === optimisticMessage.id ? created : message))
      );
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
      setDraft(content);
    } finally {
      setSending(false);
    }
  };

  const openFriendProfile = () => {
    if (!friend?.id) {
      return;
    }

    router.push({ pathname: '/profile/[userId]', params: { userId: friend.id } });
  };

  const startRecording = async () => {
    if (isRecording || sending || uploadingVoice) {
      return;
    }

    try {
      await stopPlayback();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone needed', 'Please allow microphone access to record a voice note.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      setRecordedVoiceNote(null);
      setRecordingDurationMs(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Please try again.');
      setIsRecording(false);
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      } catch {}
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording && !isRecording) {
      return;
    }

    try {
      await recorder.stop();
      setIsRecording(false);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      const uri = recorder.uri || recorderState.url;
      if (!uri) {
        throw new Error('No audio file was produced');
      }

      const durationMs = recorderState.durationMillis || recordingDurationMs;
      if (durationMs < 600) {
        setRecordingDurationMs(0);
        Alert.alert('Too short', 'Hold the mic a little longer to send a voice note.');
        return;
      }

      setRecordedVoiceNote({ uri, durationMs });
      setRecordingDurationMs(0);
    } catch (error) {
      setIsRecording(false);
      setRecordingDurationMs(0);
      Alert.alert('Recording failed', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const discardRecordedVoice = async () => {
    if (playbackState.sourceId === 'draft-voice') {
      await stopPlayback();
    }
    setRecordedVoiceNote(null);
  };

  const uploadVoiceNote = async (uri: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const extensionMatch = uri.match(/\.(\w+)(?:\?|$)/);
    const extension = extensionMatch ? `.${extensionMatch[1]}` : '.m4a';
    const filePath = `${user?.id || 'anonymous'}/${Date.now()}-${friendId}${extension}`;
    const contentType = blob.type || (extension === '.webm' ? 'audio/webm' : 'audio/mp4');

    const { error } = await supabase.storage.from('voice-notes').upload(filePath, blob, {
      contentType,
      upsert: false,
    });
    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from('voice-notes').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const sendRecordedVoice = async () => {
    if (!recordedVoiceNote || !friendId || uploadingVoice || sending) {
      return;
    }

    const localVoice = recordedVoiceNote;
    const optimisticMessage: DirectMessage = {
      id: `voice-${Date.now()}`,
      sender_id: user?.id || 'me',
      recipient_id: friendId,
      content: 'Voice note',
      message_type: 'voice',
      audio_url: localVoice.uri,
      audio_duration_ms: localVoice.durationMs,
      created_at: new Date().toISOString(),
      is_mine: true,
    };

    setRecordedVoiceNote(null);
    setUploadingVoice(true);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const audioURL = await uploadVoiceNote(localVoice.uri);
      const created = await api.messages.send(friendId, {
        content: 'Voice note',
        message_type: 'voice',
        audio_url: audioURL,
        audio_duration_ms: localVoice.durationMs,
      });

      setMessages((current) =>
        current.map((message) => (message.id === optimisticMessage.id ? created : message))
      );
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setRecordedVoiceNote(localVoice);
      Alert.alert('Voice note failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setUploadingVoice(false);
    }
  };

  const toggleVoicePlayback = async (sourceId: string, uri: string) => {
    if (!uri) {
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (playbackState.sourceId === sourceId && playerRef.current) {
        if (!playerRef.current.isLoaded) {
          await stopPlayback();
          return;
        }

        if (playerRef.current.playing) {
          playerRef.current.pause();
        } else {
          playerRef.current.play();
        }
        return;
      }

      await stopPlayback();
      activePlaybackSourceIdRef.current = sourceId;
      playerRef.current?.replace(uri);
      playerRef.current?.play();
    } catch (error) {
      Alert.alert('Playback failed', error instanceof Error ? error.message : 'Please try again.');
      await stopPlayback();
    }
  };

  useEffect(() => {
    if (isRecording || recorderState.isRecording) {
      setRecordingDurationMs(recorderState.durationMillis || 0);
    }
  }, [isRecording, recorderState.durationMillis, recorderState.isRecording]);

  const lastMessageTime = messages.length > 0 ? formatTimestamp(messages[messages.length - 1]?.created_at) : 'New thread';
  const headerUsername = friend?.username || username || 'Friend';
  const avatarSeed = friend?.avatar_id || 'default';

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0B09' }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&h=1200&fit=crop' }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        blurRadius={32}
      />
      <LinearGradient
        colors={['rgba(13,11,9,0.72)', 'rgba(13,11,9,0.84)', 'rgba(13,11,9,0.9)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          position: 'absolute',
          width: 260,
          height: 260,
          borderRadius: 130,
          top: -50,
          right: -70,
          backgroundColor: 'rgba(232,100,10,0.12)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: 90,
          bottom: 120,
          left: -40,
          backgroundColor: 'rgba(255,255,255,0.03)',
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 60,
            paddingBottom: 16,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: 'rgba(255,255,255,0.06)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(232,100,10,0.18)',
            }}
          >
            <IconSymbol name="chevron.left" size={18} color={Colors.textPrimary} />
          </Pressable>

          <View style={{ alignItems: 'center' }}>
            {/* <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase' }}>
              Chen Chat
            </Text> */}
            <Text style={{ color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 5 }}>
              {headerUsername}
            </Text>
          </View>

          <Pressable
            onPress={openFriendProfile}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: 'rgba(232,100,10,0.28)',
            }}
          >
            <Image
              source={{
                uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarSeed}&size=90&backgroundColor=0D0B09`,
              }}
              style={{ width: '100%', height: '100%' }}
            />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <LinearGradient
            colors={['rgba(232,100,10,0.22)', 'rgba(232,100,10,0.08)', 'rgba(255,255,255,0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(232,100,10,0.18)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={{
                  uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarSeed}&size=120&backgroundColor=0D0B09`,
                }}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  marginRight: 14,
                  borderWidth: 2,
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
              />

              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 5 }}>
                  {headerUsername}
                </Text>
                <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                  Text them or drop a voice note when words need a little more feeling.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <View
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '700' }}>
                  Voice notes ready
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: 'rgba(232,100,10,0.12)',
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: 'rgba(232,100,10,0.18)',
                }}
              >
                <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '700' }}>
                  {lastMessageTime}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={Colors.orange} size="large" />
            <Text style={{ color: Colors.textSecondary, marginTop: 14, fontSize: 13 }}>
              Pulling your conversation together...
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 22 }}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 ? (
                <View
                  style={{
                    marginTop: 40,
                    borderRadius: 28,
                    padding: 24,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderWidth: 1,
                    borderColor: 'rgba(232,100,10,0.12)',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: 'rgba(232,100,10,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: Colors.orange, fontSize: 28, fontWeight: '300' }}>♪</Text>
                  </View>
                  <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>
                    Start with the vibe
                  </Text>
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 18 }}>
                    Say hey, swap a recommendation, or hold the mic and send a quick voice note.
                  </Text>

                  <View style={{ width: '100%' }}>
                    {starterPrompts.map((prompt) => (
                      <Pressable
                        key={prompt}
                        onPress={() => setDraft(prompt)}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 18,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderWidth: 1,
                          borderColor: 'rgba(255,255,255,0.08)',
                          marginBottom: 10,
                        }}
                      >
                        <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
                          {prompt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                messages.map((message, index) => {
                  const isMine = message.is_mine;
                  const previous = index > 0 ? messages[index - 1] : null;
                  const previousIsMine = previous?.is_mine;
                  const showDayPill =
                    !previous ||
                    formatDayPill(previous.created_at) !== formatDayPill(message.created_at);
                  const showAvatar = !isMine && (!previous || previousIsMine !== isMine);
                  const isVoice = message.message_type === 'voice' && !!message.audio_url;
                  const isPlayingThisVoice = playbackState.sourceId === message.id;
                  const currentDurationMs = isPlayingThisVoice
                    ? playbackState.durationMs || message.audio_duration_ms || 0
                    : message.audio_duration_ms || 0;
                  const currentProgress = isPlayingThisVoice && currentDurationMs > 0
                    ? Math.min(1, playbackState.positionMs / currentDurationMs)
                    : 0;

                  return (
                    <View key={message.id} style={{ marginTop: showDayPill ? 18 : 8 }}>
                      {showDayPill ? (
                        <View style={{ alignItems: 'center', marginBottom: 12 }}>
                          <View
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              borderRadius: 14,
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.08)',
                            }}
                          >
                            <Text style={{ color: Colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>
                              {formatDayPill(message.created_at)}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: isMine ? 'flex-end' : 'flex-start',
                          alignItems: 'flex-end',
                        }}
                      >
                        {!isMine ? (
                          <View style={{ width: 34, alignItems: 'center', marginRight: 8 }}>
                            {showAvatar ? (
                              <Image
                                source={{
                                  uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarSeed}&size=80&backgroundColor=0D0B09`,
                                }}
                                style={{ width: 28, height: 28, borderRadius: 14 }}
                              />
                            ) : (
                              <View style={{ width: 28 }} />
                            )}
                          </View>
                        ) : null}

                        <View style={{ maxWidth: isMine ? '82%' : '80%' }}>
                          {isVoice ? (
                            <View
                              style={{
                                borderRadius: 24,
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                                backgroundColor: isMine ? 'rgba(232,100,10,0.16)' : 'rgba(255,255,255,0.06)',
                                borderWidth: 1,
                                borderColor: isMine ? 'rgba(232,100,10,0.26)' : 'rgba(255,255,255,0.08)',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Pressable
                                  onPress={() => toggleVoicePlayback(message.id, message.audio_url!)}
                                  style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: 19,
                                    backgroundColor: isMine ? Colors.orange : 'rgba(255,255,255,0.1)',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                  }}
                                >
                                  <IconSymbol
                                    name={
                                      isPlayingThisVoice && playbackState.isPlaying
                                        ? 'pause.fill'
                                        : 'play.fill'
                                    }
                                    size={18}
                                    color={isMine ? Colors.white : Colors.textPrimary}
                                  />
                                </Pressable>

                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <VoiceWave progress={currentProgress} active={isPlayingThisVoice} />
                                  </View>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: isMine ? Colors.textPrimary : Colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                                      Voice note
                                    </Text>
                                    <Text style={{ color: isMine ? Colors.textSecondary : Colors.textMuted, fontSize: 12 }}>
                                      {formatDuration(
                                        isPlayingThisVoice && playbackState.positionMs > 0
                                          ? playbackState.positionMs
                                          : currentDurationMs
                                      )}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          ) : isMine ? (
                            <LinearGradient
                              colors={[Colors.orange, Colors.orangeDim]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{
                                borderRadius: 24,
                                paddingHorizontal: 15,
                                paddingVertical: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.1)',
                                shadowColor: Colors.orange,
                                shadowOpacity: 0.24,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 8 },
                              }}
                            >
                              <Text style={{ color: Colors.white, fontSize: 14, lineHeight: 20 }}>
                                {message.content}
                              </Text>
                            </LinearGradient>
                          ) : (
                            <View
                              style={{
                                borderRadius: 24,
                                paddingHorizontal: 15,
                                paddingVertical: 12,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                              }}
                            >
                              <Text style={{ color: Colors.textPrimary, fontSize: 14, lineHeight: 20 }}>
                                {message.content}
                              </Text>
                            </View>
                          )}

                          <Text
                            style={{
                              color: 'rgba(255,255,255,0.42)',
                              fontSize: 11,
                              marginTop: 6,
                              textAlign: isMine ? 'right' : 'left',
                              paddingHorizontal: 4,
                            }}
                          >
                            {formatTimestamp(message.created_at)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 22,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.05)',
                backgroundColor: 'rgba(13,11,9,0.22)',
              }}
            >
              {recordedVoiceNote ? (
                <View
                  style={{
                    marginBottom: 12,
                    borderRadius: 24,
                    padding: 14,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(232,100,10,0.14)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Pressable
                      onPress={() => toggleVoicePlayback('draft-voice', recordedVoiceNote.uri)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: Colors.orange,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <IconSymbol
                        name={
                          playbackState.sourceId === 'draft-voice' && playbackState.isPlaying
                            ? 'pause.fill'
                            : 'play.fill'
                        }
                        size={18}
                        color={Colors.white}
                      />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 8 }}>
                        Voice note ready
                      </Text>
                      <VoiceWave
                        progress={
                          playbackState.sourceId === 'draft-voice' && playbackState.durationMs > 0
                            ? Math.min(1, playbackState.positionMs / playbackState.durationMs)
                            : 0
                        }
                        active={playbackState.sourceId === 'draft-voice'}
                      />
                      <Text style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                        {formatDuration(recordedVoiceNote.durationMs)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable
                      onPress={discardRecordedVoice}
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
                      <Text style={{ color: Colors.textPrimary, fontSize: 13, fontWeight: '700' }}>
                        Discard
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={sendRecordedVoice}
                      disabled={uploadingVoice}
                      style={{
                        flex: 1,
                        backgroundColor: Colors.orange,
                        borderRadius: 18,
                        paddingVertical: 12,
                        alignItems: 'center',
                        opacity: uploadingVoice ? 0.72 : 1,
                      }}
                    >
                      {uploadingVoice ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '700' }}>
                          Send voice note
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View
                style={{
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: isRecording ? 'rgba(232,100,10,0.3)' : 'rgba(232,100,10,0.14)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 10,
                }}
              >
                <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 }}>
                  {isRecording ? 'RECORDING...' : 'SAY SOMETHING GOOD'}
                </Text>

                {isRecording ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#E74C3C',
                        marginRight: 10,
                      }}
                    />
                    <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 }}>
                      Recording voice note
                    </Text>
                    <Text style={{ color: Colors.orange, fontSize: 14, fontWeight: '700', marginRight: 10 }}>
                      {formatDuration(recordingDurationMs)}
                    </Text>
                    <Pressable
                      onPress={stopRecording}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#E74C3C',
                      }}
                    >
                      <IconSymbol name="stop.fill" size={18} color={Colors.white} />
                    </Pressable>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Drop a rec, ask a question, start the vibe..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      editable={!uploadingVoice}
                      style={{
                        flex: 1,
                        color: Colors.textPrimary,
                        fontSize: 15,
                        lineHeight: 21,
                        maxHeight: 120,
                        paddingTop: 2,
                        paddingBottom: 2,
                      }}
                    />

                    <Pressable
                      onPress={startRecording}
                      disabled={sending || uploadingVoice || !!recordedVoiceNote}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginLeft: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: recordedVoiceNote ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        opacity: recordedVoiceNote ? 0.35 : 1,
                      }}
                    >
                      <IconSymbol name="mic.fill" size={18} color={Colors.textPrimary} />
                    </Pressable>

                    <Pressable
                      onPress={handleSend}
                      disabled={!draft.trim() || sending || uploadingVoice}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginLeft: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: draft.trim() ? Colors.orange : 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        borderColor: draft.trim() ? Colors.orange : 'rgba(255,255,255,0.08)',
                        opacity: sending ? 0.72 : 1,
                      }}
                    >
                      {sending ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <IconSymbol
                          name="paperplane.fill"
                          size={18}
                          color={draft.trim() ? Colors.white : Colors.textMuted}
                        />
                      )}
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

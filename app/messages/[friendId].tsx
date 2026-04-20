//@ts-nocheck
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useUnlocks } from "@/contexts/UnlocksContext";
import { DirectMessage, DirectMessageTrack, api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync as setRecordingAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
} from "react-native";

const starterPrompts = [
  "What have you had on repeat lately?",
  "Send me your current obsession",
  "Need a recommendation tonight?",
];

function formatTimestamp(timestamp?: string) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDayPill(timestamp?: string) {
  if (!timestamp) {
    return "Now";
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
    return "Today";
  }

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDuration(durationMs?: number) {
  const totalSeconds = Math.max(0, Math.floor((durationMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildTrackReplyPreviewText(track?: DirectMessageTrack | null) {
  if (!track?.track_name) {
    return "Song reply";
  }

  return `Replying to ${track.track_name}`;
}

function VoiceWave({
  progress = 0,
  active = false,
}: {
  progress?: number;
  active?: boolean;
}) {
  const heights = [10, 16, 12, 18, 9, 15, 11, 17, 13, 8, 14, 10];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 3,
        flex: 1,
        minHeight: 20,
      }}
    >
      {heights.map((height, index) => {
        const threshold = (index + 1) / heights.length;
        const filled = progress >= threshold;

        return (
          <View
            key={`${height}-${index}`}
            style={{
              width: 3,
              height,
              borderRadius: 999,
              backgroundColor: filled
                ? Colors.orange
                : active
                  ? "rgba(255,255,255,0.35)"
                  : "rgba(255,255,255,0.16)",
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
  const { hasPerk, status } = useUnlocks();
  const {
    friendId,
    username,
    trackReplyActivityId,
    trackReplyTrackId,
    trackReplyTrackName,
    trackReplyArtistName,
    trackReplyAlbumName,
    trackReplyAlbumArtUrl,
    trackReplySpotifyUrl,
  } = useLocalSearchParams<{
    friendId: string;
    username?: string;
    trackReplyActivityId?: string;
    trackReplyTrackId?: string;
    trackReplyTrackName?: string;
    trackReplyArtistName?: string;
    trackReplyAlbumName?: string;
    trackReplyAlbumArtUrl?: string;
    trackReplySpotifyUrl?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [friend, setFriend] = useState<{
    id: string;
    username: string;
    avatar_id: string;
  } | null>(
    friendId
      ? {
          id: friendId,
          username: username || "Friend",
          avatar_id: "default",
        }
      : null,
  );
  const [draft, setDraft] = useState("");
  const [pendingTrackReply, setPendingTrackReply] =
    useState<DirectMessageTrack | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [recordedVoiceNote, setRecordedVoiceNote] = useState<{
    uri: string;
    durationMs: number;
  } | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [playbackSource, setPlaybackSource] = useState<string | null>(null);
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
  const activePlaybackSourceIdRef = useRef<string | null>(null);
  const pendingPlaybackSourceIdRef = useRef<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(playbackSource, {
    updateInterval: 100,
    downloadFirst: true,
    keepAudioSessionActive: true,
  });
  const playerStatus = useAudioPlayerStatus(player);
  const voiceNotesUnlocked = hasPerk("voice_notes");

  const ensurePlaybackAudioMode = async () => {
    await setRecordingAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    await setIsAudioActiveAsync(true);
  };

  const stopPlayback = async () => {
    try {
      player.pause();
    } catch {}
    activePlaybackSourceIdRef.current = null;
    pendingPlaybackSourceIdRef.current = null;
    setPlaybackSource(null);

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
      Alert.alert(
        "Unable to load chat",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThread();
  }, [friendId]);

  useEffect(() => {
    const trackName = trackReplyTrackName?.trim();
    const artistName = trackReplyArtistName?.trim();

    if (!trackName || !artistName) {
      setPendingTrackReply(null);
      return;
    }

    setPendingTrackReply({
      activity_id: trackReplyActivityId?.trim() || undefined,
      track_id: trackReplyTrackId?.trim() || undefined,
      track_name: trackName,
      artist_name: artistName,
      album_name: trackReplyAlbumName?.trim() || undefined,
      album_art_url: trackReplyAlbumArtUrl?.trim() || undefined,
      spotify_url: trackReplySpotifyUrl?.trim() || undefined,
    });
  }, [
    trackReplyActivityId,
    trackReplyAlbumArtUrl,
    trackReplyAlbumName,
    trackReplyArtistName,
    trackReplySpotifyUrl,
    trackReplyTrackId,
    trackReplyTrackName,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => clearTimeout(timeout);
  }, [messages.length, recordedVoiceNote?.uri]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  useEffect(() => {
    if (
      pendingPlaybackSourceIdRef.current &&
      activePlaybackSourceIdRef.current ===
        pendingPlaybackSourceIdRef.current &&
      playbackSource &&
      playerStatus.isLoaded
    ) {
      pendingPlaybackSourceIdRef.current = null;
      try {
        player.muted = false;
        player.volume = 1;
        player.play();
      } catch {}
    }
  }, [player, playbackSource, playerStatus.isLoaded]);

  useEffect(() => {
    if (!activePlaybackSourceIdRef.current) {
      return;
    }

    const durationMs = Math.max(
      0,
      Math.round((playerStatus.duration || 0) * 1000),
    );
    const positionMs = Math.max(
      0,
      Math.round((playerStatus.currentTime || 0) * 1000),
    );

    setPlaybackState({
      sourceId: activePlaybackSourceIdRef.current,
      isPlaying: playerStatus.playing,
      positionMs,
      durationMs,
    });

    if (
      playerStatus.didJustFinish ||
      (!playerStatus.playing &&
        playerStatus.currentTime >= playerStatus.duration &&
        playerStatus.duration > 0)
    ) {
      setPlaybackState({
        sourceId: activePlaybackSourceIdRef.current,
        isPlaying: false,
        positionMs: 0,
        durationMs,
      });
    }
  }, [
    playerStatus.currentTime,
    playerStatus.didJustFinish,
    playerStatus.duration,
    playerStatus.isLoaded,
    playerStatus.playing,
  ]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !friendId || sending || isRecording || uploadingVoice) {
      return;
    }

    const isTrackReplyMessage = !!pendingTrackReply;
    const pendingTrack = pendingTrackReply;

    const optimisticMessage: DirectMessage = {
      id: `temp-${Date.now()}`,
      sender_id: user?.id || "me",
      recipient_id: friendId,
      content,
      message_type: isTrackReplyMessage ? "track_reply" : "text",
      track_metadata: pendingTrack || undefined,
      created_at: new Date().toISOString(),
      is_mine: true,
    };

    setDraft("");
    if (isTrackReplyMessage) {
      setPendingTrackReply(null);
    }
    setSending(true);
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const created = await api.messages.send(
        friendId,
        isTrackReplyMessage && pendingTrack
          ? {
              content,
              message_type: "track_reply",
              track_metadata: pendingTrack,
            }
          : content,
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticMessage.id ? created : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
      Alert.alert(
        "Message failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      setDraft(content);
      if (isTrackReplyMessage && pendingTrack) {
        setPendingTrackReply(pendingTrack);
      }
    } finally {
      setSending(false);
    }
  };

  const openFriendProfile = () => {
    if (!friend?.id) {
      return;
    }

    router.push({
      pathname: "/profile/[userId]",
      params: { userId: friend.id },
    });
  };

  const startRecording = async () => {
    if (isRecording || sending || uploadingVoice) {
      return;
    }

    if (!voiceNotesUnlocked) {
      Alert.alert(
        "Voice notes are locked",
        "Unlock voice notes with 2 successful referrals from your voice note invite link.",
      );
      return;
    }

    try {
      await stopPlayback();
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone needed",
          "Please allow microphone access to record a voice note.",
        );
        return;
      }

      await setRecordingAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      setRecordedVoiceNote(null);
      setRecordingDurationMs(0);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (error) {
      Alert.alert(
        "Recording failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      setIsRecording(false);
      try {
        await setRecordingAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
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
      await setRecordingAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      await ensurePlaybackAudioMode();

      const uri = recorder.uri || recorderState.url;
      if (!uri) {
        throw new Error("No audio file was produced");
      }

      const durationMs = recorderState.durationMillis || recordingDurationMs;
      if (durationMs < 600) {
        setRecordingDurationMs(0);
        Alert.alert(
          "Too short",
          "Hold the mic a little longer to send a voice note.",
        );
        return;
      }

      setRecordedVoiceNote({ uri, durationMs });
      setRecordingDurationMs(0);
    } catch (error) {
      setIsRecording(false);
      setRecordingDurationMs(0);
      Alert.alert(
        "Recording failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const discardRecordedVoice = async () => {
    if (playbackState.sourceId === "draft-voice") {
      await stopPlayback();
    }
    setRecordedVoiceNote(null);
  };

  const uploadVoiceNote = async (uri: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const extensionMatch = uri.match(/\.(\w+)(?:\?|$)/);
    const extension = extensionMatch ? `.${extensionMatch[1]}` : ".m4a";
    const filePath = `${user?.id || "anonymous"}/${Date.now()}-${friendId}${extension}`;
    const contentType =
      blob.type || (extension === ".webm" ? "audio/webm" : "audio/mp4");

    const { error } = await supabase.storage
      .from("voice-notes")
      .upload(filePath, blob, {
        contentType,
        upsert: false,
      });
    if (error) {
      throw error;
    }

    // Return a full public URL — the voice-notes bucket is public so no signing needed.
    // Storing the full URL means playback never needs any resolution at play time.
    const { data: urlData } = supabase.storage
      .from("voice-notes")
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const resolvePlayableVoiceURI = (uri: string): string => {
    if (!uri) {
      return uri;
    }

    const trimmed = uri.trim();

    // Local recording (just captured, not yet uploaded) — play the file directly.
    if (
      trimmed.startsWith("file://") ||
      trimmed.startsWith("content://") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:")
    ) {
      return trimmed;
    }

    // Already a full https/http URL (public URL stored after upload) — use it directly.
    // The voice-notes bucket is public so no signed URL is required.
    if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
      return trimmed;
    }

    // Legacy: relative object path stored in DB (e.g. "userId/timestamp.m4a").
    // Construct the public URL synchronously — getPublicUrl never fails for public buckets.
    const { data } = supabase.storage.from("voice-notes").getPublicUrl(trimmed);
    return data.publicUrl;
  };

  const sendRecordedVoice = async () => {
    if (!recordedVoiceNote || !friendId || uploadingVoice || sending) {
      return;
    }

    if (!voiceNotesUnlocked) {
      Alert.alert(
        "Voice notes are locked",
        "Unlock voice notes with 2 successful referrals from your voice note invite link.",
      );
      return;
    }

    const localVoice = recordedVoiceNote;
    const optimisticMessage: DirectMessage = {
      id: `voice-${Date.now()}`,
      sender_id: user?.id || "me",
      recipient_id: friendId,
      content: "Voice note",
      message_type: "voice",
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
        content: "Voice note",
        message_type: "voice",
        audio_url: audioURL,
        audio_duration_ms: localVoice.durationMs,
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticMessage.id ? created : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id),
      );
      setRecordedVoiceNote(localVoice);
      Alert.alert(
        "Voice note failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setUploadingVoice(false);
    }
  };

  const toggleVoicePlayback = async (sourceId: string, uri: string) => {
    if (!uri) {
      return;
    }

    try {
      // resolvePlayableVoiceURI is now synchronous — no await needed.
      const playableURI = resolvePlayableVoiceURI(uri);
      await ensurePlaybackAudioMode();

      if (playbackState.sourceId === sourceId) {
        if (!playerStatus.isLoaded) {
          await stopPlayback();
          return;
        }

        if (playerStatus.playing) {
          player.pause();
        } else {
          player.muted = false;
          player.volume = 1;
          if (
            playerStatus.duration > 0 &&
            playerStatus.currentTime >= playerStatus.duration
          ) {
            await player.seekTo(0);
            player.play();
          } else {
            player.play();
          }
        }
        return;
      }

      await stopPlayback();
      activePlaybackSourceIdRef.current = sourceId;
      pendingPlaybackSourceIdRef.current = sourceId;
      setPlaybackSource(playableURI);
      setPlaybackState({
        sourceId,
        isPlaying: false,
        positionMs: 0,
        durationMs: 0,
      });
    } catch (error) {
      Alert.alert(
        "Playback failed",
        error instanceof Error ? error.message : "Please try again.",
      );
      await stopPlayback();
    }
  };

  useEffect(() => {
    if (isRecording || recorderState.isRecording) {
      setRecordingDurationMs(recorderState.durationMillis || 0);
    }
  }, [isRecording, recorderState.durationMillis, recorderState.isRecording]);

  const lastMessageTime =
    messages.length > 0
      ? formatTimestamp(messages[messages.length - 1]?.created_at)
      : "New thread";
  const headerUsername = friend?.username || username || "Friend";
  const avatarSeed = friend?.avatar_id || "default";

  return (
    <View style={{ flex: 1, backgroundColor: "#0D0B09" }}>
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&h=1200&fit=crop",
        }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        blurRadius={32}
      />
      <LinearGradient
        colors={[
          "rgba(13,11,9,0.72)",
          "rgba(13,11,9,0.84)",
          "rgba(13,11,9,0.9)",
        ]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <View
        style={{
          position: "absolute",
          width: 260,
          height: 260,
          borderRadius: 130,
          top: -50,
          right: -70,
          backgroundColor: "rgba(232,100,10,0.12)",
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: 90,
          bottom: 120,
          left: -40,
          backgroundColor: "rgba(255,255,255,0.03)",
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 18 : 0}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
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
              backgroundColor: "rgba(255,255,255,0.06)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(232,100,10,0.18)",
            }}
          >
            <IconSymbol
              name="chevron.left"
              size={18}
              color={Colors.textPrimary}
            />
          </Pressable>

          <View style={{ alignItems: "center" }}>
            {/* <Text style={{ color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase' }}>
              Chen Chat
            </Text> */}
            <Text
              style={{
                color: Colors.textPrimary,
                fontSize: 18,
                fontWeight: "800",
                marginTop: 5,
              }}
            >
              {headerUsername}
            </Text>
          </View>

          <Pressable
            onPress={openFriendProfile}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: "rgba(232,100,10,0.28)",
            }}
          >
            <Image
              source={{
                uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarSeed}&size=90&backgroundColor=0D0B09`,
              }}
              style={{ width: "100%", height: "100%" }}
            />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
          <LinearGradient
            colors={[
              "rgba(232,100,10,0.22)",
              "rgba(232,100,10,0.08)",
              "rgba(255,255,255,0.03)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(232,100,10,0.18)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              />

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: Colors.textPrimary,
                    fontSize: 20,
                    fontWeight: "800",
                    marginBottom: 5,
                  }}
                >
                  {headerUsername}
                </Text>
                <Text
                  style={{
                    color: Colors.textSecondary,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  {voiceNotesUnlocked
                    ? "Text them or drop a voice note when words need a little more feeling."
                    : "Text them now. Voice notes unlock after 2 successful referrals."}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                }}
              >
                <Text
                  style={{
                    color: Colors.textPrimary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {voiceNotesUnlocked
                    ? "Voice notes ready"
                    : `${status?.perks?.find((perk) => perk.key === "voice_notes")?.completed_referrals || 0}/2 to unlock voice notes`}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "rgba(232,100,10,0.12)",
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: "rgba(232,100,10,0.18)",
                }}
              >
                <Text
                  style={{
                    color: Colors.orange,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {lastMessageTime}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {loading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={Colors.orange} size="large" />
            <Text
              style={{
                color: Colors.textSecondary,
                marginTop: 14,
                fontSize: 13,
              }}
            >
              Pulling your conversation together...
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 22,
              }}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 ? (
                <View
                  style={{
                    marginTop: 40,
                    borderRadius: 28,
                    padding: 24,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderWidth: 1,
                    borderColor: "rgba(232,100,10,0.12)",
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: "rgba(232,100,10,0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.orange,
                        fontSize: 28,
                        fontWeight: "300",
                      }}
                    >
                      ♪
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: Colors.textPrimary,
                      fontSize: 20,
                      fontWeight: "800",
                      marginBottom: 8,
                    }}
                  >
                    Start with the vibe
                  </Text>
                  <Text
                    style={{
                      color: Colors.textSecondary,
                      fontSize: 13,
                      textAlign: "center",
                      lineHeight: 20,
                      marginBottom: 18,
                    }}
                  >
                    {voiceNotesUnlocked
                      ? "Say hey, swap a recommendation, or hold the mic and send a quick voice note."
                      : "Say hey, swap a recommendation, and unlock voice notes later with 2 referrals."}
                  </Text>

                  <View style={{ width: "100%" }}>
                    {starterPrompts.map((prompt) => (
                      <Pressable
                        key={prompt}
                        onPress={() => setDraft(prompt)}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          borderRadius: 18,
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.08)",
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: Colors.textPrimary,
                            fontSize: 13,
                            fontWeight: "600",
                          }}
                        >
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
                    formatDayPill(previous.created_at) !==
                      formatDayPill(message.created_at);
                  const showAvatar =
                    !isMine && (!previous || previousIsMine !== isMine);
                  const isVoice =
                    message.message_type === "voice" && !!message.audio_url;
                  const isTrackReply =
                    message.message_type === "track_reply" &&
                    !!message.track_metadata?.track_name;
                  const isPlayingThisVoice =
                    playbackState.sourceId === message.id;
                  const currentDurationMs = isPlayingThisVoice
                    ? playbackState.durationMs || message.audio_duration_ms || 0
                    : message.audio_duration_ms || 0;
                  const currentProgress =
                    isPlayingThisVoice && currentDurationMs > 0
                      ? Math.min(
                          1,
                          playbackState.positionMs / currentDurationMs,
                        )
                      : 0;
                  const voiceDisplayMs =
                    isPlayingThisVoice && playbackState.positionMs > 0
                      ? playbackState.positionMs
                      : currentDurationMs;

                  return (
                    <View
                      key={message.id}
                      style={{ marginTop: showDayPill ? 18 : 8 }}
                    >
                      {showDayPill ? (
                        <View
                          style={{ alignItems: "center", marginBottom: 12 }}
                        >
                          <View
                            style={{
                              backgroundColor: "rgba(255,255,255,0.06)",
                              borderRadius: 14,
                              paddingHorizontal: 12,
                              paddingVertical: 7,
                              borderWidth: 1,
                              borderColor: "rgba(255,255,255,0.08)",
                            }}
                          >
                            <Text
                              style={{
                                color: Colors.textSecondary,
                                fontSize: 11,
                                fontWeight: "700",
                                letterSpacing: 1,
                              }}
                            >
                              {formatDayPill(message.created_at)}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: isMine ? "flex-end" : "flex-start",
                          alignItems: "flex-end",
                        }}
                      >
                        {!isMine ? (
                          <View
                            style={{
                              width: 34,
                              alignItems: "center",
                              marginRight: 8,
                            }}
                          >
                            {showAvatar ? (
                              <Image
                                source={{
                                  uri: `https://api.dicebear.com/7.x/adventurer/png?seed=${avatarSeed}&size=80&backgroundColor=0D0B09`,
                                }}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                }}
                              />
                            ) : (
                              <View style={{ width: 28 }} />
                            )}
                          </View>
                        ) : null}

                        <View style={{ maxWidth: isMine ? "82%" : "80%" }}>
                          {isVoice ? (
                            <View
                              style={{
                                minWidth: 220,
                                borderRadius: 26,
                                padding: 10,
                                backgroundColor: isMine
                                  ? "rgba(232,100,10,0.16)"
                                  : "rgba(255,255,255,0.06)",
                                borderWidth: 1,
                                borderColor: isMine
                                  ? "rgba(232,100,10,0.28)"
                                  : "rgba(255,255,255,0.08)",
                                shadowColor: isMine ? Colors.orange : "#000",
                                shadowOpacity: isMine ? 0.18 : 0.1,
                                shadowRadius: 14,
                                shadowOffset: { width: 0, height: 8 },
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <Pressable
                                  onPress={() =>
                                    toggleVoicePlayback(
                                      message.id,
                                      message.audio_url!,
                                    )
                                  }
                                  style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: 23,
                                    backgroundColor: isMine
                                      ? Colors.orange
                                      : "rgba(255,255,255,0.1)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 12,
                                    borderWidth: 1,
                                    borderColor: isMine
                                      ? "rgba(255,255,255,0.12)"
                                      : "rgba(255,255,255,0.08)",
                                  }}
                                >
                                  <IconSymbol
                                    name={
                                      isPlayingThisVoice &&
                                      playbackState.isPlaying
                                        ? "pause.fill"
                                        : "play.fill"
                                    }
                                    size={20}
                                    color={
                                      isMine ? Colors.white : Colors.textPrimary
                                    }
                                  />
                                </Pressable>

                                <View style={{ flex: 1 }}>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: 10,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: Colors.textPrimary,
                                        fontSize: 13,
                                        fontWeight: "800",
                                        letterSpacing: 0.2,
                                      }}
                                    >
                                      Voice note
                                    </Text>
                                    <View
                                      style={{
                                        borderRadius: 999,
                                        paddingHorizontal: 9,
                                        paddingVertical: 4,
                                        backgroundColor: isMine
                                          ? "rgba(255,255,255,0.1)"
                                          : "rgba(255,255,255,0.05)",
                                        borderWidth: 1,
                                        borderColor: isMine
                                          ? "rgba(255,255,255,0.08)"
                                          : "rgba(255,255,255,0.06)",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: isMine
                                            ? "rgba(255,255,255,0.84)"
                                            : Colors.textSecondary,
                                          fontSize: 11,
                                          fontWeight: "700",
                                        }}
                                      >
                                        {formatDuration(voiceDisplayMs)}
                                      </Text>
                                    </View>
                                  </View>
                                  <View
                                    style={{
                                      borderRadius: 16,
                                      paddingHorizontal: 12,
                                      paddingVertical: 10,
                                      backgroundColor: isMine
                                        ? "rgba(0,0,0,0.12)"
                                        : "rgba(255,255,255,0.04)",
                                      borderWidth: 1,
                                      borderColor: isMine
                                        ? "rgba(255,255,255,0.08)"
                                        : "rgba(255,255,255,0.05)",
                                    }}
                                  >
                                    <VoiceWave
                                      progress={currentProgress}
                                      active={isPlayingThisVoice}
                                    />
                                  </View>
                                  <View
                                    style={{
                                      flexDirection: "row",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginTop: 8,
                                      paddingHorizontal: 2,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: isMine
                                          ? "rgba(255,255,255,0.7)"
                                          : Colors.textMuted,
                                        fontSize: 11,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isPlayingThisVoice &&
                                      playbackState.isPlaying
                                        ? "Playing now"
                                        : "Tap to listen"}
                                    </Text>
                                    <Text
                                      style={{
                                        color: isMine
                                          ? "rgba(255,255,255,0.74)"
                                          : Colors.textMuted,
                                        fontSize: 11,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isPlayingThisVoice
                                        ? playbackState.isPlaying
                                          ? "Live"
                                          : "Paused"
                                        : "Ready"}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                          ) : isTrackReply ? (
                            <View>
                              <View
                                style={{
                                  borderRadius: 24,
                                  padding: 13,
                                  backgroundColor: "rgba(255,255,255,0.06)",
                                  borderWidth: 1,
                                  borderColor: isMine
                                    ? "rgba(232,100,10,0.22)"
                                    : "rgba(255,255,255,0.08)",
                                  shadowColor: isMine ? Colors.orange : "#000",
                                  shadowOpacity: isMine ? 0.16 : 0.1,
                                  shadowRadius: 14,
                                  shadowOffset: { width: 0, height: 8 },
                                }}
                              >
                                <Text
                                  style={{
                                    color: isMine
                                      ? Colors.orange
                                      : Colors.textMuted,
                                    fontSize: 11,
                                    fontWeight: "800",
                                    letterSpacing: 0.6,
                                    textTransform: "uppercase",
                                    marginBottom: 10,
                                  }}
                                >
                                  Song reply
                                </Text>

                                <View>
                                  {message.track_metadata?.album_art_url ? (
                                    <Image
                                      source={{
                                        uri: message.track_metadata
                                          .album_art_url,
                                      }}
                                      style={{
                                        width: "100%",
                                        aspectRatio: 1,
                                        borderRadius: 22,
                                        marginBottom: 14,
                                      }}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View
                                      style={{
                                        width: "100%",
                                        aspectRatio: 1,
                                        borderRadius: 22,
                                        marginBottom: 14,
                                        backgroundColor:
                                          "rgba(255,255,255,0.08)",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: Colors.textPrimary,
                                          fontSize: 34,
                                          fontWeight: "700",
                                        }}
                                      >
                                        ♪
                                      </Text>
                                    </View>
                                  )}

                                  <Text
                                    style={{
                                      color: Colors.textPrimary,
                                      fontSize: 18,
                                      lineHeight: 23,
                                      fontWeight: "900",
                                    }}
                                  >
                                    {message.track_metadata?.track_name}
                                  </Text>
                                  <Text
                                    style={{
                                      color: Colors.textSecondary,
                                      fontSize: 14,
                                      lineHeight: 19,
                                      marginTop: 6,
                                      fontWeight: "700",
                                    }}
                                  >
                                    {message.track_metadata?.artist_name}
                                  </Text>
                                  {message.track_metadata?.album_name ? (
                                    <Text
                                      style={{
                                        color: Colors.textMuted,
                                        fontSize: 12,
                                        lineHeight: 17,
                                        marginTop: 6,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {message.track_metadata.album_name}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              <View
                                style={{
                                  marginTop: 8,
                                  alignSelf: isMine ? "flex-end" : "flex-start",
                                  maxWidth: "92%",
                                }}
                              >
                                {isMine ? (
                                  <LinearGradient
                                    colors={[Colors.orange, Colors.orangeDim]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={{
                                      borderRadius: 22,
                                      paddingHorizontal: 15,
                                      paddingVertical: 12,
                                      borderWidth: 1,
                                      borderColor: "rgba(255,255,255,0.1)",
                                      shadowColor: Colors.orange,
                                      shadowOpacity: 0.2,
                                      shadowRadius: 12,
                                      shadowOffset: { width: 0, height: 6 },
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: Colors.white,
                                        fontSize: 14,
                                        lineHeight: 20,
                                      }}
                                    >
                                      {message.content}
                                    </Text>
                                  </LinearGradient>
                                ) : (
                                  <View
                                    style={{
                                      borderRadius: 22,
                                      paddingHorizontal: 15,
                                      paddingVertical: 12,
                                      backgroundColor: "rgba(255,255,255,0.06)",
                                      borderWidth: 1,
                                      borderColor: "rgba(255,255,255,0.08)",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: Colors.textPrimary,
                                        fontSize: 14,
                                        lineHeight: 20,
                                      }}
                                    >
                                      {message.content}
                                    </Text>
                                  </View>
                                )}
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
                                borderColor: "rgba(255,255,255,0.1)",
                                shadowColor: Colors.orange,
                                shadowOpacity: 0.24,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 8 },
                              }}
                            >
                              <Text
                                style={{
                                  color: Colors.white,
                                  fontSize: 14,
                                  lineHeight: 20,
                                }}
                              >
                                {message.content}
                              </Text>
                            </LinearGradient>
                          ) : (
                            <View
                              style={{
                                borderRadius: 24,
                                paddingHorizontal: 15,
                                paddingVertical: 12,
                                backgroundColor: "rgba(255,255,255,0.06)",
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.08)",
                              }}
                            >
                              <Text
                                style={{
                                  color: Colors.textPrimary,
                                  fontSize: 14,
                                  lineHeight: 20,
                                }}
                              >
                                {message.content}
                              </Text>
                            </View>
                          )}

                          <Text
                            style={{
                              color: "rgba(255,255,255,0.42)",
                              fontSize: 11,
                              marginTop: 6,
                              textAlign: isMine ? "right" : "left",
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
                borderTopColor: "rgba(255,255,255,0.05)",
                backgroundColor: "rgba(13,11,9,0.22)",
              }}
            >
              {recordedVoiceNote ? (
                <View
                  style={{
                    marginBottom: 12,
                    borderRadius: 24,
                    padding: 14,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(232,100,10,0.14)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable
                      onPress={() =>
                        toggleVoicePlayback(
                          "draft-voice",
                          recordedVoiceNote.uri,
                        )
                      }
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: Colors.orange,
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <IconSymbol
                        name={
                          playbackState.sourceId === "draft-voice" &&
                          playbackState.isPlaying
                            ? "pause.fill"
                            : "play.fill"
                        }
                        size={18}
                        color={Colors.white}
                      />
                    </Pressable>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 14,
                          fontWeight: "700",
                          marginBottom: 8,
                        }}
                      >
                        Voice note ready
                      </Text>
                      <VoiceWave
                        progress={
                          playbackState.sourceId === "draft-voice" &&
                          playbackState.durationMs > 0
                            ? Math.min(
                                1,
                                playbackState.positionMs /
                                  playbackState.durationMs,
                              )
                            : 0
                        }
                        active={playbackState.sourceId === "draft-voice"}
                      />
                      <Text
                        style={{
                          color: Colors.textSecondary,
                          fontSize: 12,
                          marginTop: 8,
                        }}
                      >
                        {formatDuration(recordedVoiceNote.durationMs)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{ flexDirection: "row", gap: 10, marginTop: 14 }}
                  >
                    <Pressable
                      onPress={discardRecordedVoice}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderRadius: 18,
                        paddingVertical: 12,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 13,
                          fontWeight: "700",
                        }}
                      >
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
                        alignItems: "center",
                        opacity: uploadingVoice ? 0.72 : 1,
                      }}
                    >
                      {uploadingVoice ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                      ) : (
                        <Text
                          style={{
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: "700",
                          }}
                        >
                          Send voice note
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {pendingTrackReply ? (
                <View
                  style={{
                    marginBottom: 12,
                    borderRadius: 24,
                    padding: 14,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(232,100,10,0.16)",
                  }}
                >
                  <View
                    style={{ flexDirection: "row", alignItems: "flex-start" }}
                  >
                    {pendingTrackReply.album_art_url ? (
                      <Image
                        source={{ uri: pendingTrackReply.album_art_url }}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          marginRight: 12,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          marginRight: 12,
                          backgroundColor: "rgba(255,255,255,0.08)",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.08)",
                        }}
                      >
                        <Text
                          style={{
                            color: Colors.textPrimary,
                            fontSize: 20,
                            fontWeight: "700",
                          }}
                        >
                          ♪
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: Colors.orange,
                          fontSize: 11,
                          fontWeight: "800",
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        {buildTrackReplyPreviewText(pendingTrackReply)}
                      </Text>
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 15,
                          fontWeight: "800",
                          marginTop: 5,
                        }}
                      >
                        {pendingTrackReply.track_name}
                      </Text>
                      <Text
                        style={{
                          color: Colors.textSecondary,
                          fontSize: 12,
                          marginTop: 2,
                        }}
                      >
                        {pendingTrackReply.artist_name}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setPendingTrackReply(null)}
                      hitSlop={8}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      <Text
                        style={{
                          color: Colors.textPrimary,
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        ×
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View
                style={{
                  borderRadius: 28,
                  borderWidth: 1,
                  borderColor: isRecording
                    ? "rgba(232,100,10,0.3)"
                    : "rgba(232,100,10,0.14)",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  paddingHorizontal: 14,
                  paddingTop: 12,
                  paddingBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: Colors.textMuted,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1.1,
                    marginBottom: 8,
                  }}
                >
                  {isRecording ? "RECORDING..." : "SAY SOMETHING GOOD"}
                </Text>

                {isRecording ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: "#E74C3C",
                        marginRight: 10,
                      }}
                    />
                    <Text
                      style={{
                        color: Colors.textPrimary,
                        fontSize: 16,
                        fontWeight: "700",
                        flex: 1,
                      }}
                    >
                      Recording voice note
                    </Text>
                    <Text
                      style={{
                        color: Colors.orange,
                        fontSize: 14,
                        fontWeight: "700",
                        marginRight: 10,
                      }}
                    >
                      {formatDuration(recordingDurationMs)}
                    </Text>
                    <Pressable
                      onPress={stopRecording}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#E74C3C",
                      }}
                    >
                      <IconSymbol
                        name="stop.fill"
                        size={18}
                        color={Colors.white}
                      />
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={{ flexDirection: "row", alignItems: "flex-end" }}
                  >
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder={
                        pendingTrackReply
                          ? "Tell them what this song is doing to you..."
                          : "Drop a rec, ask a question, start the vibe..."
                      }
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
                      disabled={
                        sending ||
                        uploadingVoice ||
                        !!recordedVoiceNote ||
                        !!pendingTrackReply
                      }
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginLeft: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: recordedVoiceNote
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(255,255,255,0.08)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.08)",
                        opacity:
                          recordedVoiceNote || pendingTrackReply
                            ? 0.35
                            : voiceNotesUnlocked
                              ? 1
                              : 0.55,
                      }}
                    >
                      <IconSymbol
                        name="mic.fill"
                        size={18}
                        color={Colors.textPrimary}
                      />
                    </Pressable>

                    <Pressable
                      onPress={handleSend}
                      disabled={!draft.trim() || sending || uploadingVoice}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        marginLeft: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: draft.trim()
                          ? Colors.orange
                          : "rgba(255,255,255,0.08)",
                        borderWidth: 1,
                        borderColor: draft.trim()
                          ? Colors.orange
                          : "rgba(255,255,255,0.08)",
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

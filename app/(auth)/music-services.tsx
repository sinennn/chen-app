//@ts-nocheck
import * as AuthSession from "expo-auth-session";
import { useAuth } from "@/contexts/AuthContext";
import { useUnlocks } from "@/contexts/UnlocksContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { api } from "@/lib/api";
import { completeReferralOnboarding } from "@/lib/referrals";
import {
  clearPendingSpotifyConnect,
  SPOTIFY_REDIRECT_URI,
  storePendingSpotifyConnect,
} from "@/lib/spotifyAuth";
import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-top-read",
].join(" ");

const discovery = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

export default function MusicServicesScreen() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { refreshStatus } = useUnlocks();
  const { avatarSeed, username } = useLocalSearchParams<{
    avatarSeed: string;
    username: string;
  }>();
  const [loading, setLoading] = useState(false);
  const normalizedUsername =
    typeof username === "string" ? username.trim().toLowerCase() : "";
  const normalizedAvatarSeed = typeof avatarSeed === "string" ? avatarSeed : "";

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SCOPES.split(" "),
      redirectUri: SPOTIFY_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
    },
    discovery,
  );

  useEffect(() => {
    if (normalizedAvatarSeed && !normalizedUsername) {
      router.replace("/(auth)/username");
    }
  }, [normalizedAvatarSeed, normalizedUsername, router]);

  useEffect(() => {
    if (response?.type === "success") {
      const { code } = response.params;
      if (code) {
        exchangeCodeForTokens(code);
      }
    } else if (response?.type === "error") {
      Alert.alert(
        "Connection Error",
        "Spotify authorization failed. Please try again.",
      );
      setLoading(false);
    } else if (response?.type === "cancel" || response?.type === "dismiss") {
      setLoading(false);
    }
  }, [response]);

  const finalizeOnboarding = async () => {
    try {
      await completeReferralOnboarding();
      await Promise.allSettled([refreshProfile(), refreshStatus()]);
    } catch (error) {
      console.error(
        "MusicServices: Failed to finalize referral onboarding",
        error,
      );
    } finally {
      router.replace("/(tabs)");
    }
  };

  const exchangeCodeForTokens = async (code: string) => {
    try {
      // Token exchange happens server-side — the client secret never leaves the backend.
      await api.spotify.exchangeCode(
        code,
        SPOTIFY_REDIRECT_URI,
        normalizedUsername || undefined,
        normalizedAvatarSeed || undefined,
      );

      await clearPendingSpotifyConnect();
      await finalizeOnboarding();
    } catch (error) {
      console.error("Token exchange error:", error);
      Alert.alert(
        "Connection Error",
        "Failed to connect Spotify. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSpotifyConnect = async () => {
    if (!SPOTIFY_CLIENT_ID) {
      Alert.alert("Configuration Error", "Spotify client ID not configured");
      return;
    }
    setLoading(true);
    await storePendingSpotifyConnect({
      username: normalizedUsername || undefined,
      avatarSeed: normalizedAvatarSeed || undefined,
    });
    await promptAsync();
  };

  const handleSkip = async () => {
    try {
      if (normalizedAvatarSeed && !normalizedUsername) {
        router.replace("/(auth)/username");
        return;
      }

      if (normalizedAvatarSeed || normalizedUsername) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const updateData: Record<string, string> = {};

          if (normalizedAvatarSeed) updateData.avatar_id = normalizedAvatarSeed;
          if (normalizedUsername) updateData.username = normalizedUsername;

          await supabase.from("users").update(updateData).eq("id", user.id);
        }
      }
      await finalizeOnboarding();
    } catch (error) {
      console.error("Skip error:", error);
      router.replace("/(tabs)");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View className="flex-1">
        <Image
          source={require("@/assets/onboarding/welcome.jpg")}
          resizeMode="cover"
          style={{ position: "absolute", inset: 0 }}
        />
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.60)",
          }}
        />

        <ScrollView
          className="flex-1 px-6 pt-16"
          showsVerticalScrollIndicator={false}
        >
          <Text
            className="mb-2 text-3xl font-semibold pt-10"
            style={{ color: Colors.textPrimary }}
          >
            Connect Your Music
          </Text>
          <Text
            className="mb-12 text-sm"
            style={{ color: "rgba(255,255,255,0.70)" }}
          >
            Connect Spotify to share your music taste with friends
          </Text>

          <View className="flex-1 items-center justify-center">
            <Pressable
              onPress={handleSpotifyConnect}
              disabled={loading || !request}
              style={{
                width: 200,
                height: 200,
                borderRadius: 30,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#1DB954",
                shadowColor: "#1DB954",
                shadowOpacity: 0.4,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                opacity: loading || !request ? 0.6 : 1,
              }}
            >
              <Image
                source={require("@/assets/onboarding/spotify.png")}
                style={{ width: 80, height: 80, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text
                className="text-xl font-semibold"
                style={{ color: "white" }}
              >
                {loading ? "Connecting..." : "Connect Spotify"}
              </Text>
            </Pressable>
          </View>

          <View className="items-center pb-8 pt-16">
            <Pressable onPress={handleSkip} disabled={loading}>
              <Text
                className="text-base font-medium underline"
                style={{
                  color: loading
                    ? "rgba(255,255,255,0.4)"
                    : "rgba(255,255,255,0.7)",
                }}
              >
                Skip for now
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

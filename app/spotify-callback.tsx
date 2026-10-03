import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useUnlocks } from '@/contexts/UnlocksContext';
import { api } from '@/lib/api';
import { completeReferralOnboarding } from '@/lib/referrals';
import {
  clearPendingSpotifyConnect,
  getPendingSpotifyConnect,
  SPOTIFY_REDIRECT_URI,
} from '@/lib/spotifyAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef } from 'react';
import {
  //@ts-ignore
  ActivityIndicator,
  //@ts-ignore
  Alert,
  //@ts-ignore
  Text,
  //@ts-ignore
  View
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Reached when Android suspends the app while the user is on Spotify's login
// page: the redirect lands as a cold-start deep link instead of resolving the
// in-memory AuthSession promise in music-services.tsx, so this route finishes
// the token exchange itself using state persisted before the browser opened.
export default function SpotifyCallback() {
  const router = useRouter();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const { refreshStatus } = useUnlocks();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || authLoading) {
      return;
    }
    handledRef.current = true;

    const run = async () => {
      if (error || !code) {
        Alert.alert('Connection Error', 'Spotify authorization failed. Please try again.');
        router.replace(user ? '/(auth)/music-services' : '/(auth)/welcome');
        return;
      }

      if (!user) {
        Alert.alert('Session Expired', 'Please sign in again to connect Spotify.');
        router.replace('/(auth)/welcome');
        return;
      }

      try {
        const pending = await getPendingSpotifyConnect();
        await api.spotify.exchangeCode(code, SPOTIFY_REDIRECT_URI, pending?.username, pending?.avatarSeed);
        await clearPendingSpotifyConnect();

        try {
          await completeReferralOnboarding();
        } catch (onboardingError) {
          console.error('SpotifyCallback: Failed to finalize referral onboarding', onboardingError);
        }
        await Promise.allSettled([refreshProfile(), refreshStatus()]);

        router.replace('/(tabs)');
      } catch (exchangeError) {
        console.error('SpotifyCallback: Token exchange error', exchangeError);
        Alert.alert('Connection Error', 'Failed to connect Spotify. Please try again.');
        router.replace('/(auth)/music-services');
      }
    };

    run();
  }, [authLoading, code, error, refreshProfile, refreshStatus, router, user]);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: Colors.bg }}>
      <ActivityIndicator size="large" color={Colors.orange} />
      <Text className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
        Connecting Spotify...
      </Text>
    </View>
  );
}

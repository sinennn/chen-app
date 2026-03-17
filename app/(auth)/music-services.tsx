import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View
} from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function MusicServicesScreen() {
  const router = useRouter();
  const { avatarSeed } = useLocalSearchParams<{ avatarSeed: string }>();
  const [loading, setLoading] = useState(false);

  const handleSpotifyConnect = async () => {
    setLoading(true);
    try {
      const redirectUri = makeRedirectUri();
      const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
      
      if (!clientId) {
        Alert.alert('Configuration Error', 'Spotify client ID not configured');
        return;
      }

      const scopes = [
        'user-read-currently-playing',
        'user-read-playback-state', 
        'user-read-recently-played',
        'user-top-read'
      ].join(' ');

      const authUrl = `https://accounts.spotify.com/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}`;

      const result = await AuthSession.startAsync({ authUrl });

      if (result.type === 'success' && result.params.code) {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: result.params.code,
            redirect_uri: redirectUri,
            client_id: clientId,
          }).toString(),
        });

        const tokens = await tokenResponse.json();

        if (tokens.access_token) {
          // Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('No authenticated user');

          // Store Spotify tokens
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
          await supabase.from('spotify_connections').upsert({
            user_id: user.id,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: expiresAt,
          });

          // Save avatar seed to users table
          if (avatarSeed) {
            await supabase.from('users').update({
              avatar_id: avatarSeed
            }).eq('id', user.id);
          }

          router.replace('/(tabs)');
        } else {
          throw new Error('Failed to get access token');
        }
      }
    } catch (error) {
      console.error('Spotify connection error:', error);
      Alert.alert('Connection Error', 'Failed to connect to Spotify. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Save avatar seed even if skipping Spotify
      if (avatarSeed) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('users').update({
            avatar_id: avatarSeed
          }).eq('id', user.id);
        }
      }
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Skip error:', error);
      router.replace('/(tabs)');
    }
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1">
        <Image
          source={require('@/assets/onboarding/welcome.jpg')}
          resizeMode="cover"
          style={{ position: 'absolute', inset: 0 }}
        />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.60)' }} />

        <ScrollView className="flex-1 px-6 pt-16" showsVerticalScrollIndicator={false}>
          <Text className="mb-2 text-3xl font-semibold pt-10" style={{ color: Colors.textPrimary }}>
            Connect Your Music
          </Text>
          <Text className="mb-12 text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
            Connect Spotify to share your music taste with friends
          </Text>

          {/* Centered Spotify Card */}
          <View className="flex-1 items-center justify-center">
            <Pressable
              onPress={handleSpotifyConnect}
              disabled={loading}
              style={{
                width: 200,
                height: 200,
                borderRadius: 30,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1DB954',
                shadowColor: '#1DB954',
                shadowOpacity: 0.4,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Image
                source={require('@/assets/onboarding/spotify.png')}
                style={{ width: 80, height: 80, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text 
                className="text-xl font-semibold" 
                style={{ color: 'white' }}
              >
                {loading ? 'Connecting...' : 'Connect Spotify'}
              </Text>
            </Pressable>
          </View>

          {/* Skip for now link */}
          <View className="items-center pb-8 pt-16">
            <Pressable onPress={handleSkip} disabled={loading}>
              <Text 
                className="text-base font-medium underline" 
                style={{ 
                  color: loading ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)' 
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
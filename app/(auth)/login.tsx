import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  //@ts-ignore
  Alert,
  //@ts-ignore
  Image,
  //@ts-ignore
  KeyboardAvoidingView,
  //@ts-ignore
  Platform,
  //@ts-ignore
  Pressable,
  //@ts-ignore
  Text,
  //@ts-ignore
  View
} from 'react-native';

import { Colors } from '@/constants/theme';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';

//@ts-ignore
import { ActivityIndicator } from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!agree) {
      Alert.alert('Terms Required', 'Please agree to the Terms of Use to continue.');
      return;
    }

    setGoogleLoading(true);
    try {
      const authResult = await signInWithGoogle();

      if (authResult.error) {
        if (authResult.error === 'cancelled') {
          // User cancelled, no need to show error
          return;
        }
        Alert.alert('Sign In Error', authResult.error);
      }
      // Auth layout will handle routing based on onboarding status
    } catch (error) {
      Alert.alert('Sign In Error', 'An unexpected error occurred. Please try again.');
      console.error('Google Sign-in error:', error);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1">
        <Image
          source={require('@/assets/onboarding/dj.jpg')}
          resizeMode="cover"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
          }}
        />
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />

        <View className="flex-1 px-6 pt-60">
          <Text className="mb-2 text-3xl font-semibold" style={{ color: Colors.textPrimary }}>
            Sign in
          </Text>
          <Text className="mb-8 text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
            Using your preferred provider
          </Text>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            className="mt-5 w-full flex-row items-center justify-center gap-3 rounded-full py-4"
            style={{
              backgroundColor: googleLoading ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              opacity: googleLoading ? 0.6 : 1,
            }}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={Colors.orange} />
            ) : (
              <Image
                source={require('@/assets/search.png')}
                style={{ width: 20, height: 20 }}
                resizeMode="contain"
              />
            )}
            <Text className="text-sm font-semibold" style={{ color: Colors.textPrimary }}>
              {googleLoading ? 'Signing in...' : 'Continue with Google'}
            </Text>
          </Pressable>

          <View className="my-7 flex-row items-center">
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.15)'
              }}
            />
            <Text
              className="mx-4 text-xs uppercase tracking-[0.25em]"
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              OR
            </Text>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.15)'
              }}
            />
          </View>

          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={async () => {
                if (!agree) {
                  Alert.alert('Terms Required', 'Please agree to the Terms of Use to continue.');
                  return;
                }

                setAppleLoading(true);
                try {
                  const result = await signInWithApple();
                  if (result.error && result.error !== 'cancelled') {
                    Alert.alert('Sign In Error', result.error);
                  }
                  // Auth layout will handle routing based on onboarding status
                } finally {
                  setAppleLoading(false);
                }
              }}
              disabled={appleLoading}
              className="mt-3 w-full flex-row items-center justify-center gap-3 rounded-full py-4"
              style={{
                backgroundColor: appleLoading ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                opacity: appleLoading ? 0.6 : 1,
              }}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color={Colors.orange} />
              ) : (
                <Image
                  source={require('@/assets/apple-logo.png')}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
              )}
              <Text className="text-sm font-semibold" style={{ color: Colors.textPrimary }}>
                {appleLoading ? ' ' : 'Continue with Apple'}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setAgree((v) => !v)}
            className="mt-6 flex-row items-center gap-3"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agree }}
          >
            <View
              className="h-5 w-5 items-center justify-center rounded-md"
              style={{
                backgroundColor: agree ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: agree ? Colors.orange : 'rgba(255,255,255,0.14)',
              }}
            >
              {agree ? <Text style={{ color: Colors.orange, fontSize: 12 }}>✓</Text> : null}
            </View>
            <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
              I have read and agree to the{' '}
              <Text onPress={() => router.push('/terms')} style={{ color: Colors.orange, fontWeight: '600' }}>Terms of Use</Text>
            </Text>
          </Pressable>


          <View className="flex-1" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  //@ts-ignore
  //signup
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
  ScrollView,
  //@ts-ignore
  Text,
  //@ts-ignore
  View
} from 'react-native';


import { Colors } from '@/constants/theme';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';
//@ts-ignore
import { ActivityIndicator } from 'react-native';

export default function SignupScreen() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const isFormValid = agree;

  const handleGoogleSignUp = async () => {
    if (!isFormValid) {
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
        Alert.alert('Sign Up Error', authResult.error);
      }
      // Let AuthContext handle user creation and routing
    } catch (error) {
      Alert.alert('Sign Up Error', 'An unexpected error occurred. Please try again.');
      console.error('Google Sign-up error:', error);
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

        {/* Background Image */}
        <Image
          source={require('@/assets/onboarding/welcome.jpg')}
          resizeMode="cover"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />

        {/* Dark Overlay */}
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.68)'
          }}
        />

        <ScrollView
          className="flex-1 px-6 pt-20"
          showsVerticalScrollIndicator={false}
        >

          {/* Title */}
          <Text
            className="text-3xl font-semibold mt-32"
            style={{ color: Colors.textPrimary }}
          >
            Create Account
          </Text>

          <Text
            className="text-sm mb-10"
            style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 280 }}
          >
            Connect your music world and see what your friends are listening to in real time.
          </Text>

          <View className="pt-[10px]">
            <Pressable
              onPress={handleGoogleSignUp}
              disabled={googleLoading}
              className="w-full flex-row items-center justify-center gap-3 rounded-full py-4"
              style={{
                backgroundColor: googleLoading ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
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
              <Text
                className="text-sm font-semibold"
                style={{ color: Colors.textPrimary }}
              >
                {googleLoading ? 'Creating account...' : 'Continue with Google'}
              </Text>
            </Pressable>

            {/* OR Divider */}
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

            {/* Apple Button */}
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
                  // Let AuthContext handle user creation and routing
                } finally {
                  setAppleLoading(false);
                }
              }}
              disabled={appleLoading}
              className="w-full flex-row items-center justify-center gap-3 rounded-full py-4"
              style={{
                backgroundColor: appleLoading ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.18)',
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
              <Text
                className="text-sm font-semibold"
                style={{ color: Colors.textPrimary }}
              >
                {appleLoading ? 'Creating account...' : 'Continue with Apple'}
              </Text>
            </Pressable>
          </View>
          {/* Terms Checkbox */}
          <Pressable
            onPress={() => setAgree((v) => !v)}
            className="mt-8 flex-row items-center gap-3"
          >
            <View
              className="h-5 w-5 items-center justify-center rounded-md"
              style={{
                backgroundColor: agree
                  ? 'rgba(255,255,255,0.14)'
                  : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: agree
                  ? Colors.orange
                  : 'rgba(255,255,255,0.14)'
              }}
            >
              {agree ? (
                <Text style={{ color: Colors.orange, fontSize: 12 }}>
                  ✓
                </Text>
              ) : null}
            </View>

            <Text
              className="text-sm"
              style={{ color: 'rgba(255,255,255,0.70)' }}
            >
              I agree to the{' '}
              <Text style={{ color: Colors.orange, fontWeight: '600' }}>
                Terms of Use
              </Text>
            </Text>
          </Pressable>

          <View className="h-20" />

          {/* <Pressable
            disabled={!isFormValid}
            onPress={handleContinue}
            className="mb-4 self-center rounded-2xl"
            style={{
              width: 64,
              height: 64,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isFormValid ? Colors.orange : 'rgba(255,255,255,0.10)',
              borderWidth: 1,
              borderColor: isFormValid ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)',
              shadowColor: isFormValid ? Colors.orange : 'transparent',
              shadowOpacity: isFormValid ? 0.45 : 0,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 10 },
            }}
          >
            <IconSymbol name="chevron.right" size={26} color={isFormValid ? Colors.white : 'rgba(255,255,255,0.55)'} />
          </Pressable> */}

          <Pressable onPress={() => router.push('/(auth)/login')} className="items-center pt-[136px]">
            <Text className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Already have an account? <Text className='text-orange-500'>Sign In</Text>
            </Text>
          </Pressable>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>


  );
}
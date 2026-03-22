//@ts-nocheck
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  //@ts-ignore
  Animated,
  //@ts-ignore
  Dimensions,
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
  TextInput,
  //@ts-ignore
  View
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export default function UsernameScreen() {
  const router = useRouter();
  const { avatarSeed } = useLocalSearchParams();
  const [username, setUsername] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState('');
  
  // Slide to continue animation
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const slideWidth = screenWidth - 48; // Account for padding
  const buttonWidth = 60;
  const maxSlide = slideWidth - buttonWidth;

  // Username validation
  const validateUsername = (input: string) => {
    if (input.length < 2) {
      setError('Username must be at least 2 characters');
      return false;
    }
    if (input.length > 20) {
      setError('Username must be less than 20 characters');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(input)) {
      setError('Only letters, numbers, and underscores allowed');
      return false;
    }
    setError('');
    return true;
  };

  const handleUsernameChange = (text: string) => {
    const cleanedText = text.toLowerCase().trim();
    setUsername(cleanedText);
    setIsValid(validateUsername(cleanedText));
  };

  const handleContinue = () => {
    if (isValid && username) {
      if (avatarSeed) {
        router.push({ 
          pathname: '/(auth)/music-services', 
          params: { username, avatarSeed } 
        });
      } else {
        router.push({ 
          pathname: '/(auth)/avatar', 
          params: { username } 
        });
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1 }}>
        {/* Background */}
        <Image
          source={require('@/assets/onboarding/welcome.jpg')}
          resizeMode="cover"
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
        <View
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.65)',
          }}
        />

        <ScrollView
          className="flex-1 px-6 pt-16"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text
            className="text-3xl font-semibold mb-2 pt-10"
            style={{ color: Colors.textPrimary }}
          >
            Choose Your Username
          </Text>

          <Text
            className="text-sm mb-8"
            style={{ color: 'rgba(255,255,255,0.70)' }}
          >
            This is how friends will find you. Pick something unique!
          </Text>

          {/* Username Input */}
          <View className="mb-6">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: error ? 'rgba(239,68,68,0.3)' : isValid ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
             
              <TextInput
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="username"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{
                  flex: 1,
                  color: Colors.textPrimary,
                  fontSize: 16,
                  paddingVertical: 0,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {isValid && (
                <IconSymbol name="checkmark.circle.fill" size={20} color="#22C55E" />
              )}
            </View>
            
            {error ? (
              <Text
                style={{
                  color: '#EF4444',
                  fontSize: 12,
                  marginTop: 6,
                  marginLeft: 4,
                }}
              >
                {error}
              </Text>
            ) : (
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 12,
                  marginTop: 6,
                  marginLeft: 4,
                }}
              >
                2-20 characters • letters, numbers, underscores
              </Text>
            )}
          </View>

          {/* Username Suggestions */}
          <View className="mb-8">
            <Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 13,
                marginBottom: 12,
                fontWeight: '500',
              }}
            >
              Suggestions
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {['music_lover', 'beat_drops', 'vibe_curator', 'sound_waves', 'melody_maker'].map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => handleUsernameChange(suggestion)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <Text
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 12,
                      fontWeight: '500',
                    }}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />

          {/* Continue Button */}
          <View className="px-6 pb-8">
            <Pressable
              onPress={handleContinue}
              disabled={!isValid || !username}
              style={{
                height: 60,
                backgroundColor: isValid && username ? Colors.orange : 'rgba(255,255,255,0.1)',
                borderRadius: 30,
                borderWidth: 1,
                borderColor: isValid && username ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: isValid && username ? Colors.orange : 'transparent',
                shadowOpacity: 0.4,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Text
                style={{
                  color: isValid && username ? Colors.white : 'rgba(255,255,255,0.3)',
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                {isValid && username ? 'Continue' : 'Enter a username first'}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

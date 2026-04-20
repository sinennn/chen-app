// @ts-nocheck
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Image,
    KeyboardAvoidingView,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    Text,
    View
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export default function AvatarScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [avatarSeeds, setAvatarSeeds] = useState<string[]>([]);
  const [trackWidth, setTrackWidth] = useState(0);
  
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const buttonWidth = 60;
  const maxSlide = Math.max(trackWidth - buttonWidth - 8, 0);

  const generateSeeds = () => {
    const seeds = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(7)
    );
    setAvatarSeeds(seeds);
  };

  useEffect(() => {
    if (!username) {
      router.replace('/(auth)/username');
      return;
    }

    generateSeeds();
  }, [router, username]);

  // DiceBear reddit-like avatar style
  const generateAvatarUrl = (seed: string) =>
    `https://api.dicebear.com/7.x/adventurer/png?seed=${seed}&size=128`;

  const handleSlideComplete = () => {
    if (selectedAvatar && username) {
      router.push({ 
        pathname: '/(auth)/music-services',
        params: { avatarSeed: selectedAvatar, username }
      });
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => maxSlide > 0,
    onMoveShouldSetPanResponder: (_: any, gestureState: any) =>
      maxSlide > 0 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 4,
    onPanResponderMove: (_: any, gestureState: any) => {
      const newValue = Math.max(0, Math.min(maxSlide, gestureState.dx));
      slideAnimation.setValue(newValue);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_: any, gestureState: any) => {
      const finalValue = Math.max(0, Math.min(maxSlide, gestureState.dx));

      if (finalValue >= maxSlide * 0.7) {
        Animated.timing(slideAnimation, {
          toValue: maxSlide,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          handleSlideComplete();
          slideAnimation.setValue(0);
        });
      } else {
        Animated.spring(slideAnimation, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideAnimation, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    },
  });

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
    >

      {/* Title */}
      <Text
        className="text-3xl font-semibold mb-2 pt-10"
        style={{ color: Colors.textPrimary }}
      >
        Choose Your Avatar
      </Text>

      <Text
        className="text-sm mb-6"
        style={{ color: 'rgba(255,255,255,0.70)' }}
      >
        Pick a vibe that feels like you
      </Text>

      {/* Reload Button */}
      <Pressable
        onPress={generateSeeds}
        className="mb-6 pt-15 self-start flex-row items-center gap-2"
      >
        <IconSymbol name="arrow.clockwise" size={16} color={Colors.orange} />
        <Text
          style={{
            color: Colors.orange,
            fontWeight: '600'
          }}
        >
          Randomize
        </Text>
      </Pressable>

      {/* Avatar Grid */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          marginBottom: 40
        }}
      >
        {avatarSeeds.map((seed) => {
          const avatarUrl = generateAvatarUrl(seed);
          const isSelected = selectedAvatar === seed;

          return (
            <Pressable
              key={seed}
              onPress={() => setSelectedAvatar(seed)}
              style={{
                width: '23%',
                aspectRatio: 1,
                marginBottom: 16,
                borderRadius: 20,
                borderWidth: 3,
                borderColor: isSelected
                  ? Colors.orange
                  : 'rgba(255,255,255,0.18)',
                backgroundColor: 'rgba(255,255,255,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: isSelected ? 1.08 : 1 }]
              }}
            >
              <Image
                source={{ uri: avatarUrl }}
                style={{
                  width: '85%',
                  height: '85%',
                  borderRadius: 12
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 40 }} />

      {/* Slide to Continue */}
      {selectedAvatar && (
        <View className="px-6 pb-8">
          <View
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            style={{
              height: 60,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 30,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              justifyContent: 'center',
              paddingHorizontal: 4,
            }}
          >

            <Animated.View
              {...panResponder.panHandlers}
              style={{
                width: buttonWidth,
                height: 52,
                backgroundColor: Colors.orange,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [
                  {
                    translateX: slideAnimation,
                  },
                ],
                shadowColor: Colors.orange,
                shadowOpacity: 0.4,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <IconSymbol name="chevron.right" size={24} color={Colors.white} />
            </Animated.View>
            
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Text
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                Slide to continue
              </Text>
            </View>
          </View>
        </View>
      )}

      {!selectedAvatar && (
        <View className="px-6 pb-8">
          <View
            style={{
              height: 60,
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 30,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: 16,
                fontWeight: '600',
              }}
            >
              Select an avatar to continue
            </Text>
          </View>
        </View>
      )}

    </ScrollView>
  </View>
</KeyboardAvoidingView>

);
}

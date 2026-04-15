
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  //@ts-ignore
  Dimensions,
  //@ts-ignore
  Image,
  //@ts-ignore
  NativeScrollEvent,
  //@ts-ignore
  NativeSyntheticEvent,
  //@ts-ignore
  Pressable,
  //@ts-ignore
  ScrollView,
  //@ts-ignore
  Text,
  //@ts-ignore
  View
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

const SLIDES = [
  {
    title: 'Your friends are the playlist',
    subtitle: 'See every track ripple through your circle in a glowing, living feed.',
    image: require('@/assets/onboarding/friends.jpg'),
  },
  {
    title: 'Night‑drive energy',
    subtitle: 'Album colors bleed into glassy cards. Pulsing rings show who is playing now.',
    image: require('@/assets/onboarding/nightdrive.jpg'),
  },
  {
    title: 'Meet Chen, your music twin',
    subtitle: 'An AI that actually knows your taste, built from what you and your friends play.',
    image: require('@/assets/onboarding/twin.jpg'),
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const screenWidth = Dimensions.get('window').width;

  const onPrimary = () => {
    router.push('/(auth)/signup');
  };

  const onSecondary = () => {
    router.push('/(auth)/login');
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / screenWidth);
    setIndex(currentIndex);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: Colors.bg }}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, slideIndex) => (
          <View key={slideIndex} style={{ width: screenWidth, flex: 1 }}>
            <Image
              source={slide.image}
              resizeMode="cover"
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
              }}
            />
            <View
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            />

            <View className="flex-1 px-6 pt-16">
              <View className="mb-6 flex-row items-center justify-between">
                <Text className="text-xs uppercase tracking-[0.4em]" style={{ color: Colors.textMuted }}>
                  chen
                </Text>
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}
                >
                  <Text style={{ color: Colors.textPrimary }}>✦</Text>
                </View>
              </View>

              <View className="flex-1" />

              <View className="mb-6">
                <Text className="mb-2 text-xs uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  welcome to chen
                </Text>
                <Text className="mb-2 text-4xl font-semibold" style={{ color: Colors.textPrimary }}>
                  {slide.title}
                </Text>
                <Text className="text-base" style={{ color: 'rgba(255,255,255,0.78)' }}>
                  {slide.subtitle}
                </Text>
              </View>

              <View className="mb-6 flex-row items-center gap-2">
                {SLIDES.map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setIndex(i);
                      scrollViewRef.current?.scrollTo({ x: i * screenWidth, animated: true });
                    }}
                    className="h-2 rounded-full"
                    style={{
                      width: i === index ? 26 : 8,
                      backgroundColor: i === index ? Colors.orange : 'rgba(255,255,255,0.25)',
                    }}
                  />
                ))}
              </View>

              {/* Only show Get Started button on last slide */}
              {index === SLIDES.length - 1 && (
                <Pressable
                  onPress={onPrimary}
                  className="mb-4 w-full flex-row items-center justify-between rounded-full pl-5 pr-2 py-2"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.10)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                >
                  <View>
                    <Text className="text-base font-semibold" style={{ color: Colors.textPrimary }}>
                      Get Started
                    </Text>
                  </View>

                  <View
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: Colors.orange,
                      shadowColor: Colors.orange,
                      shadowOpacity: 0.45,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 10 },
                    }}
                  >
                    <IconSymbol name="chevron.right" size={22} color={Colors.white} />
                  </View>
                </Pressable>
              )}

              {/* Show swipe hint on first two slides */}
              {index < SLIDES.length - 1 && (
                <View className="mb-4 items-center">
                  <Text className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Swipe to continue
                  </Text>
                </View>
              )}

              <Pressable onPress={onSecondary} className="items-center pb-6">
                {/* <Text className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  I already have an account
                </Text> */}
                <View className="pt-5"/>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}


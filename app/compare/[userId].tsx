import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    ImageBackground,
    Pressable,
    ScrollView,
    Text,
    View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Mock comparison data - in real app this would come from API
const mockComparisonData: { [key: string]: any } = {
  '1': {
    friendName: 'alex.wav',
    friendImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=alex&size=60',
    compatibility: 92,
    sharedArtists: [
      { name: 'Frank Ocean', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop' },
      { name: 'Fred again..', image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=80&h=80&fit=crop' },
      { name: 'SZA', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=80&h=80&fit=crop' },
    ],
    yourUniqueArtists: [
      { name: 'James Blake', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop' },
      { name: 'Burial', image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=80&h=80&fit=crop' },
    ],
    theirUniqueArtists: [
      { name: 'Phoebe Bridgers', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=80&h=80&fit=crop' },
      { name: 'Clairo', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=80&h=80&fit=crop' },
    ]
  },
  // Add more mock comparisons as needed
};

function ArtistCard({ artist, index }: { artist: any; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        alignItems: 'center',
        marginRight: 16,
        width: 80,
      }}
    >
      <Image
        source={{ uri: artist.image }}
        style={{
          width: 70,
          height: 70,
          borderRadius: 35,
          marginBottom: 8,
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }}
      />
      <Text 
        style={{ 
          color: Colors.textPrimary, 
          fontSize: 12, 
          fontWeight: '600',
          textAlign: 'center',
          lineHeight: 16
        }}
        numberOfLines={2}
      >
        {artist.name}
      </Text>
    </Animated.View>
  );
}

function SectionHeader({ title, subtitle, color = Colors.textPrimary }: { title: string; subtitle?: string; color?: string }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 14 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

export default function CompareScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [comparisonData, setComparisonData] = useState<any>(null);

  useEffect(() => {
    // In real app, fetch comparison data from API
    const data = mockComparisonData[userId as string];
    setComparisonData(data);
  }, [userId]);

  if (!comparisonData) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textPrimary }}>Loading comparison...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Background */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop' }}
        style={{ flex: 1 }}
        blurRadius={25}
      >
        <LinearGradient
          colors={['rgba(0, 1, 6, 0.85)', 'rgba(0, 1, 6, 0.9)', 'rgba(0, 1, 6, 0.95)']}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 60,
              paddingBottom: 20,
            }}
          >
            <Pressable
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <IconSymbol name="chevron.left" size={20} color={Colors.textPrimary} />
            </Pressable>
            
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                color: Colors.textPrimary,
              }}
            >
              Music Comparison
            </Text>
            
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Comparison Header */}
            <View style={{ alignItems: 'center', paddingHorizontal: 20, marginBottom: 40 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <Image
                  source={{ uri: 'https://api.dicebear.com/7.x/avataaars/png?seed=user&size=60' }}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    borderWidth: 3,
                    borderColor: Colors.orange,
                  }}
                />
                
                <Text style={{ 
                  color: Colors.textPrimary, 
                  fontSize: 24, 
                  fontWeight: '700', 
                  marginHorizontal: 16 
                }}>
                  vs
                </Text>
                
                <Image
                  source={{ uri: comparisonData.friendImage }}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    borderWidth: 3,
                    borderColor: Colors.orange,
                  }}
                />
              </View>
              
              <Text style={{ 
                color: Colors.textPrimary, 
                fontSize: 28, 
                fontWeight: '700', 
                textAlign: 'center',
                marginBottom: 8
              }}>
                YOU vs {comparisonData.friendName.toUpperCase()}
              </Text>
              
              <View
                style={{
                  backgroundColor: Colors.orange,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 25,
                }}
              >
                <Text style={{ color: Colors.white, fontSize: 18, fontWeight: '700' }}>
                  {comparisonData.compatibility}% Compatible
                </Text>
              </View>
            </View>

            {/* Shared Artists */}
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SectionHeader 
                title="Shared Artists" 
                subtitle="Artists you both love"
                color={Colors.orange}
              />
              
              <View
                style={{
                  backgroundColor: 'rgba(255, 147, 51, 0.1)',
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 147, 51, 0.2)',
                }}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {comparisonData.sharedArtists.map((artist: any, index: number) => (
                    <ArtistCard key={index} artist={artist} index={index} />
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Your Unique Artists */}
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SectionHeader 
                title="Artists Only You Listen To" 
                subtitle="Your unique taste"
              />
              
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {comparisonData.yourUniqueArtists.map((artist: any, index: number) => (
                    <ArtistCard key={index} artist={artist} index={index} />
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Their Unique Artists */}
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SectionHeader 
                title={`Artists Only ${comparisonData.friendName} Listens To`}
                subtitle="Their unique taste"
              />
              
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: 24,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {comparisonData.theirUniqueArtists.map((artist: any, index: number) => (
                    <ArtistCard key={index} artist={artist} index={index} />
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Discover Together */}
            <View style={{ paddingHorizontal: 20 }}>
              <View
                style={{
                  backgroundColor: 'rgba(255, 147, 51, 0.08)',
                  borderRadius: 24,
                  padding: 24,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 147, 51, 0.2)',
                }}
              >
                <IconSymbol name="music.note" size={32} color={Colors.orange} />
                <Text style={{ 
                  color: Colors.textPrimary, 
                  fontSize: 18, 
                  fontWeight: '700',
                  marginTop: 12,
                  marginBottom: 8,
                  textAlign: 'center'
                }}>
                  Discover Together
                </Text>
                <Text style={{ 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontSize: 14,
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: 16
                }}>
                  Based on your shared taste, we think you'd both love exploring ambient electronic and indie R&B together.
                </Text>
                
                <Pressable
                  style={{
                    backgroundColor: Colors.orange,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 20,
                  }}
                >
                  <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>
                    Create Shared Playlist
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
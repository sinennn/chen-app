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

// Mock user data - in real app this would come from API
const mockUserData: { [key: string]: any } = {
  '1': {
    id: '1',
    username: 'alex.wav',
    profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=alex&size=120',
    compatibility: 92,
    bio: 'Late-night electronic enthusiast',
    topArtists: [
      { name: 'Frank Ocean', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop' },
      { name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=100&h=100&fit=crop' },
      { name: 'Tame Impala', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=100&h=100&fit=crop' }
    ],
    topTracks: [
      { name: 'Blinding Lights', artist: 'The Weeknd', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop' },
      { name: 'Nights', artist: 'Frank Ocean', image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=60&h=60&fit=crop' },
      { name: 'The Less I Know', artist: 'Tame Impala', image: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=60&h=60&fit=crop' }
    ],
    recentlyPlayed: [
      { name: 'After Hours', artist: 'The Weeknd', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=60&h=60&fit=crop', timestamp: '2 min ago' },
      { name: 'Pink + White', artist: 'Frank Ocean', image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=60&h=60&fit=crop', timestamp: '15 min ago' }
    ]
  },
  // Add more mock users as needed
};

function TrackRow({ track, onPress }: { track: any; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <Pressable
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 16,
          padding: 12,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <Image
          source={{ uri: track.image }}
          style={{
            width: 50,
            height: 50,
            borderRadius: 12,
            marginRight: 12,
          }}
        />
        
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '600' }}>
            {track.name}
          </Text>
          <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13, marginTop: 2 }}>
            {track.artist}
          </Text>
          {track.timestamp && (
            <Text style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 11, marginTop: 1 }}>
              {track.timestamp}
            </Text>
          )}
        </View>
        
        <IconSymbol name="play.fill" size={20} color={Colors.orange} />
      </Pressable>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // In real app, fetch user data from API
    const userData = mockUserData[userId as string];
    setUser(userData);
  }, [userId]);

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.textPrimary }}>Loading...</Text>
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
              {user.username}
            </Text>
            
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Header */}
            <View style={{ alignItems: 'center', paddingHorizontal: 20, marginBottom: 32 }}>
              <Image
                source={{ uri: user.profileImage }}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  marginBottom: 16,
                  borderWidth: 3,
                  borderColor: Colors.orange,
                }}
              />
              
              <Text style={{ color: Colors.textPrimary, fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
                {user.username}
              </Text>
              
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 16, marginBottom: 16, textAlign: 'center' }}>
                {user.bio}
              </Text>
              
              <View
                style={{
                  backgroundColor: Colors.orange,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginBottom: 24,
                }}
              >
                <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '700' }}>
                  {user.compatibility}% Match
                </Text>
              </View>
              
              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Pressable
                  onPress={() => router.push(`/messages/${user.id}`)}
                  style={{
                    backgroundColor: Colors.orange,
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <IconSymbol name="message.fill" size={16} color={Colors.white} />
                  <Text style={{ color: Colors.white, fontSize: 16, fontWeight: '600' }}>
                    Message
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={() => router.push(`/compare/${user.id}`)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <IconSymbol name="chart.bar.fill" size={16} color={Colors.textPrimary} />
                  <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                    Compare
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Top Artists */}
            <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Top Artists
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {user.topArtists.map((artist: any, index: number) => (
                  <View key={index} style={{ marginRight: 16, alignItems: 'center' }}>
                    <Image
                      source={{ uri: artist.image }}
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: 40,
                        marginBottom: 8,
                      }}
                    />
                    <Text style={{ color: Colors.textPrimary, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                      {artist.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Top Tracks */}
            <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Top Tracks
              </Text>
              {user.topTracks.map((track: any, index: number) => (
                <TrackRow
                  key={index}
                  track={track}
                  onPress={() => {
                    // Handle track preview
                    console.log('Playing preview for:', track.name);
                  }}
                />
              ))}
            </View>

            {/* Recently Played */}
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 }}>
                Recently Played
              </Text>
              {user.recentlyPlayed.map((track: any, index: number) => (
                <TrackRow
                  key={index}
                  track={track}
                  onPress={() => {
                    // Handle track preview
                    console.log('Playing preview for:', track.name);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
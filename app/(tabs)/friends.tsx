import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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

// Mock Data
const mockFriends = [
  { id: '1', username: 'alex.wav', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=alex&size=80', compatibility: 92, sharedTaste: 'Late-night electronic', topSharedArtist: 'Frank Ocean', online: true },
  { id: '2', username: 'sarah_beats', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=sarah&size=80', compatibility: 88, sharedTaste: 'Indie rock overlap', topSharedArtist: 'Arctic Monkeys', online: false },
  { id: '3', username: 'mike_vibes', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=mike&size=80', compatibility: 75, sharedTaste: 'Hip-hop classics', topSharedArtist: 'Kendrick Lamar', online: true },
  { id: '4', username: 'luna.music', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=luna&size=80', compatibility: 84, sharedTaste: 'Dreamy pop', topSharedArtist: 'Lana Del Rey', online: false }
];

const discoverPeople = [
  { id: '5', username: 'nova_sounds', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=nova&size=60', compatibility: 91, topSharedArtist: 'The Weeknd' },
  { id: '6', username: 'echo.fm', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=echo&size=60', compatibility: 79, topSharedArtist: 'Billie Eilish' },
  { id: '7', username: 'rhythm_king', profileImage: 'https://api.dicebear.com/7.x/avataaars/png?seed=rhythm&size=60', compatibility: 86, topSharedArtist: 'Drake' }
];

function FriendCard({ friend, index, onPress }: { friend: any; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, delay: index * 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, delay: index * 100, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, index * 100 + 800);
  }, [fadeAnim, slideAnim, pulseAnim, index]);

  const getColor = (score: number) => score >= 85 ? Colors.orange : score >= 70 ? '#4CAF50' : 'rgba(255,255,255,0.3)';

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginRight: 20, width: 150 }}>
      <Pressable onPress={onPress} style={{
        borderRadius: 28,
        padding: 16,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: getColor(friend.compatibility),
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 12,
      }}>
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: friend.profileImage }} style={{ width: 70, height: 70, borderRadius: 35, marginBottom: 12 }} />
          {friend.online && (
            <View style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: Colors.green,
              borderWidth: 2,
              borderColor: 'rgba(0,0,0,0.3)',
            }} />
          )}
        </View>
        <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 6, textAlign: 'center' }} numberOfLines={1}>{friend.username}</Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }], backgroundColor: getColor(friend.compatibility), paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, marginBottom: 6 }}>
          <Text style={{ color: Colors.white, fontWeight: '700', fontSize: 12 }}>{friend.compatibility}%</Text>
        </Animated.View>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center', lineHeight: 14 }} numberOfLines={2}>{friend.sharedTaste}</Text>
      </Pressable>
    </Animated.View>
  );
}

function DiscoverPersonRow({ person, index, onPress }: { person: any; index: number; onPress: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable onPress={onPress} style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 22,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 6
      }}>
        <Image source={{ uri: person.profileImage }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 16 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: Colors.textPrimary, fontWeight: '600', fontSize: 16, marginBottom: 2 }}>{person.username}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{person.topSharedArtist}</Text>
        </View>
        <View style={{ backgroundColor: person.compatibility >= 85 ? Colors.orange : '#4CAF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
          <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '700' }}>{person.compatibility}%</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function FriendsScreen() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setTimeout(() => setLoading(false), 800);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=1200&fit=crop' }} style={{ flex: 1 }} blurRadius={30}>
        <LinearGradient colors={['rgba(0,1,6,0.85)','rgba(0,1,6,0.9)','rgba(0,1,6,0.95)']} style={{ flex:1 }}>
          {/* Header */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:60, paddingBottom:20 }}>
            <Text style={{ fontSize:28, fontWeight:'700', color:Colors.textPrimary }}>Friends</Text>
            <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
              <Pressable style={{ width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' }}>
                <IconSymbol name="person.badge.plus" size={20} color={Colors.textPrimary} />
              </Pressable>
              <Pressable style={{ width:40, height:40, borderRadius:20, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.08)' }}>
                <IconSymbol name="magnifyingglass" size={20} color={Colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ flex:1 }} contentContainerStyle={{ paddingBottom:120 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ alignItems:'center', marginTop:60 }}>
                <ActivityIndicator color={Colors.orange} size="large" />
                <Text style={{ color:'rgba(255,255,255,0.7)', marginTop:16, fontSize:16 }}>Loading your network...</Text>
              </View>
            ) : (
              <>
                {/* Your Network */}
                <View style={{ marginBottom:32 }}>
                  <Text style={{ fontSize:20, fontWeight:'700', color:Colors.textPrimary, marginLeft:20, marginBottom:16 }}>Your Network</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:20 }}>
                    {mockFriends.map((friend, index) => (
                      <FriendCard key={friend.id} friend={friend} index={index} onPress={() => router.push(`/profile/${friend.id}`)} />
                    ))}
                  </ScrollView>
                </View>

                {/* Discover People */}
                <View style={{ paddingHorizontal:20 }}>
                  <Text style={{ fontSize:20, fontWeight:'700', color:Colors.textPrimary, marginBottom:16 }}>Discover People</Text>
                  {discoverPeople.map((person, index) => (
                    <DiscoverPersonRow key={person.id} person={person} index={index} onPress={() => router.push(`/profile/${person.id}`)} />
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
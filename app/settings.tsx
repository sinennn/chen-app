import { Colors, ThemeKey } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Fade + slide entry ────────────────────────────────────────────────────────

function FadeSlide({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Section label ─────────────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  return (
    <Text style={{
      color: Colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 28,
      marginBottom: 10,
      paddingHorizontal: 2,
    }}>
      {children}
    </Text>
  );
}

// ── Settings row ──────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  onPress,
  right,
  labelColor = Colors.textPrimary,
  iconColor = Colors.orange,
  iconBg = 'rgba(232,100,10,0.1)',
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  right?: React.ReactNode;
  labelColor?: string;
  iconColor?: string;
  iconBg?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: danger ? 'rgba(231,76,60,0.05)' : 'rgba(255,255,255,0.04)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: danger ? 'rgba(231,76,60,0.12)' : 'rgba(232,100,10,0.09)',
        paddingVertical: 13,
        paddingHorizontal: 14,
        marginBottom: 7,
      }}
    >
      <View style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: iconBg,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
      }}>
        <Ionicons name={icon} size={15} color={iconColor} />
      </View>
      <Text style={{ flex: 1, color: labelColor, fontSize: 15, fontWeight: '500' }}>
        {label}
      </Text>
      {right ?? <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

// ── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({
  themeKey,
  theme,
  isActive,
  isPremium,
  onPress,
}: {
  themeKey: ThemeKey;
  theme: (typeof Colors.themes)[ThemeKey];
  isActive: boolean;
  isPremium: boolean;
  onPress: () => void;
}) {
  const isLocked = themeKey !== 'default' && !isPremium;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: false }),
          Animated.timing(glow, { toValue: 0.3, duration: 1800, useNativeDriver: false }),
        ])
      ).start();
    } else {
      glow.stopAnimation();
      glow.setValue(0);
    }
  }, [isActive]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginRight: 10 }}>
      {/* Glow halo */}
      {isActive && (
        <Animated.View style={{
          position: 'absolute',
          top: -3, left: -3, right: -3, bottom: -3,
          borderRadius: 21,
          backgroundColor: theme.accent,
          opacity: glow,
          shadowColor: theme.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 14,
          elevation: 12,
        }} />
      )}

      <View style={{
        width: 96,
        height: 128,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: isActive ? 1.5 : 1,
        borderColor: isActive ? theme.accent : 'rgba(255,255,255,0.07)',
      }}>
        <LinearGradient
          colors={[`${theme.accent}22`, theme.bg === '#0D0B09' ? '#141210' : theme.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.accent,
            shadowColor: theme.accent,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.7,
            shadowRadius: 12,
            elevation: 10,
          }} />

          <View>
            <Text style={{ color: Colors.textPrimary, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
              {theme.name}
            </Text>
            {isActive && (
              <Text style={{ color: theme.accent, fontSize: 9, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Active
              </Text>
            )}
          </View>
        </LinearGradient>

        {isActive && (
          <View style={{
            position: 'absolute', top: 8, right: 8,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: theme.accent,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="checkmark" size={11} color="#fff" />
          </View>
        )}

        {isLocked && (
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="lock-closed" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700', marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Premium
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [activeTheme, setActiveTheme] = useState<ThemeKey>('default');
  const [isPremium] = useState(false);
  const [spotifyConnected] = useState(true);

  const handleTheme = (key: ThemeKey) => {
    if (key !== 'default' && !isPremium) {
      Alert.alert(
        'Premium only',
        'Unlock all themes and unlimited Chen for ₦900/month.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Upgrade', onPress: () => {} }]
      );
      return;
    }
    setActiveTheme(key);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800' }}
        blurRadius={28}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={['rgba(13,11,9,0.82)', 'rgba(13,11,9,0.93)', 'rgba(13,11,9,0.98)']}
          style={{ flex: 1 }}
        >
          {/* Ambient glow */}
          <View style={{
            position: 'absolute',
            width: 360, height: 360, borderRadius: 180,
            backgroundColor: Colors.orange,
            opacity: 0.05,
            top: -100, right: -100,
          }} />

          <SafeAreaView style={{ flex: 1 }}>
            {/* ── Header ── */}
            <FadeSlide delay={0}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(232,100,10,0.08)',
              }}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1, borderColor: 'rgba(232,100,10,0.12)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={17} color={Colors.textSecondary} />
                </TouchableOpacity>

                <Text style={{
                  flex: 1, textAlign: 'center',
                  color: Colors.textMuted, fontSize: 11,
                  fontWeight: '700', letterSpacing: 2.5,
                  textTransform: 'uppercase',
                }}>
                  Settings
                </Text>

                <View style={{ width: 34 }} />
              </View>
            </FadeSlide>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 80 }}
            >
              {/* ── Profile hero ── */}
              <FadeSlide delay={60}>
                <View style={{ marginTop: 20 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(232,100,10,0.12)',
                    padding: 14,
                  }}>
                    <View style={{ position: 'relative', marginRight: 14 }}>
                      <View style={{
                        position: 'absolute',
                        width: 60, height: 60, borderRadius: 30,
                        backgroundColor: Colors.orange,
                        opacity: 0.2, top: -2, left: -2,
                      }} />
                      <Image
                        source={{ uri: 'https://api.dicebear.com/7.x/adventurer/png?seed=alex&size=120&backgroundColor=0D0B09' }}
                        style={{
                          width: 56, height: 56, borderRadius: 28,
                          borderWidth: 2, borderColor: Colors.orange,
                        }}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 3 }}>
                        alex.wav
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 5 }}>
                        Late-night electronic + indie
                      </Text>
                      {isPremium ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="sparkles" size={11} color={Colors.orange} />
                          <Text style={{ color: Colors.orange, fontSize: 11, fontWeight: '600', marginLeft: 4 }}>
                            Premium Member
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Free Plan</Text>
                      )}
                    </View>

                    <TouchableOpacity style={{
                      borderWidth: 1.5, borderColor: Colors.orange,
                      borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
                    }}>
                      <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </FadeSlide>

              {/* ── Appearance ── */}
              <FadeSlide delay={120}>
                <Label>Appearance</Label>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 6, paddingRight: 4 }}
                >
                  {(Object.entries(Colors.themes) as [ThemeKey, (typeof Colors.themes)[ThemeKey]][]).map(([key, theme]) => (
                    <ThemeCard
                      key={key}
                      themeKey={key}
                      theme={theme}
                      isActive={activeTheme === key}
                      isPremium={isPremium}
                      onPress={() => handleTheme(key)}
                    />
                  ))}
                </ScrollView>
              </FadeSlide>

              {/* ── Account ── */}
              <FadeSlide delay={200}>
                <Label>Account</Label>
                <Row icon="person-outline" label="Edit Profile" onPress={() => {}} />
                <Row
                  icon="musical-notes-outline"
                  label="Connected Platforms"
                  onPress={() => {}}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {spotifyConnected && (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success }} />
                      )}
                      <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
                    </View>
                  }
                />
                <Row icon="notifications-outline" label="Notifications" onPress={() => {}} />
                <Row icon="shield-outline" label="Privacy & Data" onPress={() => {}} />
              </FadeSlide>

              {/* ── Subscription ── */}
              <FadeSlide delay={280}>
                <Label>Subscription</Label>
                {isPremium ? (
                  <View style={{
                    borderRadius: 18, overflow: 'hidden',
                    borderWidth: 1, borderColor: 'rgba(232,100,10,0.2)',
                    marginBottom: 8,
                  }}>
                    <LinearGradient
                      colors={['rgba(232,100,10,0.18)', 'rgba(232,100,10,0.04)', 'transparent']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={{ padding: 16 }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{
                          backgroundColor: Colors.orange,
                          paddingHorizontal: 10, paddingVertical: 4,
                          borderRadius: 20, marginRight: 8,
                        }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                            Premium
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>
                        Renews on March 15, 2026
                      </Text>
                    </LinearGradient>
                  </View>
                ) : (
                  <View style={{
                    borderRadius: 18, overflow: 'hidden',
                    borderWidth: 1, borderColor: 'rgba(232,100,10,0.18)',
                    marginBottom: 8,
                  }}>
                    <LinearGradient
                      colors={['rgba(232,100,10,0.13)', 'rgba(232,100,10,0.03)', '#0D0B09']}
                      start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                      style={{ padding: 18 }}
                    >
                      <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                        Free Plan
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 18 }}>
                        You're missing unlimited Chen, all 5 themes, voice notes, and full listening history.
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: Colors.orange,
                          borderRadius: 13, paddingVertical: 14,
                          alignItems: 'center',
                          shadowColor: Colors.orange,
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 }}>
                          Upgrade to Premium — ₦900/month
                        </Text>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                )}
              </FadeSlide>

              {/* ── About ── */}
              <FadeSlide delay={360}>
                <Label>About</Label>
                <Row icon="information-circle-outline" label="Version 1.0.0" onPress={() => {}}
                  right={<Text style={{ color: Colors.textMuted, fontSize: 12 }}>1.0.0</Text>}
                />
                <Row icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
                <Row icon="lock-closed-outline" label="Privacy Policy" onPress={() => {}} />
                <Row icon="star-outline" label="Rate Chen on App Store" onPress={() => {}} />
              </FadeSlide>

              {/* ── Danger zone ── */}
              <FadeSlide delay={440}>
                <Label>Danger Zone</Label>
                <Row
                  icon="log-out-outline" label="Sign Out"
                  labelColor={Colors.orange} iconColor={Colors.orange}
                  iconBg="rgba(232,100,10,0.08)"
                  onPress={() => Alert.alert('Sign Out', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: () => {} },
                  ])}
                />
                <Row
                  icon="trash-outline" label="Delete Account"
                  labelColor={Colors.error} iconColor={Colors.error}
                  iconBg="rgba(231,76,60,0.08)" danger
                  onPress={() => Alert.alert(
                    'Delete Account',
                    'This cannot be undone. All your data will be permanently deleted.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => {} },
                    ]
                  )}
                />
              </FadeSlide>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
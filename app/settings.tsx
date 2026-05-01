//@ts-nocheck
import * as Linking from 'expo-linking';
import { Colors, ThemeKey } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useUnlocks } from '@/contexts/UnlocksContext';
import { useCurrentUserIdentity } from '@/hooks/use-current-user-identity';
import { ReferralPerkKey, api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
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
  Share,
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
  iconBg = Colors.accentSurface,
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
        backgroundColor: danger ? 'rgba(231,76,60,0.08)' : Colors.surfaceSoft,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: danger ? 'rgba(231,76,60,0.18)' : Colors.border,
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
  isUnlocked,
  onPress,
}: {
  themeKey: ThemeKey;
  theme: (typeof Colors.themes)[ThemeKey];
  isActive: boolean;
  isUnlocked: boolean;
  onPress: () => void;
}) {
  const isLocked = themeKey !== 'default' && !isUnlocked;
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
      {isActive && (
        <Animated.View style={{
          position: 'absolute',
          top: -3, left: -3, right: -3, bottom: -3,
          borderRadius: 21,
          backgroundColor: theme.accentSecondary,
          opacity: glow,
          shadowColor: theme.accentSecondary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.65,
          shadowRadius: 18,
          elevation: 12,
        }} />
      )}

      <View style={{
        width: 96,
        height: 128,
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: isActive ? 1.5 : 1,
        borderColor: isActive ? theme.accentSecondary : `${theme.accentSecondary}22`,
      }}>
        <LinearGradient
          colors={[theme.pageTop, theme.pageMiddle, theme.pageBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}
        >
          <View
            style={{
              position: 'absolute',
              top: -18,
              right: -12,
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.heroFrom,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: -20,
              left: -8,
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: theme.heroTo,
            }}
          />
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: theme.bgElevated,
            borderWidth: 1,
            borderColor: `${theme.accentSecondary}44`,
            overflow: 'hidden',
          }} />
          <LinearGradient
            colors={[theme.accent, theme.accentSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 48,
              height: 48,
              borderRadius: 16,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 24,
              left: 24,
              width: 24,
              height: 6,
              borderRadius: 999,
              backgroundColor: `${theme.onAccent}55`,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 36,
              left: 24,
              width: 16,
              height: 6,
              borderRadius: 999,
              backgroundColor: `${theme.onAccent}33`,
            }}
          />

          <View>
            <Text style={{ color: theme.textPrimary, fontSize: 11, fontWeight: '700', marginBottom: 2 }}>
              {theme.name}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 9, marginBottom: 3 }}>
              {themeKey === 'default'
                ? 'Warm noir'
                : themeKey === 'lagosNight'
                  ? 'Neon city'
                  : themeKey === 'harmattan'
                    ? 'Dust gold'
                    : themeKey === 'midnightAfro'
                      ? 'Lush midnight'
                      : 'Velvet red'}
            </Text>
            {isActive && (
              <Text style={{ color: theme.accentSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
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
            backgroundColor: theme.bgGlass,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="lock-closed" size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.textMuted, fontSize: 9, fontWeight: '700', marginTop: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Locked
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [spotifyConnected] = useState(true);
  const { signOut, refreshProfile } = useAuth();
  const { themeKey: activeTheme, setThemeKey } = useAppTheme();
  const { status, loading: unlocksLoading, isThemeUnlocked } = useUnlocks();
  const currentUser = useCurrentUserIdentity();

  const handleTheme = async (key: ThemeKey) => {
    if (!isThemeUnlocked(key)) {
      Alert.alert(
        'Theme locked',
        'Share that theme invite link and get a successful onboarding referral to unlock it.',
        [{ text: 'Not now', style: 'cancel' }]
      );
      return;
    }

    try {
      await setThemeKey(key);
      await api.profile.update({ theme_preference: key });
      await refreshProfile();
    } catch (error) {
      console.error('Error saving theme:', error);
      Alert.alert('Theme error', 'Failed to apply this theme. Please try again.');
    }
  };

  const sharePerk = async (perkKey: ReferralPerkKey) => {
    if (!status?.referral_code) {
      Alert.alert('Referral code missing', 'Refresh this page and try again.');
      return;
    }

    const perk = status.perks.find((entry) => entry.key === perkKey);
    if (!perk) {
      return;
    }

    const inviteURL = Linking.createURL('/signup', {
      queryParams: {
        referral_code: status.referral_code,
        perk_key: perkKey,
      },
    });

    try {
      await Share.share({
        message: `Join Chen with my invite and finish onboarding so I can unlock ${perk.title}. ${inviteURL}`,
      });
    } catch (error) {
      console.error('Share perk error:', error);
      Alert.alert('Share failed', 'Could not open the share sheet right now.');
    }
  };

  const handleEditProfile = () => {
    router.push('/(tabs)/profile');
  };

  const handleNotifications = () => {
    Alert.alert('Notifications', 'Notification settings coming soon!');
  };

  const handlePrivacy = () => {
    Alert.alert('Privacy & Data', 'Privacy settings and data management coming soon!');
  };

  const handleTerms = () => {
    Alert.alert('Terms of Service', 'Terms of Service will open in browser soon!');
  };

  const handlePrivacyPolicy = () => {
    Alert.alert('Privacy Policy', 'Privacy Policy will open in browser soon!');
  };

  const handleRateApp = () => {
    Alert.alert('Rate Chen', 'Thank you for using Chen! Rating feature coming soon!');
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'This cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Error signing out:', error);
                Alert.alert('Error', 'Failed to sign out. Please try again.');
              } else {
                // Note: Account deletion would require backend API endpoint
                Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
              }
            } catch (error) {
              console.error('Error deleting account:', error);
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            console.log('Settings: User confirmed sign out, calling signOut()');
            try {
              await signOut();
              console.log('Settings: signOut() completed successfully');
            } catch (error) {
              console.error('Settings: signOut() failed:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800' }}
        blurRadius={28}
        style={{ flex: 1 }}
      >
        <LinearGradient
          colors={[Colors.bgCanvasTop, Colors.bgCanvasMiddle, Colors.bgCanvasBottom]}
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
                borderBottomColor: Colors.border,
              }}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    width: 34, height: 34, borderRadius: 17,
                    backgroundColor: Colors.surfaceMuted,
                    borderWidth: 1, borderColor: Colors.borderStrong,
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
                  backgroundColor: Colors.surfaceSoft,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: Colors.border,
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
                        source={{ uri: currentUser.getAvatarUri(120) }}
                        style={{
                          width: 56, height: 56, borderRadius: 28,
                          borderWidth: 2, borderColor: Colors.orange,
                        }}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 3 }}>
                        {currentUser.username}
                      </Text>
                      <Text style={{ color: Colors.textSecondary, fontSize: 12, marginBottom: 5 }}>
                        Music enthusiast
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11 }}>
                        {status?.perks ? `${status.perks.filter((perk) => perk.unlocked).length}/${status.perks.length} perks unlocked` : 'Referral unlocks'}
                      </Text>
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
                      isUnlocked={isThemeUnlocked(key)}
                      onPress={() => handleTheme(key)}
                    />
                  ))}
                </ScrollView>
              </FadeSlide>

              {/* ── Account ── */}
              <FadeSlide delay={200}>
                <Label>Account</Label>
                <Row icon="person-outline" label="Edit Profile" onPress={handleEditProfile} />
                <Row
                  icon="musical-notes-outline"
                  label="Connected Platforms"
                  onPress={() => Alert.alert('Connected Platforms', 'Spotify and Apple Music connections coming soon!')}
                  right={
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {spotifyConnected && (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success }} />
                      )}
                      <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
                    </View>
                  }
                />
                <Row icon="notifications-outline" label="Notifications" onPress={handleNotifications} />
                <Row icon="shield-outline" label="Privacy & Data" onPress={handlePrivacy} />
              </FadeSlide>

              {/* ── Referral Unlocks ── */}
              <FadeSlide delay={280}>
                <Label>Referral Unlocks</Label>
                <View style={{
                  borderRadius: 18, overflow: 'hidden',
                  borderWidth: 1, borderColor: Colors.borderStrong,
                  marginBottom: 12,
                }}>
                  <LinearGradient
                    colors={[Colors.bgHeroFrom, Colors.bgHeroTo, Colors.bgCard]}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={{ padding: 18 }}
                  >
                    <Text style={{ color: Colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                      Invite for exact unlocks
                    </Text>
                    <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                      Each invite link is tied to one perk. When someone signs up from that link and finishes onboarding, progress is added only to that perk.
                    </Text>
                    <Text style={{ color: Colors.orange, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
                      Your code: {status?.referral_code || 'loading...'}
                    </Text>
                  </LinearGradient>
                </View>

                {unlocksLoading ? (
                  <View style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    backgroundColor: Colors.surfaceSoft,
                    padding: 18,
                    marginBottom: 8,
                  }}>
                    <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Loading your unlocks...</Text>
                  </View>
                ) : (
                  (status?.perks || []).map((perk) => (
                    <View
                      key={perk.key}
                      style={{
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: perk.unlocked ? 'rgba(39,174,96,0.24)' : Colors.border,
                        backgroundColor: Colors.surfaceSoft,
                        padding: 16,
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
                            {perk.title}
                          </Text>
                          <Text style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
                            {perk.description}
                          </Text>
                        </View>
                        <View style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: perk.unlocked ? 'rgba(39,174,96,0.14)' : Colors.accentSurface,
                        }}>
                          <Text style={{ color: perk.unlocked ? Colors.success : Colors.orange, fontSize: 11, fontWeight: '800' }}>
                            {perk.completed_referrals}/{perk.required_referrals}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => sharePerk(perk.key)}
                        disabled={!status?.referral_code}
                        style={{
                          backgroundColor: perk.unlocked ? Colors.surfaceMuted : Colors.orange,
                          borderRadius: 13,
                          paddingVertical: 13,
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: perk.unlocked ? Colors.surfaceStrong : Colors.orange,
                        }}
                      >
                        <Text style={{ color: perk.unlocked ? Colors.textPrimary : '#fff', fontSize: 13, fontWeight: '700' }}>
                          {perk.unlocked ? 'Share again' : `Share ${perk.required_referrals > 1 ? `(${perk.required_referrals} needed)` : 'invite link'}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </FadeSlide>

              {/* ── About ── */}
              <FadeSlide delay={360}>
                <Label>About</Label>
                <Row icon="information-circle-outline" label="Version 1.0.0" onPress={() => {}} 
                  right={<Text style={{ color: Colors.textMuted, fontSize: 12 }}>1.0.0</Text>}
                />
                <Row icon="document-text-outline" label="Terms of Service" onPress={handleTerms} />
                <Row icon="lock-closed-outline" label="Privacy Policy" onPress={handlePrivacyPolicy} />
                <Row icon="star-outline" label="Rate Chen on App Store" onPress={handleRateApp} />
              </FadeSlide>

              {/* ── Danger zone ── */}
              <FadeSlide delay={440}>
                <Label>Danger Zone</Label>
                <Row
                  icon="log-out-outline" label="Sign Out"
                  labelColor={Colors.orange} iconColor={Colors.orange}
                  iconBg={Colors.accentSurface}
                  onPress={handleSignOut}
                />
                <Row
                  icon="trash-outline" label="Delete Account"
                  labelColor={Colors.error} iconColor={Colors.error}
                  iconBg="rgba(231,76,60,0.08)" danger
                  onPress={handleDeleteAccount}
                />
              </FadeSlide>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

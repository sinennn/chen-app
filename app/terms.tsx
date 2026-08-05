//@ts-nocheck
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useEffect } from 'react';
import {
  Animated,
  ImageBackground,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          color: Colors.orange,
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 0.8,
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: Colors.textSecondary,
          fontSize: 14,
          lineHeight: 22,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export default function TermsScreen() {
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
          <View
            style={{
              position: 'absolute',
              width: 360,
              height: 360,
              borderRadius: 180,
              backgroundColor: Colors.orange,
              opacity: 0.05,
              top: -100,
              right: -100,
            }}
          />

          <SafeAreaView style={{ flex: 1 }}>
            {/* ── Header ── */}
            <FadeSlide delay={0}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
              >
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: Colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: Colors.borderStrong,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={17} color={Colors.textSecondary} />
                </TouchableOpacity>

                <Text
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    color: Colors.textMuted,
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 2.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Terms & Conditions
                </Text>

                <View style={{ width: 34 }} />
              </View>
            </FadeSlide>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }}
            >
              <FadeSlide delay={60}>
                <Text
                  style={{
                    color: Colors.textPrimary,
                    fontSize: 26,
                    fontWeight: '700',
                    marginBottom: 6,
                  }}
                >
                  Terms of Use
                </Text>
                <Text
                  style={{
                    color: Colors.textMuted,
                    fontSize: 12,
                    marginBottom: 28,
                  }}
                >
                  Last updated: July 2026
                </Text>
              </FadeSlide>

              <FadeSlide delay={120}>
                <Section title="1. Acceptance of Terms">
                  By accessing or using Chen ("the App"), you agree to be bound by these Terms of
                  Use. If you do not agree, please do not use the App. We reserve the right to update
                  these terms at any time, and continued use constitutes acceptance of any changes.
                </Section>

                <Section title="2. Description of Service">
                  Chen is a social music discovery platform that connects you with your friends'
                  listening activity. The App provides real-time feeds, AI-powered music
                  recommendations, and social features including direct messaging, reactions, and
                  shared listening experiences.
                </Section>

                <Section title="3. User Accounts">
                  You are responsible for maintaining the confidentiality of your account credentials
                  and for all activity that occurs under your account. You must provide accurate,
                  current, and complete information during the registration process. You may not use
                  the App if you are under 13 years of age.
                </Section>

                <Section title="4. Connected Services">
                  Chen integrates with third-party music streaming services including Spotify, Apple
                  Music, and Audiomack. By connecting these services, you grant Chen permission to
                  access your listening data in accordance with each service's API terms. You may
                  disconnect these services at any time from your account settings.
                </Section>

                <Section title="5. User Conduct">
                  You agree not to use the App for any unlawful purpose or in violation of any
                  applicable laws. Prohibited activities include, but are not limited to: harassing
                  other users, impersonating any person or entity, interfering with the App's
                  operation, scraping data, or transmitting malicious code.
                </Section>

                <Section title="6. Content and Intellectual Property">
                  The App and its original content, features, and functionality are owned by Chen and
                  are protected by applicable intellectual property laws. User-generated content
                  remains the property of its creator, but by posting it on Chen you grant us a
                  non-exclusive, royalty-free license to display and distribute it within the App.
                </Section>

                <Section title="7. Privacy">
                  Your privacy is important to us. Our Privacy Policy explains how we collect, use,
                  and protect your personal information. By using the App, you consent to the data
                  practices described in our Privacy Policy.
                </Section>

                <Section title="8. Limitation of Liability">
                  Chen shall not be liable for any indirect, incidental, special, consequential, or
                  punitive damages arising out of or relating to your use of the App. The App is
                  provided on an "as is" and "as available" basis without warranties of any kind,
                  either express or implied.
                </Section>

                <Section title="9. Termination">
                  We reserve the right to suspend or terminate your account at any time for violation
                  of these Terms or for any other reason at our sole discretion. Upon termination,
                  your right to use the App will immediately cease.
                </Section>

                <Section title="10. Contact">
                  If you have any questions about these Terms, please contact us at{' '}
                  <Text style={{ color: Colors.orange }}>support@chenmusic.app</Text>.
                </Section>
              </FadeSlide>

              <FadeSlide delay={200}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: Colors.orange,
                    borderRadius: 999,
                    paddingVertical: 15,
                    alignItems: 'center',
                    marginTop: 8,
                    marginBottom: 20,
                    shadowColor: Colors.orange,
                    shadowOpacity: 0.35,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 10 },
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                    I Understand
                  </Text>
                </TouchableOpacity>
              </FadeSlide>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
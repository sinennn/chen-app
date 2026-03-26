import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  //@ts-ignore
  Animated,
  //@ts-ignore
  Dimensions,
  //@ts-ignore
  ImageBackground,
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

const { width: screenWidth } = Dimensions.get('window');

type ChatMessage = {
  id: string;
  role: 'user' | 'chen';
  content: string;
  timestamp: Date;
};

// ── Chen Avatar — 3D coin-flip ring ──────────────────────────────────────────

function ChenAvatar({ isThinking = false }: { isThinking?: boolean }) {
  // Outer slow orbit (Y-axis coin flip simulation via scaleX)
  const flipAnim = useRef(new Animated.Value(0)).current;
  // Inner fast spin when thinking
  const spinAnim = useRef(new Animated.Value(0)).current;
  // Pulse scale
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Glow intensity
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  // Second ring counter-rotation
  const counterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isThinking) {
      // Reset animations to resting state when not thinking
      flipAnim.setValue(0);
      spinAnim.setValue(0);
      counterAnim.setValue(0);
      pulseAnim.setValue(1);
      glowAnim.setValue(0.5);
      return;
    }

    // Coin-flip: scaleX goes 1 → -1 → 1 simulating 3D Y-axis rotation
    const flipLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flipAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(flipAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    flipLoop.start();

    // Tilt spin (Z-axis) — always rotating
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    // Counter spin for second ring
    const counterLoop = Animated.loop(
      Animated.timing(counterAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      })
    );
    counterLoop.start();

    // Pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Glow
    Animated.timing(glowAnim, {
      toValue: 1.0,
      duration: 400,
      useNativeDriver: false,
    }).start();

    return () => {
      flipLoop.stop();
      spinLoop.stop();
      counterLoop.stop();
      pulseLoop.stop();
    };
  }, [isThinking]);

  const scaleX = flipAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [1, 0.15, -1, -0.15, 1],
  });

  const rotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const counterRotation = counterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  // Color shift: orange → lighter when thinking
  const ringColor = isThinking ? '#FF9A3C' : Colors.orange;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
      
      {/* Outer ring — coin flip + Z spin */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 78,
          height: 78,
          borderRadius: 39,
          borderWidth: 2.5,
          borderColor: ringColor,
          transform: [{ rotate: rotation }, { scaleX }, { scale: pulseAnim }],
        }}
      />

      {/* Inner ring — counter rotation, different tilt */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 1.5,
          borderColor: `${ringColor}88`,
          transform: [{ rotate: counterRotation }, { scaleX: scaleX }],
        }}
      />

      {/* Core dot */}
      <Animated.View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: ringColor,
          opacity: pulseAnim,
          shadowColor: ringColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 6,
        }}
      />
    </View>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(dots[0], { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dots[1], { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dots[2], { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(dots[0], { toValue: 0.2, duration: 280, useNativeDriver: true }),
        Animated.timing(dots[1], { toValue: 0.2, duration: 280, useNativeDriver: true }),
        Animated.timing(dots[2], { toValue: 0.2, duration: 280, useNativeDriver: true }),
      ]).start(() => animate());
    };
    animate();
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, paddingVertical: 14 }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: Colors.orange,
            opacity: dot,
          }}
        />
      ))}
    </View>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function ChatBubble({ message, isUser }: { message: ChatMessage; isUser: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginBottom: 14,
      }}
    >
      <View
        style={{
          backgroundColor: isUser
            ? 'rgba(232, 100, 10, 0.18)'
            : 'rgba(255,255,255,0.07)',
          borderRadius: 22,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: isUser
            ? 'rgba(232, 100, 10, 0.3)'
            : 'rgba(255,255,255,0.1)',
          ...(isUser ? {
            shadowColor: Colors.orange,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          } : {}),
        }}
      >
        <Text
          style={{
            color: Colors.textPrimary,
            fontSize: 15,
            lineHeight: 22,
          }}
        >
          {message.content}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ChenScreen() {
  const { profile } = useAuth();
  const name = profile?.username || 'you';

  const INITIAL_MESSAGES: ChatMessage[] = [
    {
      id: '1',
      role: 'chen',
      content: `hey ${name}. i've been listening with you. what's on your mind?`,
      timestamp: new Date(),
    },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'chen' ? 'assistant' : 'user',
        content: m.content,
      }));

      const result = await api.chen.chat(input.trim(), history);

      const chenMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'chen',
        content: result.reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, chenMsg]);
    } catch (error) {
      console.error('Chen error:', error);
      setMessages(prev => [...prev, {
        id: String(Date.now() + 1),
        role: 'chen',
        content: "sorry, lost my train of thought. try again?",
        timestamp: new Date(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isThinking]);

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop' }}
        style={{ flex: 1 }}
        blurRadius={25}
      >
        {/* @ts-ignore */}
        <LinearGradient
          colors={['rgba(0, 1, 6, 0.85)', 'rgba(0, 1, 6, 0.9)', 'rgba(0, 1, 6, 0.95)']}
          style={{ flex: 1 }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >

            {/* ── Sticky header (avatar + title float above chat) ── */}
            <View style={{ position: 'relative', zIndex: 10 }}>
              <View
                style={{
                  paddingTop: 56,
                  paddingBottom: 12,
                  paddingHorizontal: 20,
                }}
              >
                {/* Header row */}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <Pressable style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: 'rgba(232,100,10,0.12)',
                  }}>
                    <IconSymbol name="chevron.left" size={18} color={Colors.textSecondary} />
                  </Pressable>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: Colors.textPrimary, letterSpacing: 0.3 }}>
                      Chen
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
                      {isThinking ? 'thinking...' : 'your music twin'}
                    </Text>
                  </View>

                  <Pressable style={{
                    width: 38, height: 38, borderRadius: 19,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: 'rgba(232,100,10,0.12)',
                  }}>
                    <IconSymbol name="gearshape" size={16} color={Colors.textSecondary} />
                  </Pressable>
                </View>

                {/* Avatar — sits inside blur header */}
                <ChenAvatar isThinking={isThinking} />

                {/* Fade edge at bottom of blur zone */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: -20,
                    left: 0,
                    right: 0,
                    height: 20,
                  }}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(13,11,9,0.6)']}
                  />
                </View>
              </View>
            </View>

            {/* ── Chat messages ── */}
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 24,
                paddingBottom: 16,
              }}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  isUser={message.role === 'user'}
                />
              ))}

              {isThinking && (
                <Animated.View style={{ alignSelf: 'flex-start', marginBottom: 14 }}>
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.07)',
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}>
                    <TypingIndicator />
                  </View>
                </Animated.View>
              )}
            </ScrollView>

            {/* ── Input bar ── */}
            <View style={{
              paddingHorizontal: 16,
              paddingBottom: Platform.OS === 'ios' ? 34 : 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: 'rgba(232,100,10,0.08)',
            }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderRadius: 26,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: input.trim()
                  ? 'rgba(232,100,10,0.25)'
                  : 'rgba(255,255,255,0.08)',
              }}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="ask chen anything..."
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    flex: 1,
                    color: Colors.textPrimary,
                    fontSize: 15,
                    paddingVertical: 8,
                    maxHeight: 100,
                  }}
                  multiline
                  maxLength={500}
                  onSubmitEditing={handleSend}
                />

                <Pressable
                  onPress={handleSend}
                  disabled={!input.trim() || isThinking}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: input.trim() && !isThinking
                      ? Colors.orange
                      : 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 10,
                    shadowColor: input.trim() ? Colors.orange : 'transparent',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                  }}
                >
                  <IconSymbol
                    name="arrow.up"
                    size={16}
                    color={input.trim() && !isThinking ? Colors.white : 'rgba(255,255,255,0.3)'}
                  />
                </Pressable>
              </View>
            </View>

          </KeyboardAvoidingView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}
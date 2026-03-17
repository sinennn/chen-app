
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
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

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'chen',
    content: "Hey there! I'm Chen, your music companion. I've been listening to what you play and I'm already getting a feel for your vibe.",
    timestamp: new Date(),
  },
  {
    id: '2',
    role: 'chen',
    content: "You seem to have great taste in late-night music. Want to explore some new sounds together?",
    timestamp: new Date(),
  },
];

// Chen's glowing ring avatar component
function ChenAvatar({ isThinking = false }: { isThinking?: boolean }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Faster rotation when thinking
    const rotationSpeed = isThinking ? 800 : 6000;

    // Reset and restart rotation with new speed
    rotateAnim.setValue(0);
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: rotationSpeed,
        useNativeDriver: true,
      })
    ).start();

    // More intense pulse when thinking
    const pulseSequence = isThinking 
      ? [
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]
      : [
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ];

    Animated.loop(Animated.sequence(pulseSequence)).start();
  }, [isThinking]);

  useEffect(() => {
    // Brighter glow when thinking
    Animated.timing(glowAnim, {
      toValue: isThinking ? 1.2 : 0.6,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isThinking]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ alignItems: 'center', marginVertical: 32 }}>
      
      {/* glow layer */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 100,
          height: 100,
          borderRadius: 50,
          shadowColor: Colors.orange,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowAnim,
          shadowRadius: 35,
          elevation: 20,
        }}
      />

      {/* rotating ring */}
      <Animated.View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          borderWidth: 4,
          borderColor: Colors.orange,
          transform: [
            { rotate: rotation },
            { scale: pulseAnim }
          ],
        }}
      />
    </View>
  );
}


function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDots = () => {
      Animated.sequence([
        Animated.timing(dot1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot1, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dot2, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dot3, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => animateDots());
    };
    animateDots();
  }, [dot1, dot2, dot3]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 12 }}>
      <Text style={{ color: 'rgba(255, 255, 255, 0.7)', marginRight: 8 }}>Chen is thinking</Text>
      {[dot1, dot2, dot3].map((dot, index) => (
        <Animated.View
          key={index}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: Colors.orange,
            opacity: dot,
          }}
        />
      ))}
    </View>
  );
}

// Chat bubble component
function ChatBubble({ message, isUser }: { message: ChatMessage; isUser: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginBottom: 16,
      }}
    >
      <View
        style={{
          backgroundColor: isUser 
            ? 'rgba(255, 147, 51, 0.15)'  // Orange tint for user messages
            : 'rgba(255, 255, 255, 0.08)', // Subtle white for Chen messages
          borderRadius: 24,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderWidth: 1,
          borderColor: isUser 
            ? 'rgba(255, 147, 51, 0.25)'  // Orange border for user
            : 'rgba(255, 255, 255, 0.12)', // White border for Chen
          shadowColor: isUser ? Colors.orange : '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isUser ? 0.15 : 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Text 
          style={{ 
            color: isUser ? Colors.textPrimary : 'rgba(255, 255, 255, 0.95)',
            fontSize: 16,
            lineHeight: 22,
          }}
        >
          {message.content}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function ChenScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate Chen's response
    setTimeout(() => {
      const responses = [
        "That's such a vibe! I can tell you're in one of those moods where the music just hits different.",
        "You know what? Based on what you've been playing lately, I think you'd love some ambient electronic stuff.",
        "I've noticed you play that song when you're feeling contemplative. Want me to find something similar?",
        "Your late-night playlist is getting really good. You're developing quite the aesthetic!",
        "Interesting choice! That artist has some deeper cuts that might surprise you.",
      ];
      
      const chenMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'chen',
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, chenMsg]);
      setIsThinking(false);
    }, 2000);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <View style={{ flex: 1 }}>
      {/* Background */}
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=1200&fit=crop' }}
        style={{ flex: 1 }}
        blurRadius={25}
      >
      {/* @ts-expect-error */}
        <LinearGradient
          colors={['rgba(0, 1, 6, 0.85)', 'rgba(0, 1, 6, 0.9)', 'rgba(0, 1, 6, 0.95)']}
          style={{ flex: 1 }}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              
              <View style={{ alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: '700',
                    color: Colors.textPrimary,
                  }}
                >
                  Chen
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginTop: 2,
                  }}
                >
                  Your music twin
                </Text>
              </View>
              
              <Pressable
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
                <IconSymbol name="gearshape" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>

            {/* Chen Avatar */}
            <ChenAvatar isThinking={isThinking} />

            {/* Chat Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
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
                <View style={{ alignSelf: 'flex-start', marginBottom: 16 }}>
                  <View
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: 24,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <TypingIndicator />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input Area */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingBottom: 34,
                paddingTop: 16,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 28,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask Chen about your music..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  style={{
                    flex: 1,
                    color: Colors.textPrimary,
                    fontSize: 16,
                    paddingVertical: 4,
                  }}
                  multiline
                  maxLength={500}
                />
                
                <Pressable
                  onPress={handleSend}
                  disabled={!input.trim() || isThinking}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: input.trim() ? Colors.orange : 'rgba(255, 255, 255, 0.2)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 12,
                  }}
                >
                  <IconSymbol 
                    name="arrow.up" 
                    size={18} 
                    color={input.trim() ? Colors.white : 'rgba(255, 255, 255, 0.5)'} 
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


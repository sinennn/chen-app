import { Tabs, router } from 'expo-router';
import { useEffect, useRef } from 'react';

const { Animated } = require('react-native');

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

function BouncyIcon({
  name,
  color,
  focused,
}: {
  name: IconSymbolName;
  color: string;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      friction: 5,
      tension: 150,
      useNativeDriver: true,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <IconSymbol size={28} name={name} color={color} />
    </Animated.View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/welcome');
    }
  }, [user, loading]);

  if (loading || !user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.orange,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: '#000106ff',
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <BouncyIcon name="house.fill" color={color as string} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chen"
        options={{
          title: 'Chen',
          tabBarIcon: ({ color, focused }) => (
            <BouncyIcon name="record.circle" color={color as string} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <BouncyIcon name="person.2.fill" color={color as string} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <BouncyIcon name="person.circle.fill" color={color as string} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
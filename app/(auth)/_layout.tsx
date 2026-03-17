import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function AuthLayout() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: Colors.bg, 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <ActivityIndicator size="large" color={Colors.orange} />
      </View>
    );
  }

  // If user is authenticated, redirect to main app
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // Show auth screens for unauthenticated users
  return <Stack screenOptions={{ headerShown: false }} />;
}


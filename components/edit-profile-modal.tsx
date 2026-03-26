//@ts-nocheck
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Animated,
    Keyboard,
    Modal,
    Pressable,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View
} from 'react-native';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export function EditProfileModal({ visible, onClose, onProfileUpdated }: EditProfileModalProps) {
  const { profile } = useAuth();
  const [username, setUsername] = useState('');
  const [userTag, setUserTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [userTagError, setUserTagError] = useState('');

  const slideAnim = React.useRef(new Animated.Value(300)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Initialize with current profile data
      setUsername(profile?.username || '');
      setUserTag(profile?.user_tag || '');
      setUsernameError('');
      setUserTagError('');
      
      // Animate in
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const validateUsername = (text: string) => {
    if (text.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (text.length > 25) {
      return 'Username must be less than 20 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(text)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return '';
  };

  const validateUserTag = (text: string) => {
    if (text && text.length < 2) {
      return 'User tag must be at least 2 characters';
    }
    if (text && text.length > 20) {
      return 'User tag must be less than 20 characters';
    }
    if (text && !/^[a-zA-Z0-9]+$/.test(text)) {
      return 'User tag can only contain letters and numbers';
    }
    return '';
  };

  const checkUsernameAvailability = async (newUsername: string) => {
    if (newUsername === profile?.username) return true; // Same username is OK
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', newUsername)
        .single();
      
      return !data; // Available if no data found
    } catch (error) {
      return true; // Assume available on error
    }
  };

  const handleSave = async () => {
    if (loading) return;

    // Validate inputs
    const usernameValidation = validateUsername(username);
    const userTagValidation = validateUserTag(userTag);

    setUsernameError(usernameValidation);
    setUserTagError(userTagValidation);

    if (usernameValidation || userTagValidation) {
      return;
    }

    setLoading(true);

    try {
      // Check username availability
      const isUsernameAvailable = await checkUsernameAvailability(username);
      if (!isUsernameAvailable) {
        setUsernameError('Username is already taken');
        setLoading(false);
        return;
      }

      // Update profile using API
      const updateData: any = { username };
      if (userTag.trim()) {
        updateData.user_tag = userTag.trim();
      } else {
        updateData.user_tag = null; // Clear user_tag if empty
      }

      await api.profile.update(updateData);

      // Call the callback to refresh profile data
      onProfileUpdated();
      onClose();
      
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      
      // Handle specific error cases
      if (error.message?.includes('409') || error.message?.includes('already taken')) {
        setUserTagError('User tag is already taken');
      } else {
        Alert.alert('Error', 'Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    setUsername(text.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''));
    if (usernameError) {
      setUsernameError(validateUsername(text));
    }
  };

  const handleUserTagChange = (text: string) => {
    setUserTag(text.toLowerCase().replace(/[^a-zA-Z0-9]/g, ''));
    if (userTagError) {
      setUserTagError(validateUserTag(text));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.7)',
              opacity: backdropOpacity,
            }}
          >
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={{ flex: 1 }} />
            </TouchableWithoutFeedback>
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: Colors.bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 40,
              transform: [{ translateY: slideAnim }],
              borderTopWidth: 1,
              borderTopColor: 'rgba(232, 100, 10, 0.2)',
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 20,
              }}
            />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Text style={{ color: Colors.textPrimary, fontSize: 20, fontWeight: '700' }}>
                Edit Profile
              </Text>
              <Pressable onPress={onClose}>
                <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>Cancel</Text>
              </Pressable>
            </View>

            {/* Username Field */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                Username
              </Text>
              <TextInput
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="Enter username"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 16,
                  color: Colors.textPrimary,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: usernameError ? '#E74C3C' : 'rgba(232, 100, 10, 0.2)',
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
              {usernameError ? (
                <Text style={{ color: '#E74C3C', fontSize: 12, marginTop: 4 }}>
                  {usernameError}
                </Text>
              ) : null}
            </View>

            {/* User Tag Field */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ color: Colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
                User Tag (Optional)
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: Colors.textMuted, fontSize: 16, marginRight: 4 }}>@</Text>
                <TextInput
                  value={userTag}
                  onChangeText={handleUserTagChange}
                  placeholder="usertag"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    padding: 16,
                    color: Colors.textPrimary,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: userTagError ? '#E74C3C' : 'rgba(232, 100, 10, 0.2)',
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
              {userTagError ? (
                <Text style={{ color: '#E74C3C', fontSize: 12, marginTop: 4 }}>
                  {userTagError}
                </Text>
              ) : null}
              <Text style={{ color: Colors.textMuted, fontSize: 12, marginTop: 4 }}>
                A unique identifier that friends can use to find you
              </Text>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={loading || !!usernameError || !!userTagError}
              style={{
                backgroundColor: loading || usernameError || userTagError 
                  ? 'rgba(232, 100, 10, 0.3)' 
                  : Colors.orange,
                borderRadius: 16,
                padding: 16,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: loading || usernameError || userTagError 
                    ? 'rgba(255,255,255,0.5)' 
                    : Colors.textPrimary,
                  fontSize: 16,
                  fontWeight: '600',
                }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
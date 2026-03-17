import {
    GoogleSignin,
    statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

export function configureGoogleSignIn() {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, // Use web client ID for Supabase
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, // Keep iOS client ID for native sign-in
    scopes: ['profile', 'email'],
  });
}

export async function signInWithGoogle() {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;

    if (!idToken) throw new Error('No ID token from Google');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;
    return { user: data.user, session: data.session, error: null };

  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { user: null, session: null, error: 'cancelled' };
    }
    if (error.code === statusCodes.IN_PROGRESS) {
      return { user: null, session: null, error: 'in_progress' };
    }
    return { user: null, session: null, error: error.message };
  }
}

export async function signOut() {
  await GoogleSignin.signOut();
  await supabase.auth.signOut();
}

export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { user: null, session: null, error: error.message };
  return { user: data.user, session: data.session, error: null };
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { user: null, session: null, error: error.message };
  return { user: data.user, session: data.session, error: null };
}

import * as AppleAuthentication from 'expo-apple-authentication';

export async function signInWithApple() {
  try {
    // Check if Apple Authentication is available
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign-In is not available on this device');
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const identityToken = credential.identityToken;
    if (!identityToken) throw new Error('No identity token from Apple');

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    });

    if (error) throw error;
    return { user: data.user, session: data.session, error: null };

  } catch (error: any) {
    console.error('Apple Sign-In error:', error);
    
    if (error.code === 'ERR_REQUEST_CANCELED') {
      return { user: null, session: null, error: 'cancelled' };
    }
    
    // Handle specific Apple Authentication errors
    if (error.code === 1000) {
      return { user: null, session: null, error: 'Apple Sign-In failed. Please try again or use a different sign-in method.' };
    }
    
    return { user: null, session: null, error: error.message || 'Apple Sign-In failed' };
  }
}
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@/lib/storage';

const PENDING_SPOTIFY_CONNECT_KEY = 'chen_pending_spotify_connect';

// Android can suspend/kill the app while the user is on Spotify's login page,
// so the in-memory state from the screen that started the auth request is
// gone by the time the redirect comes back. This gets persisted before the
// browser opens so the spotify-callback route can recover it after a cold start.
export type PendingSpotifyConnect = {
  username?: string;
  avatarSeed?: string;
};

export const SPOTIFY_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'com.quinnn.chen',
  path: 'spotify-callback',
});

export async function storePendingSpotifyConnect(input: PendingSpotifyConnect) {
  await AsyncStorage.setItem(PENDING_SPOTIFY_CONNECT_KEY, JSON.stringify(input));
}

export async function getPendingSpotifyConnect(): Promise<PendingSpotifyConnect | null> {
  const raw = await AsyncStorage.getItem(PENDING_SPOTIFY_CONNECT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingSpotifyConnect;
  } catch {
    return null;
  }
}

export async function clearPendingSpotifyConnect() {
  await AsyncStorage.removeItem(PENDING_SPOTIFY_CONNECT_KEY);
}

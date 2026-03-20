import { supabase } from './supabase';

export type ActivityItem = {
  id: string;
  user_id: string;
  username: string;
  avatar_id: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_art_url: string;
  platform: 'spotify';
  started_at: string;
  played_at?: string;
  is_playing: boolean;
};

export type Friend = {
  id: string;
  username: string;
  avatar_id: string;
  compatibility: number;
  is_online: boolean;
  current_track?: ActivityItem;
};

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
  is_premium: boolean;
  created_at: string;
};

export type ChatResponse = {
  reply: string;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8080/api/v1';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session status:', session ? 'Active' : 'No session');
  console.log('Access token present:', !!session?.access_token);
  if (session?.access_token) {
    console.log('Token first 50 chars:', session.access_token.substring(0, 50) + '...');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  };
}

async function getJSON<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  const json = await res.json();
  console.log(`API ${path} response:`, json);
  return (json.data ?? json) as T;
}

async function postJSON<T>(path: string, body: any): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${path} failed with ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as T;
}

export const api = {
  feed: {
    get: () => getJSON<ActivityItem[]>('/activity/feed'),
  },
  friends: {
    list: () => getJSON<Friend[]>('/friends'),
    add: (username: string) => postJSON('/friends/add', { username }),
    accept: (friendshipId: string) => postJSON('/friends/accept', { friendship_id: friendshipId }),
    decline: (friendshipId: string) => postJSON('/friends/decline', { friendship_id: friendshipId }),
  },
  spotify: {
    nowPlaying: () => getJSON<ActivityItem | null>('/spotify/now-playing'),
    recent: () => getJSON<ActivityItem[]>('/spotify/recent'),
    connect: (accessToken: string, refreshToken: string, expiresIn: number) => 
      postJSON('/spotify/connect', { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn }),
  },
  profile: {
    me: () => getJSON<UserProfile>('/auth/user'),
    update: (data: Partial<UserProfile>) => postJSON('/auth/user', data),
    stats: () => getJSON<any>('/profile/stats'),
    topArtists: () => getJSON<any[]>('/profile/top-artists'),
    topTracks: () => getJSON<any[]>('/profile/top-tracks'),
  },
  chen: {
    chat: (message: string, history: any[]) => postJSON<ChatResponse>('/chen/chat', { message, history }),
  },
};


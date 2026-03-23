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

export type FriendSearchResult = {
  id: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
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

export type RecommendedTrack = {
  name: string;
  artist: string;
  album: string;
  album_art: string;
  rank: number;
};

export type SpotifyArtistImage = {
  height: number;
  url: string;
  width: number;
};

export type SpotifyArtist = {
  external_urls: Record<string, string>;
  followers: {
    href: string | null;
    total: number;
  };
  genres: string[];
  href: string;
  id: string;
  images: SpotifyArtistImage[];
  name: string;
  popularity: number;
  type: string;
  uri: string;
};

export type SpotifyTopArtistsResponse = {
  items: SpotifyArtist[];
  total: number;
  limit: number;
  offset: number;
  href: string;
  next: string | null;
  previous: string | null;
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8080/api/v1';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Authentication required');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

async function getJSON<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${path} failed with ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}

async function postJSON<T>(path: string, body: any): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${path} failed with ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}

export const api = {
  feed: {
    get: () => getJSON<ActivityItem[]>('/activity/feed'),
  },
  friends: {
    list: () => getJSON<Friend[]>('/friends'),
    search: (query: string) => getJSON<FriendSearchResult[]>(`/friends/search?q=${encodeURIComponent(query)}`),
    add: (username: string) => postJSON('/friends/add', { username }),
    accept: (friendshipId: string) => postJSON('/friends/accept', { friendship_id: friendshipId }),
    decline: (friendshipId: string) => postJSON('/friends/decline', { friendship_id: friendshipId }),
  },
  spotify: {
    nowPlaying: () => getJSON<ActivityItem | null>('/spotify/now-playing'),
    recent: () => getJSON<ActivityItem[]>('/spotify/recent'),
    topArtists: (timeRange = 'short_term', limit = 5) =>
      getJSON<SpotifyTopArtistsResponse>(`/spotify/top-artists?time_range=${encodeURIComponent(timeRange)}&limit=${limit}`),
    recommendations: () => getJSON<RecommendedTrack[]>('/spotify/recommendations'),
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

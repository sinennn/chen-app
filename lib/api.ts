import { supabase } from './supabase';

export type ActivityItem = {
  id: string;
  user_id: string;
  username: string;
  avatar_id: string;
  track_id?: string;
  track_name: string;
  artist_name: string;
  album_name: string;
  album_art_url: string;
  spotify_url?: string;
  preview_url?: string;
  platform: 'spotify';
  started_at: string;
  played_at?: string;
  is_playing: boolean;
};

export type PublicProfileUser = {
  id: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
};

export type PublicProfileStats = {
  minutesListened: number;
  artistsPlayed: number;
  topGenre: string;
};

export type PublicProfileRelationship = {
  friendshipId?: string;
  status: 'none' | 'self' | 'friends' | 'outgoing_pending' | 'incoming_pending';
  canMessage: boolean;
};

export type PublicProfileData = {
  user: PublicProfileUser;
  stats: PublicProfileStats;
  relationship: PublicProfileRelationship;
  nowPlaying: ActivityItem | null;
  recentTracks: ActivityItem[];
  topTracks: Array<{
    name: string;
    artist: string;
    playCount: number;
    imageUrl: string;
  }>;
  topArtists: Array<{
    name: string;
    playCount: number;
    imageUrl: string;
    genres?: string[];
  }>;
};

export type ActivityComment = {
  id: string;
  user_id: string;
  username: string;
  avatar_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: string;
};

export type FeedEngagement = {
  commentCount: number;
  reactions: {
    love: number;
    fire: number;
    headphones: number;
  };
  userReactions: {
    love: boolean;
    fire: boolean;
    headphones: boolean;
  };
};

export type Friend = {
  id: string;
  username: string;
  avatar_id: string;
  compatibility: number;
  is_online: boolean;
  current_track?: ActivityItem;
};

export type PendingFriendRequest = {
  friendship_id: string;
  requester: FriendSearchResult;
  is_online: boolean;
  current_track?: ActivityItem;
};

export type FriendSearchResult = {
  id: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
  relationship_status: 'none' | 'self' | 'friends' | 'outgoing_pending' | 'incoming_pending';
};

export type FriendRecommendation = {
  id: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
  compatibility: number;
  is_online: boolean;
  current_track?: ActivityItem;
};

export type FriendDiscoverResult = {
  id: string;
  username: string;
  user_tag?: string;
  avatar_id: string;
  relationship_status: 'none' | 'self' | 'friends' | 'outgoing_pending' | 'incoming_pending';
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

export type ChenConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChenConversation = {
  messages: ChenConversationMessage[];
};

export type MessageFriend = {
  id: string;
  username: string;
  avatar_id: string;
};

export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: 'text' | 'voice';
  audio_url?: string;
  audio_duration_ms?: number;
  created_at: string;
  read_at?: string;
  is_mine: boolean;
};

export type MessageThread = {
  friend: MessageFriend;
  lastMessage?: DirectMessage;
  unreadCount: number;
};

export type MessageThreadResponse = {
  friend: MessageFriend;
  messages: DirectMessage[];
};

export type SendDirectMessagePayload = {
  content?: string;
  message_type?: 'text' | 'voice';
  audio_url?: string;
  audio_duration_ms?: number;
};

export type NotificationActor = {
  id: string;
  username: string;
  avatar_id: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  entity_id?: string;
  metadata: Record<string, any>;
  read_at?: string;
  created_at: string;
  actor?: NotificationActor;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unreadCount: number;
};

export type NotificationUnreadCount = {
  count: number;
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
    discover: () => getJSON<FriendDiscoverResult[]>('/friends/discover'),
    requests: () => getJSON<PendingFriendRequest[]>('/friends/requests'),
    search: (query: string) => getJSON<FriendSearchResult[]>(`/friends/search?q=${encodeURIComponent(query)}`),
    recommendations: () => getJSON<FriendRecommendation[]>('/friends/recommendations'),
    add: (username: string) => postJSON('/friends/add', { username }),
    accept: (friendshipId: string) => postJSON('/friends/accept', { friendship_id: friendshipId }),
    decline: (friendshipId: string) => postJSON('/friends/decline', { friendship_id: friendshipId }),
  },
  spotify: {
    nowPlaying: () => getJSON<ActivityItem | null>('/spotify/now-playing'),
    recent: () => getJSON<ActivityItem[]>('/spotify/recent'),
    topArtists: (timeRange = 'short_term', limit = 5, options?: { fresh?: boolean }) => {
      const params = new URLSearchParams({
        time_range: timeRange,
        limit: String(limit),
      });
      if (options?.fresh) {
        params.set('fresh', 'true');
      }
      return getJSON<SpotifyTopArtistsResponse>(`/spotify/top-artists?${params.toString()}`);
    },
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
    user: (userId: string, options?: { fresh?: boolean }) => {
      const params = new URLSearchParams();
      if (options?.fresh) {
        params.set('fresh', 'true');
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      return getJSON<PublicProfileData>(`/profile/users/${encodeURIComponent(userId)}${suffix}`);
    },
  },
  reactions: {
    engagement: (activityIds: string[]) =>
      getJSON<Record<string, FeedEngagement>>(`/reactions/engagement?activity_ids=${encodeURIComponent(activityIds.join(','))}`),
    comments: (activityId: string) =>
      getJSON<ActivityComment[]>(`/reactions/comments/${encodeURIComponent(activityId)}`),
    createComment: (activityId: string, content: string, parentCommentId?: string | null) =>
      postJSON('/reactions/comments', {
        activity_id: activityId,
        content,
        parent_comment_id: parentCommentId || undefined,
      }),
    toggle: (activityId: string, reactionType: 'love' | 'fire' | 'headphones') =>
      postJSON<{ active: boolean }>('/reactions/toggle', {
        activity_id: activityId,
        reaction_type: reactionType,
      }),
  },
  notifications: {
    list: () => getJSON<NotificationListResponse>('/notifications'),
    unreadCount: () => getJSON<NotificationUnreadCount>('/notifications/unread-count'),
    markRead: (id: string) => postJSON(`/notifications/${encodeURIComponent(id)}/read`, {}),
    markAllRead: () => postJSON('/notifications/read-all', {}),
  },
  messages: {
    threads: () => getJSON<MessageThread[]>('/messages/threads'),
    thread: (friendId: string) => getJSON<MessageThreadResponse>(`/messages/${encodeURIComponent(friendId)}`),
    send: (friendId: string, payload: string | SendDirectMessagePayload) =>
      postJSON<DirectMessage>(
        `/messages/${encodeURIComponent(friendId)}`,
        typeof payload === 'string' ? { content: payload, message_type: 'text' } : payload
      ),
    markRead: (friendId: string) => postJSON(`/messages/${encodeURIComponent(friendId)}/read`, {}),
  },
  chen: {
    conversation: () => getJSON<ChenConversation>('/chen/conversation'),
    chat: (message: string, history: any[]) => postJSON<ChatResponse>('/chen/chat', { message, history }),
  },
};

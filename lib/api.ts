export type ActivityItem = {
  id: string;
  username: string;
  track: string;
  artist: string;
  platform: 'spotify' | 'audiomack';
  started_at: string;
  is_playing: boolean;
};

export type Friend = {
  id: string;
  username: string;
  compatibility: number;
  online: boolean;
};

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8080/api/v1';

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} failed with ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}

export const api = {
  async getFeed(): Promise<ActivityItem[]> {
    return getJSON<ActivityItem[]>('/activity/feed');
  },
  async getFriends(): Promise<Friend[]> {
    return getJSON<Friend[]>('/friends');
  },
};


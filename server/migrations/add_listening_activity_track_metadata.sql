ALTER TABLE listening_activity
ADD COLUMN IF NOT EXISTS track_id TEXT,
ADD COLUMN IF NOT EXISTS spotify_url TEXT,
ADD COLUMN IF NOT EXISTS preview_url TEXT;

CREATE INDEX IF NOT EXISTS idx_listening_activity_user_played_at_with_playing
ON listening_activity(user_id, played_at DESC, is_playing);

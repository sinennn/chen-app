CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL DEFAULT 'unknown',
    device_id TEXT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id
    ON user_push_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_last_seen_at
    ON user_push_tokens(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS direct_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_recipient_created_at
    ON direct_messages(sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_read_at
    ON direct_messages(recipient_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    entity_id UUID NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
    ON notifications(user_id, read_at, created_at DESC);

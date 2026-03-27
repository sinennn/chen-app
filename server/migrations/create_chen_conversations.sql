CREATE TABLE IF NOT EXISTS chen_conversations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chen_conversations
    ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE chen_conversations
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE chen_conversations
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE chen_conversations
SET messages = '[]'::jsonb
WHERE messages IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chen_conversations_user_id
ON chen_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_chen_conversations_updated_at
ON chen_conversations(updated_at DESC);

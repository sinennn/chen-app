ALTER TABLE direct_messages
    ADD COLUMN IF NOT EXISTS track_metadata JSONB;

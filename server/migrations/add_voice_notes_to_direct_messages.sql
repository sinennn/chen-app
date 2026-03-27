ALTER TABLE direct_messages
    ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS audio_url TEXT,
    ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voice-notes',
    'voice-notes',
    true,
    10485760,
    ARRAY['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/webm']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Authenticated uploads for voice notes'
    ) THEN
        CREATE POLICY "Authenticated uploads for voice notes"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'voice-notes');
    END IF;
END $$;

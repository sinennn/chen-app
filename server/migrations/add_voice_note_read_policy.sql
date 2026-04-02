DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Authenticated reads for voice notes'
    ) THEN
        CREATE POLICY "Authenticated reads for voice notes"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'voice-notes');
    END IF;
END $$;

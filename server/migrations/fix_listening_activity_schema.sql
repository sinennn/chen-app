-- Fix listening_activity table schema
-- This addresses the artist vs artist_name column issue

-- First, check if we have both columns and standardize to artist_name
DO $$
BEGIN
    -- If artist column exists and artist_name doesn't, rename artist to artist_name
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'listening_activity' AND column_name = 'artist')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'listening_activity' AND column_name = 'artist_name') THEN
        ALTER TABLE listening_activity RENAME COLUMN artist TO artist_name;
    END IF;

    -- If both columns exist, copy data from artist to artist_name and drop artist
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'listening_activity' AND column_name = 'artist')
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'listening_activity' AND column_name = 'artist_name') THEN
        
        -- Update artist_name with artist data where artist_name is null
        UPDATE listening_activity 
        SET artist_name = artist 
        WHERE artist_name IS NULL AND artist IS NOT NULL;
        
        -- Drop the old artist column
        ALTER TABLE listening_activity DROP COLUMN IF EXISTS artist;
    END IF;
END $$;

-- Ensure the table has all required columns with correct types
ALTER TABLE listening_activity 
ADD COLUMN IF NOT EXISTS progress_ms INTEGER,
ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ DEFAULT NOW();

-- Update played_at from started_at if played_at is null
UPDATE listening_activity 
SET played_at = started_at 
WHERE played_at IS NULL AND started_at IS NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_listening_activity_user_played_at 
ON listening_activity(user_id, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_listening_activity_track_played_at 
ON listening_activity(user_id, track_name, artist_name, played_at);

-- Remove NOT NULL constraint from old artist column if it still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'listening_activity' AND column_name = 'artist') THEN
        ALTER TABLE listening_activity ALTER COLUMN artist DROP NOT NULL;
    END IF;
END $$;
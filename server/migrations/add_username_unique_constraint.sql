-- Add unique constraint to username column
-- This ensures no two users can have the same username

-- First, handle any existing duplicates by appending a random suffix
DO $$
DECLARE
    duplicate_record RECORD;
    counter INTEGER := 1;
BEGIN
    -- Find and fix duplicate usernames
    FOR duplicate_record IN 
        SELECT username, COUNT(*) as count 
        FROM users 
        WHERE username IS NOT NULL 
        GROUP BY username 
        HAVING COUNT(*) > 1
    LOOP
        -- For each duplicate group, update all but the first one
        UPDATE users 
        SET username = username || '_' || counter || '_' || substr(md5(random()::text), 1, 4)
        WHERE ctid IN (
            SELECT ctid 
            FROM users 
            WHERE username = duplicate_record.username 
            ORDER BY created_at 
            OFFSET 1
        );
        counter := counter + 1;
    END LOOP;
END $$;

-- Add unique constraint to username
ALTER TABLE users 
ADD CONSTRAINT users_username_unique 
UNIQUE (username);

-- Add comment to explain the constraint
COMMENT ON CONSTRAINT users_username_unique ON users IS 'Ensures each username is unique across all users';

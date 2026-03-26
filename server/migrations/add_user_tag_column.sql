-- Add user_tag column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_tag TEXT;

-- Create unique index on user_tag (excluding null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_tag_unique 
ON users(user_tag) 
WHERE user_tag IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN users.user_tag IS 'Optional unique identifier that friends can use to find the user';
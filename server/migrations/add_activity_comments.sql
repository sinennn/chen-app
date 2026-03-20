-- Create activity_comments table for comments on listening activities
CREATE TABLE IF NOT EXISTS activity_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES listening_activity(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activity_comments_activity_id 
ON activity_comments(activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_comments_user_id 
ON activity_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_activity_comments_created_at 
ON activity_comments(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view all comments on activities
CREATE POLICY "Users can view activity comments"
    ON activity_comments FOR SELECT
    USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can insert their own comments"
    ON activity_comments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
    ON activity_comments FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
    ON activity_comments FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_activity_comments_updated_at 
    BEFORE UPDATE ON activity_comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

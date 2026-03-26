ALTER TABLE activity_comments
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES activity_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activity_comments_parent_comment_id
ON activity_comments(parent_comment_id);

CREATE TABLE IF NOT EXISTS activity_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    activity_id UUID NOT NULL REFERENCES listening_activity(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('love', 'fire', 'headphones')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(activity_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_activity_reactions_activity_id
ON activity_reactions(activity_id);

CREATE INDEX IF NOT EXISTS idx_activity_reactions_user_id
ON activity_reactions(user_id);

ALTER TABLE activity_reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'activity_reactions'
          AND policyname = 'Users can view activity reactions'
    ) THEN
        CREATE POLICY "Users can view activity reactions"
            ON activity_reactions FOR SELECT
            USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'activity_reactions'
          AND policyname = 'Users can insert their own activity reactions'
    ) THEN
        CREATE POLICY "Users can insert their own activity reactions"
            ON activity_reactions FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'activity_reactions'
          AND policyname = 'Users can delete their own activity reactions'
    ) THEN
        CREATE POLICY "Users can delete their own activity reactions"
            ON activity_reactions FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

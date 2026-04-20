-- Migration: add is_super_user flag to users table
-- This column acts as a per-user feature flag that, when enabled, grants
-- the user full access to every gated feature (all themes, all top artist
-- slots, voice notes) without requiring any referrals.
-- Toggling is done via the /admin API and never exposed to end-users.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_super_user BOOLEAN NOT NULL DEFAULT false;

-- Partial index — only indexes the rare rows where the flag is ON,
-- keeping the index tiny while still making admin lookups fast.
CREATE INDEX IF NOT EXISTS idx_users_is_super_user
    ON users (id)
    WHERE is_super_user = true;

COMMENT ON COLUMN users.is_super_user IS
    'Feature flag: when true, all referral-gated features are unlocked for this user. '
    'Set only via the internal /admin API using ADMIN_SECRET. Never user-settable.';

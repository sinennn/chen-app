ALTER TABLE users
    ADD COLUMN IF NOT EXISTS referral_code TEXT,
    ADD COLUMN IF NOT EXISTS theme_preference TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE users
SET referral_code = LOWER(SUBSTRING(MD5(id::text) FROM 1 FOR 12))
WHERE referral_code IS NULL OR BTRIM(referral_code) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
ON users(referral_code);

CREATE TABLE IF NOT EXISTS referral_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    perk_key TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_completions_referrer
ON referral_completions(referrer_user_id, perk_key);

CREATE INDEX IF NOT EXISTS idx_referral_completions_referred
ON referral_completions(referred_user_id);

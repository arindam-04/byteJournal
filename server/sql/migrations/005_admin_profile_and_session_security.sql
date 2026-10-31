-- ByteJournal migration 005: profile editing and password session invalidation.
-- Additive: safe for existing installs and repeatable on partially upgraded databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_active_email ON users(lower(email)) WHERE active=true;

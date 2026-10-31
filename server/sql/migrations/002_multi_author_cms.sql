-- ByteJournal migration 002: multi-author CMS foundation.
-- Additive and repeatable; legacy admins/articles remain intact.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','admin','editor','author')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  bio TEXT,
  expertise VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO users (name,email,password_hash,role)
SELECT name,email,password_hash,'super_admin' FROM admins
ON CONFLICT (email) DO NOTHING;

ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS publication_status VARCHAR(24);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS review_notes TEXT;
UPDATE articles SET publication_status = CASE WHEN status='published' THEN 'published' ELSE 'draft' END WHERE publication_status IS NULL;
ALTER TABLE articles ALTER COLUMN publication_status SET DEFAULT 'draft';
ALTER TABLE articles ALTER COLUMN publication_status SET NOT NULL;
UPDATE articles a SET author_id=u.id FROM users u WHERE a.author_id IS NULL AND lower(a.author)=lower(u.name);
UPDATE articles SET author_id=(SELECT id FROM users WHERE role='super_admin' ORDER BY created_at,id LIMIT 1)
WHERE author_id IS NULL AND EXISTS (SELECT 1 FROM users WHERE role='super_admin');
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_workflow ON articles(publication_status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS invitations (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','editor','author')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(lower(email));

CREATE TABLE IF NOT EXISTS author_requests (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  expertise VARCHAR(180) NOT NULL,
  biography TEXT NOT NULL,
  portfolio_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  writing_experience TEXT,
  sample_article_url TEXT,
  motivation TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending','Under Review','Approved','Rejected','Invited','Completed')),
  review_notes TEXT,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_author_requests_pending_email
  ON author_requests(lower(email)) WHERE status IN ('Pending','Under Review','Approved','Invited');

CREATE TABLE IF NOT EXISTS article_reviews (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(24) NOT NULL CHECK (action IN ('submitted','approved','rejected','revision_requested','published','unpublished')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS review_comments (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS media_assets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60),
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

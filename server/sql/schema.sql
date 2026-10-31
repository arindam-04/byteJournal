-- ByteJournal complete PostgreSQL schema for a fresh installation.
-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/sql/schema.sql
-- Idempotent/additive: does not delete records or create a first admin account.
-- Migration ledger (the application stores checksums when it manages migrations).
CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name VARCHAR(200) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== 000_legacy_base.sql =====
-- ByteJournal base schema (legacy-compatible foundation).
-- Safe for existing installations; no user/article records are dropped.
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  excerpt VARCHAR(320) NOT NULL,
  category VARCHAR(80) NOT NULL,
  author VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  read_minutes INTEGER NOT NULL DEFAULT 1 CHECK (read_minutes > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  cover_color VARCHAR(20) NOT NULL DEFAULT 'blue',
  cover_image TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  seo_title VARCHAR(180),
  meta_description VARCHAR(320),
  canonical_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- ===== migrations/001_article_metadata_and_indexes.sql =====
-- ByteJournal migration 001
-- Safe to run repeatedly. Adds article metadata and indexes without dropping data.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS seo_title VARCHAR(180);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_description VARCHAR(320);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS canonical_url TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_status_published ON articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING GIN (
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,''))
);

-- ===== migrations/002_multi_author_cms.sql =====
-- ByteJournal migration 002: multi-author CMS foundation.
-- Additive and repeatable; legacy admins/articles remain intact.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','admin','editor','author')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit_website BOOLEAN NOT NULL DEFAULT FALSE,
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

-- ===== migrations/003_cms_integrity_and_indexes.sql =====
-- ByteJournal migration 003: harden workflow state and support administration.
-- Safe to run repeatedly. It deliberately never rewrites existing non-NULL workflow states.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS publication_status VARCHAR(24);
UPDATE articles
SET publication_status = CASE WHEN status='published' THEN 'published' ELSE 'draft' END
WHERE publication_status IS NULL;
ALTER TABLE articles ALTER COLUMN publication_status SET DEFAULT 'draft';
UPDATE articles SET publication_status='draft' WHERE publication_status='unpublished';
UPDATE articles SET publication_status='draft' WHERE status='draft' AND publication_status='published';
UPDATE articles a SET author_id=u.id FROM users u WHERE a.author_id IS NULL AND lower(a.author)=lower(u.name);
UPDATE articles SET author_id=(SELECT id FROM users WHERE role='super_admin' ORDER BY created_at,id LIMIT 1)
WHERE author_id IS NULL AND EXISTS (SELECT 1 FROM users WHERE role='super_admin');
ALTER TABLE articles ALTER COLUMN publication_status SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_publication_status ON articles(publication_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_requests_created ON author_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_requests_status_created ON author_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_invitations_active_email ON invitations(lower(email), expires_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
DO $$ BEGIN
  ALTER TABLE articles ADD CONSTRAINT articles_publication_status_check
    CHECK (publication_status IN ('draft','submitted','approved','revision_requested','rejected','published'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== migrations/004_complete_cms_models.sql =====
-- ByteJournal migration 004: complete relational CMS model set.
-- Additive and repeatable. Legacy article category/tags columns are retained for compatibility.

-- Normalized taxonomy
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  seo_title VARCHAR(180),
  meta_description VARCHAR(320),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_parent_sort ON categories(parent_id, sort_order);
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS article_categories (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(article_id, category_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_one_primary_category ON article_categories(article_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_article_categories_category ON article_categories(category_id, article_id);
CREATE TABLE IF NOT EXISTS article_tags (
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(article_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag_id, article_id);

-- Version history and public reader comments
CREATE TABLE IF NOT EXISTS article_revisions (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  excerpt VARCHAR(320) NOT NULL,
  content TEXT NOT NULL,
  change_summary VARCHAR(500),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  edited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(article_id, revision_number)
);
CREATE INDEX IF NOT EXISTS idx_article_revisions_article_date ON article_revisions(article_id, created_at DESC);
CREATE TABLE IF NOT EXISTS article_comments (
  id BIGSERIAL PRIMARY KEY,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES article_comments(id) ON DELETE CASCADE,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(254),
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  ip_hash VARCHAR(128),
  moderated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_comments_moderation ON article_comments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_comments_article ON article_comments(article_id, created_at);

-- CMS notifications and authentication/security records
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT,
  action_url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expiry ON user_sessions(user_id, expires_at DESC);
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254),
  ip_address INET,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason VARCHAR(80),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(lower(email), attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at DESC);

-- Site content, navigation, redirects, and communications
CREATE TABLE IF NOT EXISTS content_pages (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  excerpt VARCHAR(320),
  content TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  seo_title VARCHAR(180),
  meta_description VARCHAR(320),
  canonical_url TEXT,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_pages_status ON content_pages(status, updated_at DESC);
CREATE TABLE IF NOT EXISTS navigation_menus (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(60) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS navigation_menu_items (
  id BIGSERIAL PRIMARY KEY,
  menu_id BIGINT NOT NULL REFERENCES navigation_menus(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES navigation_menu_items(id) ON DELETE CASCADE,
  label VARCHAR(120) NOT NULL,
  item_type VARCHAR(20) NOT NULL DEFAULT 'custom' CHECK (item_type IN ('custom','page','category','article','external')),
  target_id BIGINT,
  url TEXT,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_navigation_items_menu_order ON navigation_menu_items(menu_id, parent_id, sort_order);
CREATE TABLE IF NOT EXISTS url_redirects (
  id BIGSERIAL PRIMARY KEY,
  source_path VARCHAR(500) NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  http_status SMALLINT NOT NULL DEFAULT 301 CHECK (http_status IN (301,302,307,308)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','subscribed','unsubscribed','bounced')),
  confirmation_token_hash TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  source VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_status_created ON newsletter_subscribers(status, created_at DESC);
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  subject VARCHAR(180),
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','archived','spam')),
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  ip_hash VARCHAR(128),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_status_date ON contact_messages(status, created_at DESC);

-- Extend existing media records with library-management metadata.
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS alt_text VARCHAR(320);
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS caption TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS folder VARCHAR(255) NOT NULL DEFAULT '/';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS checksum VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_media_assets_user_date ON media_assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_mime ON media_assets(mime_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_checksum ON media_assets(checksum) WHERE checksum IS NOT NULL;

-- Add useful profile and article administration fields without removing legacy fields.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS subtitle VARCHAR(240);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_articles_featured ON articles(featured, published_at DESC) WHERE status='published';
CREATE INDEX IF NOT EXISTS idx_articles_scheduled ON articles(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- Password reset storage must exist before its lookup index is created.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
-- Keep password-reset lookup fast and expire old tokens through routine cleanup.
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expiry ON password_reset_tokens(expires_at) WHERE used_at IS NULL;

-- ===== migrations/005_admin_profile_and_session_security.sql =====
-- Additive profile/session version support.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_website BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_active_email ON users(lower(email)) WHERE active=true;

-- ===== migrations/006_newsletter_consent.sql =====
-- Record explicit newsletter opt-in consent for footer subscriptions.
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_newsletter_consented_at ON newsletter_subscribers(consented_at DESC) WHERE consented_at IS NOT NULL;

-- ===== migrations/007_saved_articles.sql =====
-- ByteJournal migration 007: authenticated reader bookmarks for the public dashboard.
-- Additive and repeatable; article and account data are retained.
CREATE TABLE IF NOT EXISTS saved_articles (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id BIGINT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_articles_user_created
  ON saved_articles(user_id, created_at DESC);

-- ===== migrations/008_article_popularity.sql =====
ALTER TABLE articles ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_articles_popular
  ON articles(view_count DESC, published_at DESC)
  WHERE status = 'published';

-- ===== migrations/009_taxonomy_backfill.sql =====
WITH source_names AS (
  SELECT DISTINCT trim(category) AS name FROM articles WHERE trim(category) <> ''
), slugged AS (
  SELECT name, regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS base FROM source_names
), ranked AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS ordinal FROM slugged
)
INSERT INTO categories(name, slug)
SELECT name, left(COALESCE(NULLIF(base, ''), 'category') || CASE WHEN ordinal=1 THEN '' ELSE '-' || ordinal END, 120) FROM ranked ON CONFLICT (slug) DO NOTHING;
WITH source_names AS (
  SELECT DISTINCT trim(item.tag) AS name FROM articles a CROSS JOIN LATERAL unnest(a.tags) AS item(tag) WHERE trim(item.tag) <> ''
), slugged AS (
  SELECT name, regexp_replace(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS base FROM source_names
), ranked AS (
  SELECT name, base, row_number() OVER (PARTITION BY base ORDER BY name) AS ordinal FROM slugged
)
INSERT INTO tags(name, slug)
SELECT name, left(COALESCE(NULLIF(base, ''), 'tag') || CASE WHEN ordinal=1 THEN '' ELSE '-' || ordinal END, 100) FROM ranked ON CONFLICT (slug) DO NOTHING;
INSERT INTO article_categories(article_id, category_id, is_primary)
SELECT a.id, c.id, TRUE FROM articles a JOIN categories c ON lower(trim(a.category))=lower(c.name)
WHERE NOT EXISTS (SELECT 1 FROM article_categories existing WHERE existing.article_id=a.id)
ON CONFLICT (article_id, category_id) DO NOTHING;
INSERT INTO article_tags(article_id, tag_id)
SELECT DISTINCT a.id, t.id FROM articles a CROSS JOIN LATERAL unnest(a.tags) AS item(article_tag)
JOIN tags t ON lower(trim(item.article_tag))=lower(t.name)
ON CONFLICT (article_id, tag_id) DO NOTHING;

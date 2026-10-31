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

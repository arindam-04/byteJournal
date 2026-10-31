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

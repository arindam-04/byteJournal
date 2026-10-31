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

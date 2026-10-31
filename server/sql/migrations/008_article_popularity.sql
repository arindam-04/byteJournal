-- ByteJournal migration 008: public article view counts for the popular feed.
-- Additive and repeatable; existing articles begin with zero views.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_articles_popular
  ON articles(view_count DESC, published_at DESC)
  WHERE status = 'published';

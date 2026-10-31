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

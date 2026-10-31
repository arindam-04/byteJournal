-- Record explicit newsletter opt-in consent for footer subscriptions.
ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_newsletter_consented_at ON newsletter_subscribers(consented_at DESC) WHERE consented_at IS NOT NULL;

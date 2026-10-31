-- ByteJournal migration 010: allow Super Admins to grant main website editing.
-- Existing users do not receive the permission automatically.
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit_website BOOLEAN NOT NULL DEFAULT FALSE;

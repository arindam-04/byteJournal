# ByteJournal database operations

## Database setup

Install PostgreSQL 14 or newer on the host or use a managed PostgreSQL service. Create a database named `bytejournal`, create an application database user, and configure `DATABASE_URL` in the project-root `.env` file. Keep the database private; only the Node API should connect to it.

For an empty database, the application creates the legacy-compatible base tables, bootstraps the first admin from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then applies the numbered migrations. Migration 002 copies the legacy admin to `users` as `super_admin`.

To create the complete schema manually:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/sql/schema.sql
```

The SQL schema creates tables only; the first administrator is created by the application on startup. After running the SQL manually, start the backend normally so it can bootstrap the administrator and record migration checksums.

## Migration policy

- `server/sql/000_legacy_base.sql` creates the compatibility foundation.
- Numbered migrations add article metadata, roles/workflow, normalized CMS models, and authentication/support tables.
- `schema_migrations` records migration name, SHA-256 checksum, and application timestamp.
- PostgreSQL advisory locks prevent two API instances from applying migrations simultaneously.
- Each migration and its ledger insert run in one transaction.
- Never edit a migration that has already been applied in an environment. Add a new numbered migration instead. The application stops if a recorded checksum does not match the migration file.

Run migrations and check the expected models:

```bash
npm run db:migrate
npm run db:check
```

## Backups and restores

The platform-independent Node scripts call local PostgreSQL client tools using the `DATABASE_URL` in `.env`:

```bash
npm run db:backup
npm run db:restore -- backups/bytejournal-YYYY-MM-DDTHH-MM-SS-sssZ.dump
```

`pg_dump` and `pg_restore` must be installed and available on PATH. Restore uses `--clean --if-exists` and replaces matching objects in the target database. Stop application writes and take a separate backup before restoring. Back up `server/uploads` separately; database dumps do not include uploaded files.

## Compatibility notes

`articles.category`, `articles.tags`, and `articles.author` remain for compatibility with existing routes and stored articles. Migration `009_taxonomy_backfill.sql` populates the normalized taxonomy relations, and article create/edit transactions keep those relations synchronized with the existing fields. Revisions, reader comments, notifications, pages, navigation and redirects remain database foundations without complete management APIs/screens. Account sessions and newsletter/contact inbox flows have operational API support; newsletter campaign delivery is not included.

## Latest migration

Migration `009_taxonomy_backfill.sql` is the latest registered migration. It backfills normalized categories/tags from legacy article fields and is included in the consolidated `server/sql/schema.sql`. Migration `005_admin_profile_and_session_security.sql` adds the per-user token version used to invalidate old sessions after a password change.

# ByteJournal — Full-stack technical blog

ByteJournal is the existing React + Vite / Express / PostgreSQL application, extended in place. It includes a public technical blog, a protected multi-role CMS, Tiptap, local image uploads, article search and pagination, article metadata, sitemap/RSS endpoints, contributor applications, invitation-based account activation, editorial review, taxonomy management, appearance drafts/publication, and a view-count-based popular feed.

## Article editor

The CMS uses **Tiptap** (React integration) instead of CKEditor. The editor stores article bodies as HTML in the existing `articles.content` field, so the Express API and PostgreSQL schema do not need a content-format migration. It includes formatting, headings, lists, links, quotes, tables, code blocks with language selection, image uploads, image sizing and editable captions, YouTube embeds, text alignment, undo/redo, word count, preview, and fullscreen writing mode. Existing HTML articles remain in place; review legacy image/table markup after opening and saving older articles; legacy media embeds outside YouTube need manual checking.



> **Implementation status:** This is an upgraded development baseline, not a claim that every item in the original master specification is production-complete. The remaining work and unverified tests are listed at the end of this README.

## 1. Requirements

- Windows 11 (PowerShell or Windows Terminal)
- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm 10 or newer
- PostgreSQL 14 or newer

Check your versions:

```powershell
node --version
npm --version
psql --version
```

## 2. Create the PostgreSQL database

Generate the credentials first and keep the output private:

```powershell
node scripts/generate-secrets.mjs
```

Open PowerShell and connect to PostgreSQL (adjust the administrator account if yours differs):

```powershell
psql -U postgres
```

At the `postgres=#` prompt, use the generated `DATABASE_USER_PASSWORD` value in place of the placeholder:

```sql
CREATE USER bytejournal WITH PASSWORD 'PASTE_DATABASE_USER_PASSWORD_HERE';
CREATE DATABASE bytejournal OWNER bytejournal;
\q
```

The application creates the legacy-compatible base tables, bootstraps the first administrator, and applies migrations `001` through `009` during API startup. It does not drop or reset the database. Existing administrators and articles are preserved; legacy administrator records are copied into the new `users` table as `super_admin` accounts. Existing articles are assigned to a matching user where possible, with the first Super Admin used as a legacy owner fallback.

Migrations are recorded in `schema_migrations` with SHA-256 checksums and applied under a PostgreSQL advisory lock, one transaction per migration. The editorial workflow migration backfills `publication_status` only when needed and does not repeatedly overwrite workflow states. See [docs/DATABASE.md](docs/DATABASE.md) for fresh-install, migration, backup, and restore steps.

If `psql` is not on PATH, use the SQL Shell (psql) installed with PostgreSQL or add PostgreSQL's `bin` directory to PATH.

## 3. Configure environment variables

From the project root (`bytejournal-fullstack`):

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set:

- `DATABASE_URL` — PostgreSQL connection string using the `bytejournal` database user and its password
- `JWT_SECRET` — a unique random secret of at least 32 characters
- `ADMIN_EMAIL` — the first administrator email
- `ADMIN_PASSWORD` — a strong password of at least 12 characters
- `ADMIN_NAME` — display name for the initial Super Admin

Use the generated `JWT_SECRET` and `ADMIN_PASSWORD` from the script output. Set `DATABASE_URL` with the generated database user's password (the example uses a hexadecimal password, so it needs no URL encoding). Replace every `REPLACE_...` placeholder. Never commit `.env` or share database credentials/JWT secrets. The initial account is created only if `ADMIN_EMAIL` does not already exist in the legacy `admins` table. Changing the environment password later does not overwrite an existing account's password.

Other settings:

```dotenv
HOST=127.0.0.1
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173
COOKIE_SECURE=false
PGSSL=false
```

For a production HTTPS deployment, set `COOKIE_SECURE=true`, use a secure PostgreSQL connection, set `PUBLIC_SITE_URL` and `CLIENT_ORIGIN` to your actual public site origin, and configure your reverse proxy to pass the public `Host` and overwrite `X-Forwarded-Host` / `X-Forwarded-Proto` with trusted values. The API defaults to `HOST=127.0.0.1`; keep that for same-machine reverse-proxy hosting. If your hosting platform requires external binding, set `HOST=0.0.0.0` and use firewall rules to restrict API access. The backend validates same-origin requests against the public request origin and also accepts the exact configured origins. For split-origin deployments, set `CLIENT_ORIGIN` to a comma-separated list of exact frontend origins (scheme, hostname and port). If frontend and API use different top-level sites, cookie `SameSite` and `Secure` behavior needs additional configuration; same-origin routing is recommended.

If the frontend and API are on different origins, create `client/.env` from `client/.env.example` and set `VITE_API_URL` to the API origin (without a trailing slash). Ensure the backend CORS and trusted-origin settings match the frontend origin.

## 4. Install dependencies

Run in the project root:

```powershell
npm install
```

The archive intentionally excludes `node_modules`. npm installs the declared dependencies for both workspaces. The root workspace manifest contains the frontend and backend workspaces. The package registry timed out during this archive build, so a dependency-resolved `package-lock.json` could not be generated. Use `npm install` for this package. For reproducible future installs, generate and commit a root lockfile on a connected machine, then use `npm ci`.

## 5. Start ByteJournal

Start backend and frontend together:

```powershell
npm run dev
```

Or use two terminals from the project root.

Terminal 1 — backend:

```powershell
npm run dev:server
```

Terminal 2 — frontend:

```powershell
npm run dev:client
```

Open:

- Public website: http://localhost:5173
- CMS login and article desk: http://localhost:5173/cms
- New article: http://localhost:5173/cms/articles/new
- Edit article: http://localhost:5173/cms/articles/ARTICLE_ID/edit
- CMS management: http://localhost:5173/cms/management
- Become an Author: http://localhost:5173/become-an-author
- Backend health (checks PostgreSQL): http://localhost:4000/api/health
- Sitemap: http://localhost:5173/sitemap.xml (proxied to Express in development)
- RSS feed: http://localhost:5173/feed.xml (proxied to Express in development)
- robots.txt: http://localhost:5173/robots.txt (proxied to Express in development)

The first CMS login uses the credentials set in `.env`. New authors/admins/editors do not have public registration; an authorized administrator must create an invitation.

## 6. CMS roles and workflows

### Roles

- **Super Admin:** system-wide access, user role/account administration, invitations, author request decisions, global appearance configuration, article management and publishing.
- **Admin:** article/category/tag usage through the article form, author request decisions, contributor invitations and publishing operations. Admin invitations are restricted to author accounts.
- **Editor:** access to submitted article review, editing of submitted/approved articles, review comments, and author request viewing.
- **Author:** create and manage their own drafts, submit eligible drafts for editorial review, and view their own article review history. An author cannot publish directly or update another author's private draft.

### Editorial workflow

1. Author saves a draft.
2. Author chooses **Submit for review**.
3. Editor/Admin/Super Admin reviews the submitted article.
4. Reviewer approves, requests revisions, or rejects it.
5. An approved article can be published by a reviewer with publishing permission.

Super Admin and Admin can create and publish directly. Article ownership and role checks are enforced in the Express API, not just by the frontend.

### Invitations

Open **CMS → Management → Invitations**. Enter an email and choose a role. The API creates a high-entropy, one-time token, stores only its SHA-256 hash, and expires the invite after 72 hours. With SMTP configured, the invitation is emailed automatically; otherwise, the UI provides a one-time URL for manual delivery. Resend generates a fresh token, invalidates the old link, and emails the new link when SMTP is available. The invited person opens `/accept-invitation?token=...`, enters a name and a password of at least 12 characters, and the server hashes the password before creating the account.

### Author applications

Visitors can submit `/become-an-author`. The application is stored in PostgreSQL and does not create an account. Administrators can search/filter applications in **CMS → Management → Author requests**, add internal notes, approve/reject, and invite an approved applicant. Accepting a matching invitation changes its application status to `Completed`.

### Appearance

Only a Super Admin can edit appearance through **CMS → Management → Appearance** (also available at `/cms/settings/appearance`). Branding, palette/color, typography, layout, homepage section and theme settings are saved as a draft. Public visitors continue to see the last published snapshot until a Super Admin selects **Publish appearance**. Uploaded branding images use the shared Media Library.

### Media

Images uploaded through the article editor or appearance settings are stored under `server/uploads` and recorded in the Media Library. The media page supports browsing and copying asset URLs. It shows reference counts and prevents deletion while an asset is used by article content/covers, a profile photo, or published/draft appearance settings. Alt-text editing is still outstanding.

## 7. Useful commands

Run source checks and the included database-asset tests:

```powershell
npm run check
npm test
```

Run the database bootstrap/migrations and inspect the expected CMS tables:

```powershell
npm run db:migrate
npm run db:check
```

Build the frontend for production:

```powershell
npm run build
```

Start the production API after configuring `.env` and PostgreSQL:

```powershell
npm run start
```

## 8. Database and uploaded files

The complete fresh-install SQL is `server/sql/schema.sql`; the compatibility base is `server/sql/000_legacy_base.sql`, and additive migrations are in `server/sql/migrations/`. Startup applies migrations `001` through `009` and records their checksums in `schema_migrations`. `npm run db:migrate` runs the same safe bootstrap/migration path; `npm run db:check` checks the required table set.

Uploaded images are stored in `server/uploads`. Back up this folder together with PostgreSQL. The upload endpoint enforces a 5 MB maximum, checks the declared MIME type and verifies the file signature for JPG, PNG, WEBP and GIF. Do not expose the uploads directory as executable content on a production host.

## 9. Security notes

- Passwords are hashed with bcrypt.
- JWTs are stored in an HTTP-only cookie and signed with a configured environment secret.
- Protected requests reload the current user's active flag and role from PostgreSQL, so deactivation or role changes invalidate the old role/session on the next request.
- Backend role checks and article ownership constraints protect private drafts.
- Mutating API requests reject a mismatched browser `Origin`.
- Login and public author request endpoints have basic in-process rate limits.
- SQL statements use parameterized values.
- Uploads have size, MIME and file-signature checks.
- Public article HTML is sanitized with DOMPurify before rendering.
- Helmet security headers and credentialed CORS are enabled.

The in-memory rate limits are intended for a single-process deployment. A production multi-instance deployment should move rate limiting to a shared store, add structured monitoring/alerting, and review reverse-proxy trust, cookie policy, backups, secrets management and operational access controls.

## 10. SEO and rendering notes

Article pages set title, description, canonical, Open Graph and Twitter metadata and emit Article JSON-LD. The server exposes `sitemap.xml`, `robots.txt` and `feed.xml`; the Vite development proxy forwards these routes to Express. In production, configure the reverse proxy to route these paths to the API or serve equivalent generated files from the public origin.

The public frontend remains a client-rendered Vite React SPA. Metadata is updated after JavaScript loads; crawlers that do not execute JavaScript may not see per-article metadata in the initial HTML response. Stronger SEO requires prerendering/SSR for public article routes. Client-side metadata alone is not equivalent to server-rendered SEO.

## 11. Verification status and known limitations

### Checks to run for this package

- `npm run check` runs backend JavaScript syntax checks and the built-in database asset tests.
- `npm run build` runs the Vite production frontend build.
- `npm run db:migrate` and `npm run db:check` are included for staging/production database verification.
- Direct Node.js deployment files, optional reverse-proxy/process-manager examples, and platform-independent database backup/restore scripts are included.

### Verification not completed in this environment

- PostgreSQL is not available here, so migrations and the full schema have not been executed against a live PostgreSQL instance.
- Frontend dependencies are not installed, so the Vite production build could not be completed. Package registry access was unavailable during packaging; no root `package-lock.json` is included. Run `npm install` and `npm run build` on a connected machine.
- API startup/health, authentication, role permissions, invitation acceptance, article CRUD, image upload, password-reset email delivery, and browser-level responsive/accessibility/end-to-end testing have not been run against live services.


### Remaining work before production

- Configure a real email provider for invitation delivery and notifications.
- Add automated API/database integration tests, browser end-to-end tests, and a complete moderation/author-activity audit UI.
- Add media alt-text editing and image dimension/usage details.
- Add view-count deduplication and bot filtering before using popularity counts for editorial decisions.
- Add reliable draft autosave and browser-level checks for the new Tiptap editor; test legacy HTML image-caption/table parsing across representative existing articles.
- Add SSR/prerendering for article SEO and social previews.
- Review production multi-instance rate limiting, CSRF/cookie deployment configuration, backups, observability, invitation email delivery and security operations.

Implemented in this archive: category and tag CRUD with safe deletion rules; taxonomy backfill and article relation synchronization; appearance controls for branding, colors, typography, layout, homepage sections/order and theme preference; separate saved/published appearance settings; guarded deletion of unused media; and persisted article views with featured and popular homepage sections. These features still need live PostgreSQL and browser verification.

Do not deploy this archive as a finished production service until those items and the unrun integration checks are completed.

## Administrator password recovery

Transactional email is used for invitations, invitation resends, administrator password resets, and the CMS test-email button. Create the project-root `.env` from `.env.example`, then replace the SMTP sample values with credentials from your email provider:

```env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=ByteJournal <no-reply@your-domain.com>
PUBLIC_SITE_URL=https://your-site.example
```

Use port `587` with `SMTP_SECURE=false` for STARTTLS, or port `465` with `SMTP_SECURE=true` for implicit TLS. Set `PUBLIC_SITE_URL` to the exact public website origin so invitation and reset links point to the deployed site. Restart the API after changing `.env`, sign in as an admin, then use **CMS → Management → Invitations → Send test email**. A test message is sent to the signed-in account email. The API log records the SMTP error code if delivery fails. The form will show a manual invitation link if SMTP is unavailable.

The **Forgot password?** flow is for active `super_admin` and `admin` accounts. Reset links are single-use and expire after 30 minutes; passwords must contain at least 12 characters. Its response does not reveal whether an account exists. The public newsletter form stores opt-in subscribers but does not send newsletter campaigns, and the contact form stores messages without sending an email notification; those workflows need a separate campaign or notification setup.

## Complete PostgreSQL database model catalogue

Migration `004_complete_cms_models.sql` adds the normalized and extended models below. It is additive and repeatable; existing article fields (`category`, `tags`, `author`, and `content`) are retained for compatibility while normalized relations are available for future CRUD screens and API adoption.

| Area | Tables / models | Purpose |
|---|---|---|
| Identity & access | `users`, legacy `admins` | Accounts, role, profile, active/deleted state |
| Authentication | `password_reset_tokens`, `user_sessions`, `login_attempts` | One-time password recovery, revocable sessions, login audit/rate-limit data |
| Editorial content | `articles`, `article_revisions` | Article content, publication workflow, immutable revision snapshots |
| Taxonomy | `categories`, `tags`, `article_categories`, `article_tags` | Hierarchical categories and many-to-many article taxonomy |
| Editorial workflow | `invitations`, `author_requests`, `article_reviews`, `review_comments` | Contributor onboarding, review decisions, internal review discussion |
| Reader engagement | `article_comments`, `saved_articles` | Public comments/moderation and authenticated personal reading lists |
| Media | `media_assets` | Upload metadata, dimensions, alt text, captions, folders, checksums |
| CMS administration | `site_settings`, `audit_logs`, `notifications` | Configuration, administrator activity, user notifications |
| Pages & navigation | `content_pages`, `navigation_menus`, `navigation_menu_items`, `url_redirects` | Static pages, hierarchical menus, SEO redirects |
| Communication | `newsletter_subscribers`, `contact_messages` | Newsletter consent lifecycle and contact inbox |

### Database setup and migration behavior

- `server/sql/schema.sql` is now the consolidated SQL schema for a fresh database. Run it against an empty PostgreSQL database if you want to create the schema manually.
- Normal application startup creates the base tables, bootstraps the initial admin in the legacy table, copies it into `users` via migration `002`, and applies migrations `001` through `009` before serving requests. Password-reset storage is created by migration `004`; profile/session security is added by migration `005`; popularity counts and taxonomy backfill are added by migrations `008` and `009`.
- Migrations use additive/guarded SQL, are applied transactionally, and preserve existing records. Back up the database before deploying schema changes to a production instance.
- Existing `articles.category` and `articles.tags` columns are deliberately retained for compatibility. Migration `009` backfills the normalized taxonomy relations; article create/edit transactions keep those relations synchronized.
- New supporting models (revisions, comments, notifications, sessions, pages, menus, redirects, newsletter and contact inbox) are database foundations. Their CRUD APIs and UI screens still need implementation before those features are operational.
- Saved articles are persisted per authenticated user in `saved_articles` and exposed through the account API.
- The project has not been tested against a live PostgreSQL server in this environment. Apply the migration to a staging database and run API integration tests before production deployment.


## Project support files included

- `.env.example` — direct Node.js/PostgreSQL environment template; copy it to `.env` and replace every `REPLACE_` value.
- `scripts/generate-secrets.mjs` — creates a random JWT secret, a suggested PostgreSQL application-user password, and a one-time bootstrap admin password.
- `server/sql/000_legacy_base.sql` — base schema for new and existing databases.
- `server/sql/schema.sql` — consolidated SQL schema for manual fresh database setup.
- `server/src/db.js` — transactional, checksum-tracked migration runner protected by a PostgreSQL advisory lock.
- `server/scripts/migrate.js` and `server/scripts/db-check.js` — database setup and model-presence commands.
- `server/test/` — Node built-in checks for schema order, support files, appearance routes, popularity, taxonomy and media safeguards.
- `deploy/Caddyfile.example` — optional same-origin static hosting and API reverse-proxy example.
- `deploy/bytejournal-api.service.example` — optional systemd service template for the Node.js API.
- `server/scripts/backup.js` and `server/scripts/restore.js` — platform-independent PostgreSQL backup and restore using local `pg_dump` / `pg_restore` tools.
- `.github/workflows/ci.yml`, `.nvmrc`, `.editorconfig`, and `.gitignore` — CI, runtime version, editor defaults, and generated/private file exclusions.
- `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, and `docs/SECURITY.md` — operational instructions and pre-production checklist.
- `CHANGELOG.md` — summary of the support-file and database setup additions.

## Direct Node.js setup (no container runtime)

1. Install Node.js 20+, npm 10+, PostgreSQL 14+, and PostgreSQL client tools.
2. Create a PostgreSQL database and application user, then set `DATABASE_URL` in `.env`.
3. Copy `.env.example` to `.env`, generate secrets with `node scripts/generate-secrets.mjs`, and set the initial admin details and public URL.
4. Install dependencies and initialize the database:

```powershell
Copy-Item .env.example .env
node scripts/generate-secrets.mjs
npm install
npm run db:migrate
npm run db:check
npm run build
```

5. Run the API with `npm run start` and serve `client/dist` through your hosting web server. The API uses `HOST=127.0.0.1` by default; set `HOST=0.0.0.0` only when your hosting platform requires it, and then firewall the API port. For a same-origin deployment, proxy `/api`, `/uploads`, `/sitemap.xml`, `/feed.xml`, and `/robots.txt` to the Node API. An optional Caddy example and systemd service template are in `deploy/`.
6. For backups, run `npm run db:backup`; restore with `npm run db:restore -- path/to/backup.dump`. Make a separate backup of `server/uploads`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/DATABASE.md](docs/DATABASE.md), and [docs/SECURITY.md](docs/SECURITY.md) for full instructions.


### Admin profile

Signed-in users can open **My profile** from the CMS sidebar at `/cms/profile` to update their name, email, biography, expertise, and profile photo. Password changes require the current password and a new password of at least 12 characters. Updating a password invalidates other active sessions for that account.


### Troubleshooting update requests blocked with HTTP 403

If every create/edit/delete request fails with `ORIGIN_NOT_ALLOWED`, open browser DevTools → Network → failed `/api/...` request → Response. The response includes `diagnostics.receivedOrigin`, `diagnostics.host`, `diagnostics.forwardedHost`, `diagnostics.forwardedProto`, and `diagnostics.configuredOrigins`.

- For same-origin hosting, serve the frontend and proxy `/api` on the same public scheme/host/port. Preserve the browser-facing `Host` header.
- Set `CLIENT_ORIGIN` and `PUBLIC_SITE_URL` to the exact public origin, for example `https://www.example.com` (no path or trailing slash). Restart the Node API after changing `.env`.
- For a separately hosted frontend, add its exact origin to `CLIENT_ORIGIN`; multiple origins are comma-separated. Set `VITE_API_URL` in `client/.env` to the API origin and rebuild the frontend.
- Never fix this by allowing `*` origins or disabling the origin guard.


## Public website forms

The public footer newsletter form stores explicit opt-in subscriptions in `newsletter_subscribers`; its API is `POST /api/newsletter/subscribe`. This records the subscription and consent, but does not send newsletter campaigns by itself; configure a mailing service or delivery workflow separately. The Contact page stores messages in `contact_messages` through `POST /api/contact`; it does not send an email notification by itself. Both public endpoints validate input, include a honeypot field, and apply per-IP rate limits. Apply database migrations with `npm run db:migrate` before using these forms.

The social icons in the footer currently link to the social platforms' home pages. Replace those URLs in `client/src/components/Footer.jsx` with the official ByteJournal profile URLs when the accounts are available. Legal pages are starter text and must be reviewed against the operator's actual practices and applicable law before publication.

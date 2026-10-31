# ByteJournal deployment (Node.js, no containers)

This project is deployed directly with Node.js, npm, PostgreSQL, and a static-file web server/reverse proxy. No container runtime is required.

## Requirements

- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm 10 or newer
- PostgreSQL 14 or newer
- PostgreSQL command-line tools (`psql`, `pg_dump`, `pg_restore`) for database setup and backups
- A web server/reverse proxy such as Caddy, Apache, or a managed hosting proxy for production HTTPS and static frontend hosting

## 1. Create the database

Generate secrets first from the project root:

```bash
node scripts/generate-secrets.mjs
```

Use the generated `DATABASE_USER_PASSWORD` in place of the value below, then connect with `psql` as a PostgreSQL administrator and create the application user/database:

```sql
CREATE USER bytejournal WITH PASSWORD 'PASTE_DATABASE_USER_PASSWORD_HERE';
CREATE DATABASE bytejournal OWNER bytejournal;
```

Keep PostgreSQL private; the browser must never connect directly to it.

## 2. Configure the application

From the project root:

```bash
cp .env.example .env
node scripts/generate-secrets.mjs
```

Put the same database-user password into `DATABASE_URL` (the generated value is hexadecimal and safe in a connection URL). Copy the generated `JWT_SECRET` and `ADMIN_PASSWORD` into `.env`, then fill in `ADMIN_EMAIL` and `ADMIN_NAME`. Set `PUBLIC_SITE_URL` to the canonical public URL. Set `COOKIE_SECURE=true` when the site is served over HTTPS. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` to enable invitation and password-reset emails. Port `587` normally uses `SMTP_SECURE=false` (STARTTLS); port `465` uses `SMTP_SECURE=true` (implicit TLS). Restart the API after changing `.env`, then send a test email from **CMS → Management → Invitations**. Newsletter campaigns and contact-message notifications are not part of the SMTP transaction flow.

For a same-origin deployment, configure the web server to serve `client/dist` and proxy `/api`, `/uploads`, `/sitemap.xml`, `/feed.xml`, and `/robots.txt` to `http://127.0.0.1:4000`. Set both `PUBLIC_SITE_URL` and `CLIENT_ORIGIN` to the public website origin. Preserve the public `Host` header. If the proxy sends `X-Forwarded-Host` / `X-Forwarded-Proto`, it must overwrite them with trusted values. Keep the Node API bound to localhost or a private network.

For a split-origin deployment, set `VITE_API_URL` in `client/.env` to the API origin (no trailing slash), set `CLIENT_ORIGIN` to the exact frontend origin, and set `PUBLIC_SITE_URL` to the public site. Cookie behavior across different top-level sites needs a separate SameSite/Secure review; same-origin routing is recommended.

## 3. Install, migrate, and build

```bash
npm install
npm run db:migrate
npm run db:check
npm run build
```

The frontend production files are generated in `client/dist`. The API runs from `server/src/index.js` and stores uploads in `server/uploads`.

## 4. Run the API

For a foreground test:

```bash
npm run start
```

The default API port is `4000`; set `PORT` in `.env` if needed. Check `http://127.0.0.1:4000/api/health` from the server machine.

For production, use a process supervisor such as systemd or PM2 so the API restarts after reboots and crashes. An example systemd unit is provided at `deploy/bytejournal-api.service.example`; edit its paths and service user before installing it. Do not run the API as root.

## 5. Configure the web server

`deploy/Caddyfile.example` shows one same-origin Caddy configuration. Replace the domain and absolute frontend path before use. If you use Apache, a hosting control panel, or another reverse proxy, configure equivalent rules:

- Serve the SPA from `client/dist` and fall back to `index.html` for client routes.
- Proxy `/api/*` and `/uploads/*` to the Node API.
- Proxy `/sitemap.xml`, `/feed.xml`, and `/robots.txt` to the Node API.
- Preserve the public Host header; overwrite forwarded protocol/host headers with trusted values if the proxy emits them.
- Enable HTTPS and set `COOKIE_SECURE=true`.

Do not expose the Node API or PostgreSQL port publicly unless your network design explicitly requires it.

## 6. Updates

```bash
git pull
npm install
npm run db:migrate
npm run build
```

Restart the API process through your process supervisor after deploying server changes. Back up the database and `server/uploads` before updates that affect schema or media storage.

## 7. Database backup and restore

Install PostgreSQL client tools and ensure `pg_dump` and `pg_restore` are on PATH. Then:

```bash
npm run db:backup
npm run db:restore -- backups/bytejournal-YYYY-MM-DDTHH-MM-SS-sssZ.dump
```

Restore is destructive for matching database objects and requires typing `RESTORE`. Back up `server/uploads` separately; SQL/database dumps do not contain uploaded image files.


## Troubleshooting: update requests return 403

A 403 response with code `ORIGIN_NOT_ALLOWED` means the browser Origin did not match the configured frontend origins or the public request host. Inspect the failed request's JSON `diagnostics` object in DevTools → Network → Response. Set `CLIENT_ORIGIN` and `PUBLIC_SITE_URL` to the exact origin users visit (scheme + hostname + optional port, no path), then restart the API. For split-origin hosting, list every exact frontend origin in the comma-separated `CLIENT_ORIGIN` value and set `VITE_API_URL` before rebuilding the frontend. Do not use wildcard origins.

## Public React routes and SPA fallback

The public frontend uses React Router paths such as `/articles`, `/categories/:categorySlug`, `/tutorials`, `/tech-news`, `/about`, `/search`, `/login`, and `/dashboard`. The static web server must serve `client/dist/index.html` for unknown frontend paths so direct URL visits and browser refreshes reach React Router. Do not proxy these public paths to the API; proxy only `/api/*`, `/uploads/*`, and the site's feed/SEO endpoints to the Node API.

The example Caddy configuration already includes `try_files {path} /index.html`. For Nginx, the frontend server block should include `try_files $uri $uri/ /index.html;` in the `location /` block.

## Content classification for public collections

The Tutorials page reads published articles tagged `tutorial`; use one additional tag (`beginner`, `intermediate`, or `advanced`) to classify difficulty. Developer Guides and Code Examples use the tags `developer-guide` and `code-example`. The Tech News page reads published articles tagged `news`. Category pages use the article's existing `category` value; align the spelling with the display category (or the documented alias list in `CategoryDetailView.jsx`). These collections intentionally use the existing article API and do not create parallel content tables.

## Account route notes

`/login` uses the existing secure publishing-account authentication. `/register` is invitation-token activation because the backend currently has no public self-service reader-registration endpoint. `/dashboard` is protected by the existing authenticated publishing session and shows the current account, permitted article workspace, and personal saved-article list. Bookmarks are stored per account in `saved_articles`; signed-in users can save or remove published articles from the article detail page.

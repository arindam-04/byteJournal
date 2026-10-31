# Changelog

## Unreleased — October 30, 2026

- Added a complete fresh-install base SQL file and rebuilt the consolidated PostgreSQL schema in dependency order.
- Fixed password-reset schema ordering so `password_reset_tokens` exists before its indexes are created.
- Added transactional, checksum-tracked migrations protected by a PostgreSQL advisory lock.
- Added database migration and required-table check commands, plus built-in schema/source tests.
- Removed container-specific deployment files and switched the project documentation to direct Node.js/PostgreSQL hosting.
- Added optional Caddy reverse-proxy and systemd service examples for non-container deployment.
- Added cross-platform Node.js PostgreSQL backup/restore commands using local `pg_dump` and `pg_restore`, plus updated database, deployment and security documentation.
- Corrected uploaded-file storage to use the documented `server/uploads` directory.
- Added a GitHub Actions workflow for source checks and the frontend build.

## Become an Author page refresh

- Rebuilt the public contributor application page as a responsive editorial split layout with a contributor introduction, benefits, review steps, and a dedicated application form.
- Grouped application fields into profile, writing experience, links, and motivation sections with helper text and character counters.
- Added browser-side required, URL, character-count, and minimum-length validation aligned with the author application API.
- Routed submissions through the shared API client for consistent credentials and error handling, with accessible error and success states.

## Article content theme fix

- Replaced fixed light-only Tiptap editor colors with shared light/dark theme tokens for the editor surface, toolbar, text, headings, links, quotes, tables, borders, and placeholder text.
- Updated published article rich-text colors so paragraphs, headings, inline legacy spans, links, quotes, captions, and tables remain readable when the site theme changes.
- Kept code blocks and syntax-highlighted code on a dedicated high-contrast surface so article theme rules do not wash out syntax colors.

## Admin profile and account security
- Added a dedicated CMS **My profile** page with editable name, email, expertise, biography, and uploaded profile photo.
- Added current-password verification, password confirmation, and a 12-character minimum for signed-in password changes.
- Added token-version session invalidation after a password update and invalidated outstanding password-reset links.
- Added migration `005_admin_profile_and_session_security.sql` and included it in the consolidated schema.

## Direct Node.js deployment update

- Removed container orchestration manifests, container build files, container ignore files, and the bundled Nginx container configuration.
- Replaced container-dependent backup/restore scripts with Node.js wrappers that call host PostgreSQL command-line tools.
- Added a Node.js-only deployment guide, Caddy configuration example, and systemd service template.
- Updated trusted-origin configuration to include both `CLIENT_ORIGIN` and `PUBLIC_SITE_URL`.

## Public navigation and content routes

- Added a responsive sticky public header with accessible category/account dropdowns, expandable search, theme toggle, and mobile navigation.
- Added dedicated public routes for articles, categories and category detail, tutorials, tech news, about, search, login, invitation activation, dashboard, FAQs, contact, and legal pages.
- Connected public listings and search to existing PostgreSQL-backed article/category APIs; tutorials and news use documented article tags.
- Added authenticated saved-article bookmarks with migration `007_saved_articles.sql`, API endpoints, article-page save controls, and a dashboard reading list.
- Added route-aware public meta descriptions, fixed page title handling and the login password-reset link, and corrected article-list pagination URL updates.

## Footer, taxonomy, popularity and appearance update

- Kept the public footer aligned to the 1440px header width and the newsletter on the right-hand desktop column, with tablet and mobile layouts covered by a regression check.
- Added protected category and tag CRUD screens and routes, synchronized article taxonomy relations inside create/edit transactions, and backfilled existing category/tag data with migration `009_taxonomy_backfill.sql`.
- Added persisted article view counts, featured article management, a popular articles API, and configurable featured/latest/popular homepage sections with migration `008_article_popularity.sql`.
- Expanded Super Admin appearance controls for logos, favicon and social image uploads, colors/palettes, fonts, layouts, homepage sections, display order and theme preference.
- Split appearance drafts from the published settings snapshot; public visitors continue to see the published version until a Super Admin publishes changes.
- Added reference checks and guarded deletion for media files already used by articles, account profiles or appearance settings.
- Added source-level tests for taxonomy, popularity, appearance and media safety. Live PostgreSQL, frontend build and browser integration tests remain unverified in this environment.

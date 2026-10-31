import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('fresh-install base schema creates the legacy tables before migrations', async () => {
  const base = await read('server/sql/000_legacy_base.sql');
  assert.match(base, /CREATE TABLE IF NOT EXISTS admins/i);
  assert.match(base, /CREATE TABLE IF NOT EXISTS articles/i);
});

test('password-reset table is created before its indexes', async () => {
  const migration = await read('server/sql/migrations/004_complete_cms_models.sql');
  const createAt = migration.indexOf('CREATE TABLE IF NOT EXISTS password_reset_tokens');
  const indexAt = migration.indexOf('idx_password_reset_tokens_expiry');
  assert.notEqual(createAt, -1, 'password_reset_tokens table definition is present');
  assert.notEqual(indexAt, -1, 'password reset expiry index is present');
  assert.ok(createAt < indexAt, 'table must be created before index');
});

test('consolidated schema includes all migration models in dependency order', async () => {
  const schema = await read('server/sql/schema.sql');
  const markers = [
    '000_legacy_base.sql',
    '001_article_metadata_and_indexes.sql',
    '002_multi_author_cms.sql',
    '003_cms_integrity_and_indexes.sql',
    '004_complete_cms_models.sql',
    '005_admin_profile_and_session_security.sql',
    '006_newsletter_consent.sql',
    '007_saved_articles.sql',
    '008_article_popularity.sql',
    '009_taxonomy_backfill.sql'
  ].map((name) => schema.indexOf(name));
  assert.ok(markers.every((position) => position >= 0));
  assert.deepEqual([...markers].sort((a, b) => a - b), markers);
  for (const table of ['categories','article_revisions','article_comments','notifications','user_sessions','content_pages','navigation_menus','url_redirects','newsletter_subscribers','contact_messages','password_reset_tokens','saved_articles']) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i'), `${table} should be in schema.sql`);
  }
});

test('upload storage path matches the documented server/uploads directory', async () => {
  const source = await read('server/src/index.js');
  assert.match(source, /path\.resolve\(__dirname, '\.\.\/uploads'\)/);
});

test('admin profile and password security migration is registered and additive', async () => {
  const db = await read('server/src/db.js');
  const migration = await read('server/sql/migrations/005_admin_profile_and_session_security.sql');
  const schema = await read('server/sql/schema.sql');
  assert.match(db, /005_admin_profile_and_session_security\.sql/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0/i);
  assert.match(schema, /migrations\/005_admin_profile_and_session_security\.sql/);
});

test('admin profile endpoints are authenticated and password changes rotate session versions', async () => {
  const source = await read('server/src/index.js');
  assert.match(source, /app\.get\('\/api\/auth\/profile', requireAdmin/);
  assert.match(source, /app\.put\('\/api\/auth\/profile', requireAdmin/);
  assert.match(source, /app\.post\('\/api\/auth\/change-password', requireAdmin/);
  assert.match(source, /bcrypt\.compare\(parsed\.data\.currentPassword, account\.password_hash\)/);
  assert.match(source, /token_version=token_version\+1/);
  assert.match(source, /Number\(payload\.ver \?\? 0\) !== Number\(user\.token_version \?\? 0\)/);
});

test('CMS exposes a dedicated profile page and profile/password actions', async () => {
  const app = await read('client/src/App.jsx');
  const cms = await read('client/src/views/CMSView.jsx');
  const api = await read('client/src/api.js');
  assert.match(app, /path="\/cms\/profile"/);
  assert.match(cms, /AdminProfilePanel/);
  assert.match(cms, /to="\/cms\/profile"/);
  assert.match(api, /updateProfile:/);
  assert.match(api, /changePassword:/);
});


test('API origin protection supports reverse proxies and trusts both configured public origins', async () => {
  const source = await read('server/src/index.js');
  const policy = await read('server/src/origin-policy.js');
  assert.match(source, /isTrustedRequestOrigin\(req, origin, allowedOrigins\)/);
  assert.match(source, /isCorsOriginAllowed\(origin, allowedOrigins\)/);
  assert.match(source, /process\.env\.CLIENT_ORIGIN/);
  assert.match(source, /process\.env\.PUBLIC_SITE_URL/);
  assert.match(source, /dotenv\.config\(\{ path: path\.resolve\(__dirname, '\.\.\/\.\.\/\.env'\) \}\)/);
  assert.match(policy, /x-forwarded-host/);
  assert.match(policy, /x-forwarded-proto/);
});

test('container-specific deployment files are not part of the non-container package', async () => {
  for (const relative of [
    'docker-compose.yml', 'server/Dockerfile', 'client/Dockerfile',
    'server/.dockerignore', 'client/.dockerignore', 'client/nginx.conf'
  ]) {
    await assert.rejects(fs.access(path.join(root, relative)), `${relative} should be removed`);
  }
});


test('newsletter consent migration is registered and idempotent', async () => {
  const db = await read('server/src/db.js');
  const migration = await read('server/sql/migrations/006_newsletter_consent.sql');
  const schema = await read('server/sql/schema.sql');
  assert.match(db, /006_newsletter_consent\.sql/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ/i);
  assert.match(schema, /migrations\/006_newsletter_consent\.sql/);
});

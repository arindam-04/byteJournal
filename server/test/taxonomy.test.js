import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('taxonomy backfill preserves legacy article categories and tags', async () => {
  const migration = await read('server/sql/migrations/009_taxonomy_backfill.sql');
  assert.match(migration, /INSERT INTO categories\(name, slug\)/i);
  assert.match(migration, /INSERT INTO tags\(name, slug\)/i);
  assert.match(migration, /INSERT INTO article_categories/i);
  assert.match(migration, /INSERT INTO article_tags/i);
  assert.match(migration, /ON CONFLICT \(slug\) DO NOTHING/i);
});

test('category and tag administration has authenticated role-checked CRUD routes', async () => {
  const server = await read('server/src/index.js');
  const api = await read('client/src/api.js');
  const management = await read('client/src/views/CMSManagementView.jsx');
  for (const route of ['/api/admin/categories', '/api/admin/tags']) {
    assert.ok(server.includes(route), `${route} is implemented`);
  }
  assert.match(server, /app\.post\('\/api\/admin\/categories', requireAdmin, allowRoles\('super_admin','admin'\)/);
  assert.match(server, /app\.post\('\/api\/admin\/tags', requireAdmin, allowRoles\('super_admin','admin'\)/);
  assert.match(server, /deactivate it to preserve article history/i);
  assert.match(api, /createCategory:/);
  assert.match(api, /createTag:/);
  assert.match(management, /tab==='categories'/);
  assert.match(management, /tab==='tags'/);
});

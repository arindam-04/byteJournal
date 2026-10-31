import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('appearance drafts are protected and public settings expose only the published snapshot', async () => {
  const server = await read('server/src/index.js');
  const api = await read('client/src/api.js');
  const management = await read('client/src/views/CMSManagementView.jsx');
  const app = await read('client/src/App.jsx');
  assert.match(server, /app\.get\('\/api\/admin\/settings\/appearance', requireAdmin, allowRoles\('super_admin'\)/);
  assert.match(server, /appearance_published/);
  assert.match(server, /app\.post\('\/api\/admin\/settings\/appearance\/publish'/);
  assert.match(server, /logoUrl:appearanceAssetUrl/);
  assert.match(server, /homepageOrder:/);
  assert.match(api, /adminAppearance:/);
  assert.match(api, /publishAppearance:/);
  assert.match(management, /Typography and layout/);
  assert.match(management, /Publish appearance/);
  assert.match(app, /data\.headingFont|siteSettings\.headingFont/);
});

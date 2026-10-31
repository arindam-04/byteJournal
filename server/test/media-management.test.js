import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('media deletion checks article, profile and appearance usage before removing files', async () => {
  const server = await read('server/src/index.js');
  const api = await read('client/src/api.js');
  const management = await read('client/src/views/CMSManagementView.jsx');
  assert.match(server, /app\.delete\('\/api\/admin\/media\/:id'/);
  assert.match(server, /position\(\$1 in a\.content\)>0/);
  assert.match(server, /account\.avatar_url=\$1/);
  assert.match(server, /setting\.setting_value::text/);
  assert.match(server, /This asset is in use/);
  assert.match(api, /deleteMedia:/);
  assert.match(management, /Delete unused asset/);
});

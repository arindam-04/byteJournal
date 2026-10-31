import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('new and resent invitations send the one-time activation link through configured SMTP', async () => {
  const server = await read('server/src/index.js');
  const cms = await read('client/src/views/CMSManagementView.jsx');
  const env = await read('.env.example');
  const readme = await read('README.md');

  assert.match(server, /async function deliverInvitationEmail\(email, role, token\)/);
  assert.match(server, /subject: 'You are invited to ByteJournal'/);
  assert.match(server, /await transport\.sendMail\(/);
  assert.match(server, /const delivery = await deliverInvitationEmail\(inviteEmail, parsed\.data\.role, token\)/);
  assert.match(server, /const delivery = await deliverInvitationEmail\(r\.rows\[0\]\.email, r\.rows\[0\]\.role, token\)/);
  assert.match(server, /return \{ delivery: 'manual', acceptanceUrl \}/);
  assert.match(server, /return \{ delivery: 'failed', acceptanceUrl \}/);
  assert.match(server, /return \{ delivery: 'sent' \}/);
  assert.match(cms, /and email sent/);
  assert.match(cms, /Resend invitation/);
  assert.match(cms, /copy a one-time link for manual delivery/);
  for (const key of ['SMTP_HOST=', 'SMTP_PORT=', 'SMTP_USER=', 'SMTP_PASS=', 'SMTP_FROM=']) assert.ok(env.includes(key), `environment example includes ${key}`);
  assert.match(readme, /creation and resend email the one-time acceptance link/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('public site text loads with public settings and admin writes are role-protected and persisted', async () => {
  const server = await read('server/src/index.js');
  const api = await read('client/src/api.js');
  assert.match(server, /setting_key='site_content'/);
  assert.match(server, /app\.get\('\/api\/admin\/site-content', requireAdmin, allowRoles\('super_admin','admin'\)/);
  assert.match(server, /app\.put\('\/api\/admin\/site-content\/:key', requireAdmin, allowRoles\('super_admin','admin'\)/);
  assert.match(server, /z\.object\(\{value:z\.string\(\)\.max\(10000\)\}\)/);
  assert.match(server, /COALESCE\(site_settings\.setting_value,'\{\}'::jsonb\)\|\|jsonb_build_object/);
  assert.match(server, /site_content\.updated/);
  assert.match(api, /updateSiteText:.*PUT/);
});

test('site text editor is admin-only in the client and updates displayed text after save', async () => {
  const editor = await read('client/src/components/SiteText.jsx');
  const header = await read('client/src/components/Header.jsx');
  const app = await read('client/src/App.jsx');
  assert.match(editor, /\['super_admin', 'admin'\]\.includes\(adminUser\?\.role\)/);
  assert.match(editor, /await api\.updateSiteText\(activeText\.key, draft\)/);
  assert.match(editor, /setContent\(current => \(\{ \.\.\.current, \[activeText\.key\]: draft \}\)\)/);
  assert.match(header, /Edit website/);
  assert.match(app, /<SiteContentProvider initialContent=\{siteContent\}>/);
});

test('all public page routes and shared public chrome expose click-to-edit copy', async () => {
  const routes = [
    'HomeView.jsx', 'ArticlesView.jsx', 'ArticleView.jsx', 'CategoriesView.jsx', 'CategoryDetailView.jsx',
    'TopicCollectionView.jsx', 'AboutView.jsx', 'SearchView.jsx', 'NotFoundView.jsx', 'AuthorProfileView.jsx',
    'ContactView.jsx', 'LegalView.jsx', 'FaqsView.jsx', 'LoginView.jsx', 'RegisterView.jsx',
    'DashboardView.jsx', 'AcceptInvitationView.jsx', 'BecomeAuthorView.jsx'
  ];
  for (const view of routes) {
    const source = await read(`client/src/views/${view}`);
    assert.match(source, /SiteText/, `${view} includes editable public copy`);
  }
  for (const component of ['Header.jsx', 'Footer.jsx', 'ArticleCard.jsx']) {
    const source = await read(`client/src/components/${component}`);
    assert.match(source, /SiteText/, `${component} includes editable shared copy`);
  }
});

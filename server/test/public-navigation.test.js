import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('public route table includes the requested dedicated pages and category/article detail routes', async () => {
  const app = await read('client/src/App.jsx');
  for (const route of [
    'articles', 'articles/:slug', 'categories', 'categories/:categorySlug', 'tutorials', 'tech-news', 'about',
    'become-author', 'search', 'login', 'register', 'dashboard', 'contact', 'privacy-policy', 'terms', 'cookie-policy', 'disclaimer', 'faqs'
  ]) assert.ok(app.includes(`path="/${route}"`) || app.includes(`path="${route}"`), `route exists: ${route}`);
  assert.match(app, /PublicLayout/);
  assert.match(app, /CMSView/);
});

test('header has responsive accessible navigation, category links, search, theme and account actions', async () => {
  const header = await read('client/src/components/Header.jsx');
  const css = await read('client/src/components/Header.css');
  for (const text of ['Home','Articles','Categories','Tutorials','Tech News','About Us','Search','Write for Us','Login','Register','Dashboard','aria-expanded','aria-haspopup','Escape']) {
    assert.ok(header.includes(text), `header includes ${text}`);
  }
  for (const slug of ['web-development','programming-languages','artificial-intelligence','data-structures-algorithms','system-design','cloud-computing-devops','cybersecurity','database-management','computer-networks','open-source']) assert.ok(header.includes(slug));
  assert.match(css, /@media\(max-width:980px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
});

test('article cards use plural article detail URLs and search/category pages use real public APIs', async () => {
  const card = await read('client/src/components/ArticleCard.jsx');
  const api = await read('client/src/api.js');
  const articles = await read('client/src/views/ArticlesView.jsx');
  const search = await read('client/src/views/SearchView.jsx');
  assert.match(card, /\/articles\/\$\{article\.slug\}/);
  assert.match(api, /categories: \(\) => request\('\/categories'\)/);
  assert.match(articles, /api\.articles/);
  assert.match(search, /api\.articles/);
  assert.match(search, /api\.categories/);
  assert.match(search, /RELATED TOPICS/);
});

test('tutorial and news collections are driven by published article tags rather than placeholder content', async () => {
  const collections = await read('client/src/views/TopicCollectionView.jsx');
  assert.match(collections, /'tutorial'/);
  assert.match(collections, /tag=news/);
  assert.match(collections, /developer-guide/);
  assert.match(collections, /code-example/);
});

test('saved article reading list is authenticated, persisted, and exposed in the reader dashboard', async () => {
  const source = await read('server/src/index.js');
  const api = await read('client/src/api.js');
  const article = await read('client/src/views/ArticleView.jsx');
  const dashboard = await read('client/src/views/DashboardView.jsx');
  const migration = await read('server/sql/migrations/007_saved_articles.sql');
  const db = await read('server/src/db.js');
  const schema = await read('server/sql/schema.sql');
  assert.match(db, /007_saved_articles\.sql/);
  assert.match(schema, /migrations\/007_saved_articles\.sql/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS saved_articles/i);
  assert.match(source, /app\.get\('\/api\/account\/saved-articles', requireAdmin/);
  assert.match(source, /app\.post\('\/api\/account\/saved-articles\/:articleId', requireAdmin/);
  assert.match(source, /app\.delete\('\/api\/account\/saved-articles\/:articleId', requireAdmin/);
  assert.match(api, /savedArticles:/);
  assert.match(api, /saveArticle:/);
  assert.match(api, /unsaveArticle:/);
  assert.match(article, /Save article/);
  assert.match(dashboard, /Saved articles/);
  assert.match(dashboard, /removeSaved/);
});

test('public page metadata is route-aware and global site title does not overwrite inner pages', async () => {
  const app = await read('client/src/App.jsx');
  const layout = await read('client/src/layouts/PublicLayout.jsx');
  const login = await read('client/src/views/LoginView.jsx');
  assert.match(app, /window\.location\.pathname === '\/'/);
  assert.match(layout, /meta\[name="description"\]/);
  assert.match(layout, /\/tech-news/);
  assert.match(login, /to="\/cms\/reset-password"/);
});

test('homepage has a functional consent-based newsletter form', async () => {
  const home = await read('client/src/views/HomeView.jsx');
  assert.match(home, /api\.newsletterSubscribe/);
  assert.match(home, /newsletterConsent/);
  assert.match(home, /home-newsletter-email/);
});

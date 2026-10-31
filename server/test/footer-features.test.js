import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (relative) => fs.readFile(path.join(root, relative), 'utf8');

test('footer exposes all requested navigation, social, legal, and accessibility features', async () => {
  const footer = await read('client/src/components/Footer.jsx');
  for (const term of ['Articles', 'Categories', 'About Us', 'Contact', 'Become an Author', 'Web Development', 'Programming', 'AI & Machine Learning', 'Cybersecurity', 'Cloud Computing', 'System Design', 'Databases', 'Tutorials', 'Developer Guides', 'Code Examples', 'FAQs', 'GitHub', 'LinkedIn', 'X (Twitter)', 'YouTube', 'Privacy Policy', 'Terms & Conditions', 'Cookie Policy', 'Disclaimer', 'Back to top', 'aria-live']) {
    assert.ok(footer.includes(term), `footer includes ${term}`);
  }
});

test('footer newsletter and contact forms use working API methods', async () => {
  const api = await read('client/src/api.js');
  const server = await read('server/src/index.js');
  assert.match(api, /newsletterSubscribe:.*newsletter\/subscribe/);
  assert.match(api, /sendContactMessage:.*contact/);
  assert.match(server, /app\.post\('\/api\/newsletter\/subscribe'/);
  assert.match(server, /app\.post\('\/api\/contact'/);
  assert.match(server, /consented_at=NOW\(\)/);
});

test('public footer routes exist and about anchor targets a real section', async () => {
  const app = await read('client/src/App.jsx');
  const home = await read('client/src/views/HomeView.jsx');
  assert.match(app, /path="\/contact"/);
  assert.match(app, /path="\/legal\/:slug"/);
  assert.match(home, /id="about"/);
});


test('footer shares the header content width and places newsletter on the right', async () => {
  const footer = await read('client/src/components/Footer.jsx');
  const footerCss = await read('client/src/components/Footer.css');
  const headerCss = await read('client/src/components/Header.css');
  const gridStart = footer.indexOf('<div className="footer-main-grid">');
  const newsletter = footer.indexOf('<section className="footer-newsletter-column"');
  const gridEnd = footer.indexOf('</div>\n\n        <div className="footer-bottom-row">');

  assert.ok(gridStart >= 0 && newsletter > gridStart && newsletter < gridEnd,
    'newsletter section is a right-hand column inside the main footer grid');
  assert.match(footerCss, /\.footer-shell\s*\{[^}]*max-width:\s*1440px/s);
  assert.match(headerCss, /\.bj-header-inner\s*\{[^}]*max-width:\s*1440px/s);
  assert.match(footerCss, /minmax\(260px,\s*1\.45fr\)/);
  assert.match(footerCss, /\.footer-newsletter-column\s*\{[^}]*border-left:\s*1px solid var\(--line\)/s);
  assert.match(footerCss, /@media \(max-width: 1080px\)[\s\S]*?\.footer-newsletter-column\s*\{[^}]*grid-column:\s*3/s);
  assert.match(footerCss, /@media \(max-width: 620px\)[\s\S]*?\.footer-newsletter-column\s*\{[^}]*grid-column:\s*1 \/ -1/s);
});

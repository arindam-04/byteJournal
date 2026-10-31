import { pool } from '../src/db.js';

const expectedTables = [
  'admins', 'users', 'articles', 'schema_migrations', 'password_reset_tokens',
  'invitations', 'author_requests', 'article_reviews', 'review_comments',
  'site_settings', 'media_assets', 'audit_logs', 'categories', 'tags',
  'article_categories', 'article_tags', 'article_revisions', 'article_comments',
  'notifications', 'user_sessions', 'login_attempts', 'content_pages',
  'navigation_menus', 'navigation_menu_items', 'url_redirects',
  'newsletter_subscribers', 'contact_messages', 'saved_articles'
];

try {
  const result = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`
  );
  const actual = new Set(result.rows.map((row) => row.table_name));
  const missing = expectedTables.filter((table) => !actual.has(table));
  if (missing.length) {
    console.error(`Database is reachable, but ${missing.length} expected table(s) are missing:`);
    for (const table of missing) console.error(` - ${table}`);
    console.error('Run: npm run db:migrate');
    process.exitCode = 1;
  } else {
    const migrations = await pool.query(
      'SELECT migration_name, applied_at FROM schema_migrations ORDER BY migration_name'
    );
    console.log(`Database check passed. Found ${expectedTables.length} expected tables.`);
    console.log(`Recorded migrations: ${migrations.rows.map((row) => row.migration_name).join(', ') || '(none)'}`);
  }
} catch (error) {
  console.error('Database check failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

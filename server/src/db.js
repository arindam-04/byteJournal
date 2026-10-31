import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../../.env') });

const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to the project root and configure PostgreSQL.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});
pool.on('error', (err) => console.error('Unexpected PostgreSQL pool error:', err.message));

const MIGRATIONS = [
  '001_article_metadata_and_indexes.sql',
  '002_multi_author_cms.sql',
  '003_cms_integrity_and_indexes.sql',
  '004_complete_cms_models.sql',
  '005_admin_profile_and_session_security.sql',
  '006_newsletter_consent.sql',
  '007_saved_articles.sql',
  '008_article_popularity.sql',
  '009_taxonomy_backfill.sql',
  '010_website_edit_permission.sql'
];
const MIGRATION_LOCK_ID = 731942018;

async function applyMigrations() {
  const client = await pool.connect();
  let lockTaken = false;
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    lockTaken = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(200) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    for (const migrationName of MIGRATIONS) {
      const migrationPath = path.resolve(currentDir, `../sql/migrations/${migrationName}`);
      const sql = await fs.readFile(migrationPath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM schema_migrations WHERE migration_name=$1',
        [migrationName]
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum.trim() !== checksum) {
          throw new Error(`Applied migration ${migrationName} has changed. Create a new migration instead of editing an applied migration.`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations(migration_name,checksum) VALUES($1,$2)',
          [migrationName, checksum]
        );
        await client.query('COMMIT');
        console.log(`Applied database migration: ${migrationName}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (lockTaken) {
      try { await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]); }
      catch (error) { console.error('Could not release migration advisory lock:', error.message); }
    }
    client.release();
  }
}

export async function initializeDatabase() {
  const baseSchema = await fs.readFile(path.resolve(currentDir, '../sql/000_legacy_base.sql'), 'utf8');
  await pool.query(baseSchema);

  // Bootstrap only a first legacy admin; never overwrite an existing password.
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !zEmail(email)) throw new Error('Set a valid ADMIN_EMAIL in the project-root .env file.');
  if (password.length < 12 || password.startsWith('REPLACE_')) {
    throw new Error('ADMIN_PASSWORD must be a real password of at least 12 characters. Set it in the project-root .env file.');
  }
  const existing = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);
  if (!existing.rowCount) {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO admins (name, email, password_hash) VALUES ($1, $2, $3)',
      [process.env.ADMIN_NAME || 'Site Admin', email, hash]
    );
    console.log(`Created initial admin account for ${email}`);
  }

  // Migration 002 copies the bootstrap admin to users as the first Super Admin.
  await applyMigrations();
  console.log('PostgreSQL schema and tracked migrations are ready.');
}

function zEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

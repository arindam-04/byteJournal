import { initializeDatabase, pool } from '../src/db.js';

try {
  await initializeDatabase();
  console.log('Database migration command completed.');
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

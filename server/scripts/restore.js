import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(projectRoot, '.env') });
const databaseUrl = process.env.DATABASE_URL;
const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!databaseUrl) {
  console.error('DATABASE_URL is missing. Configure it in the project-root .env file.');
  process.exit(1);
}
if (!backupPath || !fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
  console.error('Usage: npm run db:restore -- path/to/bytejournal.dump');
  process.exit(2);
}

console.warn('WARNING: restore uses --clean --if-exists and replaces matching objects in the configured database.');
console.warn('Stop application writes and take a separate backup before continuing.');
const prompt = createInterface({ input: stdin, output: stdout });
const answer = await prompt.question('Type RESTORE to continue: ');
prompt.close();
if (answer !== 'RESTORE') {
  console.log('Restore cancelled.');
  process.exit(1);
}

const child = spawn('pg_restore', [
  '--clean', '--if-exists', '--no-owner', '--exit-on-error',
  `--dbname=${databaseUrl}`, backupPath
], { stdio: 'inherit', windowsHide: true });
child.on('error', (error) => {
  console.error(`Could not start pg_restore. Install PostgreSQL command-line tools and add them to PATH. ${error.message}`);
  process.exitCode = 1;
});
child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Database restore failed with exit code ${code}.`);
    process.exitCode = code || 1;
    return;
  }
  console.log(`Database restore completed from: ${backupPath}`);
  console.log('Restore server/uploads from its separate backup if you need uploaded images.');
});

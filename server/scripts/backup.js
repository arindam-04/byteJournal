import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is missing. Configure it in the project-root .env file.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(process.argv[2] || path.join(root, 'backups', `bytejournal-${stamp}.dump`));
fs.mkdirSync(path.dirname(output), { recursive: true });
const file = fs.createWriteStream(output, { flags: 'wx' });
const child = spawn('pg_dump', ['--format=custom', '--no-owner', `--dbname=${databaseUrl}`], {
  stdio: ['ignore', 'pipe', 'inherit'],
  windowsHide: true
});
child.stdout.pipe(file);

let failed = false;
file.on('error', (error) => {
  failed = true;
  console.error(`Could not write backup: ${error.message}`);
  child.kill();
});
child.on('error', (error) => {
  failed = true;
  console.error(`Could not start pg_dump. Install PostgreSQL command-line tools and add them to PATH. ${error.message}`);
});
child.on('close', (code) => {
  file.end(() => {
    if (code !== 0 || failed) {
      fs.rmSync(output, { force: true });
      process.exitCode = 1;
      return;
    }
    console.log(`Database backup written to: ${output}`);
    console.log('Back up server/uploads separately; database dumps do not contain uploaded files.');
    console.log('Keep this backup private; it may contain personal and unpublished content.');
  });
});

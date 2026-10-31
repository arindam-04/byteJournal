import { randomBytes } from 'node:crypto';

console.log('JWT_SECRET=' + randomBytes(48).toString('hex'));
console.log('DATABASE_USER_PASSWORD=' + randomBytes(32).toString('hex'));
console.log('ADMIN_PASSWORD=' + randomBytes(24).toString('base64url'));
console.log('\nUse DATABASE_USER_PASSWORD for the PostgreSQL application user. Copy JWT_SECRET and ADMIN_PASSWORD into the private project-root .env file. Never commit or share .env.');

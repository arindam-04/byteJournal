import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { pool, initializeDatabase } from './db.js';
import { createAllowedOrigins, isTrustedRequestOrigin, isCorsOriginAllowed, getOriginDiagnostics } from './origin-policy.js';

const app = express();
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend server is running",
  });
});
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const uploadDir = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowedMime = new Set(['image/jpeg','image/png','image/webp','image/gif']);
const extensionForMime = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extensionForMime[file.mimetype] || '.img'}`)
});
const upload = multer({
  storage, limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, allowedMime.has(file.mimetype))
});
async function verifyImageSignature(filePath, mime) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const head = Buffer.alloc(12);
    const { bytesRead } = await handle.read(head, 0, 12, 0);
    const b = head.subarray(0, bytesRead);
    if (mime === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (mime === 'image/png') return b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    if (mime === 'image/gif') return b.subarray(0,6).toString('ascii').match(/^GIF8[79]a$/) !== null;
    if (mime === 'image/webp') return b.length >= 12 && b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP';
    return false;
  } finally { await handle.close(); }
}
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const COOKIE_NAME = 'bytejournal_admin';
const JWT_SECRET = process.env.JWT_SECRET || '';
if (JWT_SECRET.length < 32 || JWT_SECRET.startsWith('REPLACE_')) throw new Error('JWT_SECRET must be a unique random value of at least 32 characters. Configure it in the project-root .env file.');

app.disable('x-powered-by');
app.use(helmet());
const configuredOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.PUBLIC_SITE_URL,
  process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : ''
].filter(Boolean).join(',');
const allowedOrigins = createAllowedOrigins(configuredOrigins);

// Same-origin deployments are validated against the request host/protocol.
// When running behind a trusted reverse proxy, configure it to overwrite
// X-Forwarded-Host and X-Forwarded-Proto. Split-origin frontends must be listed
// explicitly in CLIENT_ORIGIN; PUBLIC_SITE_URL is also trusted for the site.
// Keep the API bound to localhost/private networking behind the proxy.
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  if (!isTrustedRequestOrigin(req, origin, allowedOrigins)) {
    return res.status(403).json({
      error: 'Request origin is not allowed. Check CLIENT_ORIGIN and reverse-proxy host/protocol settings.',
      code: 'ORIGIN_NOT_ALLOWED',
      diagnostics: getOriginDiagnostics(req, origin, allowedOrigins)
    });
  }
  next();
});
app.use('/api', cors({
  // CORS headers are emitted only for explicitly configured cross-origin
  // frontends. Same-origin requests pass the origin guard above and need no
  // Access-Control-Allow-Origin header.
  origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin, allowedOrigins)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadDir, { maxAge: '7d', immutable: true }));

const articleSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must contain lowercase letters, numbers and hyphens only'),
  excerpt: z.string().trim().min(10).max(320),
  category: z.string().trim().min(2).max(80),
  author: z.string().trim().min(1).max(80),
  content: z.string().trim().min(20).max(100000),
  read_minutes: z.coerce.number().int().min(1).max(1000).optional(),
  status: z.enum(['draft','published']),
  featured: z.boolean().default(false),
  cover_color: z.enum(['blue','orange','purple','green','pink','teal']).default('blue'),
  cover_image: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  seo_title: z.string().trim().max(180).optional().nullable(),
  meta_description: z.string().trim().max(320).optional().nullable(),
  canonical_url: z.string().trim().url().max(1000).refine(value => /^https?:\/\//i.test(value), 'Canonical URL must use HTTP or HTTPS').or(z.literal('')).optional().nullable()
});

function publicArticle(row) {
  return {
    id: row.id, title: row.title, slug: row.slug, excerpt: row.excerpt,
    category: row.category, author: row.author, author_id: row.author_id ?? null, content: row.content,
    read_minutes: row.read_minutes, status: row.status, publication_status: row.publication_status || row.status,
    cover_color: row.cover_color, cover_image: row.cover_image, tags: row.tags || [], seo_title: row.seo_title,
    featured: Boolean(row.featured),
    meta_description: row.meta_description, canonical_url: row.canonical_url,
    created_at: row.created_at, updated_at: row.updated_at,
    view_count: Number(row.view_count || 0),
    submitted_at: row.submitted_at ?? null, published_at: row.published_at
  };
}
function signToken(admin) {
  return jwt.sign({ sub: String(admin.id), email: admin.email, name: admin.name, role: admin.role || 'super_admin', ver: Number(admin.token_version ?? 0) }, JWT_SECRET, { expiresIn: '8h' });
}
const roles = ['super_admin','admin','editor','author'];
function allowRoles(...allowed) {
  return (req,res,next) => allowed.includes(req.admin?.role) ? next() : res.status(403).json({ error: 'You do not have permission to perform this action.' });
}
function allowWebsiteEditing(req,res,next) {
  return req.admin?.role === 'super_admin' || req.admin?.role === 'admin' || req.admin?.can_edit_website
    ? next()
    : res.status(403).json({ error: 'You do not have permission to edit the main website.' });
}
async function audit(userId, action, entityType, entityId, details = {}) {
  await pool.query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)', [userId,action,entityType,entityId == null ? null : String(entityId),JSON.stringify(details)]);
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
  });
}
async function requireAdmin(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const current = await pool.query(
      'SELECT id,name,email,role,active,can_edit_website,bio,expertise,avatar_url,created_at,last_login_at,token_version FROM users WHERE id=$1', [payload.sub]
    );
    const user = current.rows[0];
    if (!user || !user.active || !roles.includes(user.role) || Number(payload.ver ?? 0) !== Number(user.token_version ?? 0)) {
      res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/' });
      return res.status(401).json({ error: 'Your account or session is no longer valid. Please sign in again.' });
    }
    req.admin = { ...payload, sub: String(user.id), name: user.name, email: user.email, role: user.role, can_edit_website: Boolean(user.can_edit_website), bio: user.bio || '', expertise: user.expertise || '', avatar_url: user.avatar_url || null, created_at: user.created_at, last_login_at: user.last_login_at };
    next();
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'NotBeforeError') {
      res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/' });
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    next(error);
  }
}
function validateArticle(req, res, next) {
  const parsed = articleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  req.articleData = parsed.data;
  if (req.admin?.role === 'author') { req.articleData.status = 'draft'; req.articleData.author = req.admin.name; }
  if (['author','editor'].includes(req.admin?.role)) req.articleData.featured = false;
  if (!req.articleData.read_minutes) {
    req.articleData.read_minutes = Math.max(1, Math.ceil(req.articleData.content.split(/\s+/).length / 200));
  }
  next();
}
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }
function slugifyTaxonomy(value, fallback) {
  const slug = String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  return slug || `${fallback}-${randomUUID()}`;
}
async function ensureTaxonomyRecord(client, table, name) {
  const existing=await client.query(`SELECT id FROM ${table} WHERE lower(name)=lower($1) LIMIT 1`,[name]);
  if(existing.rowCount) return existing.rows[0].id;
  const maxLength=table==='categories'?120:100;
  let slug=slugifyTaxonomy(name,table.slice(0,-1)).slice(0,maxLength);
  let inserted=await client.query(`INSERT INTO ${table}(name,slug) VALUES($1,$2) ON CONFLICT(slug) DO NOTHING RETURNING id`,[name,slug]);
  if(inserted.rowCount) return inserted.rows[0].id;
  const duplicate=await client.query(`SELECT id FROM ${table} WHERE lower(name)=lower($1) LIMIT 1`,[name]);
  if(duplicate.rowCount) return duplicate.rows[0].id;
  slug=`${slug.slice(0,maxLength-10)}-${randomUUID().slice(0,8)}`;
  inserted=await client.query(`INSERT INTO ${table}(name,slug) VALUES($1,$2) RETURNING id`,[name,slug]);
  return inserted.rows[0].id;
}
async function syncArticleTaxonomy(client, articleId, article) {
  const categoryId=await ensureTaxonomyRecord(client,'categories',article.category.trim());
  await client.query('DELETE FROM article_categories WHERE article_id=$1',[articleId]);
  await client.query('INSERT INTO article_categories(article_id,category_id,is_primary) VALUES($1,$2,true)',[articleId,categoryId]);
  await client.query('DELETE FROM article_tags WHERE article_id=$1',[articleId]);
  const uniqueTags=[...new Map(article.tags.map(tag=>[tag.toLowerCase(),tag.trim()])).values()];
  for(const tag of uniqueTags){const tagId=await ensureTaxonomyRecord(client,'tags',tag);await client.query('INSERT INTO article_tags(article_id,tag_id) VALUES($1,$2) ON CONFLICT(article_id,tag_id) DO NOTHING',[articleId,tagId]);}
}

const publicFormAttempts = new Map();
function createPublicFormLimiter({ limit, windowMs, message }) {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = publicFormAttempts.get(`${req.path}:${key}`) || { count: 0, start: now };
    if (now - entry.start >= windowMs) { entry.count = 0; entry.start = now; }
    if (entry.count >= limit) {
      res.set('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
      return res.status(429).json({ error: message });
    }
    entry.count += 1;
    publicFormAttempts.set(`${req.path}:${key}`, entry);
    if (publicFormAttempts.size > 10000) {
      for (const [storedKey, storedValue] of publicFormAttempts) {
        if (now - storedValue.start >= windowMs) publicFormAttempts.delete(storedKey);
      }
    }
    next();
  };
}
const limitNewsletterSubscribe = createPublicFormLimiter({
  limit: 6, windowMs: 60 * 60 * 1000, message: 'Too many subscription attempts. Please try again later.'
});
const limitContactMessage = createPublicFormLimiter({
  limit: 5, windowMs: 60 * 60 * 1000, message: 'Too many messages from this connection. Please try again later.'
});
const loginAttempts = new Map();
function loginRateLimit(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = loginAttempts.get(key);
  if (entry && entry.blockedUntil > Date.now()) {
    res.set('Retry-After', String(Math.ceil((entry.blockedUntil - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Too many login attempts. Please wait before trying again.' });
  }
  req.loginRateKey = key;
  next();
}
function recordLoginFailure(key) {
  const current = loginAttempts.get(key) || { count: 0, windowStart: Date.now(), blockedUntil: 0 };
  if (Date.now() - current.windowStart > 15 * 60 * 1000) { current.count = 0; current.windowStart = Date.now(); }
  current.count += 1;
  if (current.count >= 8) current.blockedUntil = Date.now() + 15 * 60 * 1000;
  loginAttempts.set(key, current);
  if (loginAttempts.size > 10000) {
    const now = Date.now();
    for (const [ip, attempt] of loginAttempts) {
      if (now - attempt.windowStart > 30 * 60 * 1000 && attempt.blockedUntil < now) loginAttempts.delete(ip);
    }
  }
}
function clearLoginFailures(key) { loginAttempts.delete(key); }


app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

app.post('/api/newsletter/subscribe', limitNewsletterSubscribe, asyncRoute(async (req, res) => {
  const parsed = z.object({
    email: z.string().trim().email().max(254),
    consent: z.literal(true),
    source: z.string().trim().max(40).optional(),
    website: z.string().max(200).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address and agree to receive newsletter updates.' });
  // Honeypot submissions receive a neutral success response but are not stored.
  if (parsed.data.website?.trim()) return res.status(202).json({ message: 'Thanks for your interest. Please check your inbox for future ByteJournal updates.' });
  const email = parsed.data.email.toLowerCase();
  await pool.query(`INSERT INTO newsletter_subscribers(email,status,consented_at,source,updated_at)
      VALUES($1,'subscribed',NOW(),'footer',NOW())
      ON CONFLICT(email) DO UPDATE SET status='subscribed',consented_at=NOW(),unsubscribed_at=NULL,
        source='footer',updated_at=NOW()`, [email]);
  res.status(201).json({ message: 'Thanks — your email has been added to the ByteJournal subscriber list.' });
}));

app.post('/api/contact', limitContactMessage, asyncRoute(async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    subject: z.string().trim().max(180).optional().default(''),
    message: z.string().trim().min(10).max(5000),
    website: z.string().max(200).optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your name, a valid email address, and a message of at least 10 characters.' });
  // Ignore automated honeypot submissions without exposing the spam check.
  if (parsed.data.website?.trim()) return res.status(202).json({ message: 'Thanks for contacting ByteJournal. Your message has been received.' });
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ipHash = createHash('sha256').update(`${JWT_SECRET}:${ip}`).digest('hex');
  await pool.query(`INSERT INTO contact_messages(name,email,subject,message,ip_hash)
    VALUES($1,$2,$3,$4,$5)`, [parsed.data.name, parsed.data.email.toLowerCase(), parsed.data.subject || null, parsed.data.message, ipHash]);
  res.status(201).json({ message: 'Thanks for reaching out. Your message has been received and stored for the ByteJournal team.' });
}));

app.post('/api/auth/login', loginRateLimit, asyncRoute(async (req, res) => {
  const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const email = parsed.data.email.toLowerCase();
  const result = await pool.query('SELECT id, name, email, password_hash, role, can_edit_website, token_version FROM users WHERE email = $1 AND active=true', [email]);
  const admin = result.rows[0];
  if (!admin || !(await bcrypt.compare(parsed.data.password, admin.password_hash))) {
    recordLoginFailure(req.loginRateKey);
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  clearLoginFailures(req.loginRateKey);
  await pool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [admin.id]);
  setAuthCookie(res, signToken(admin));
  res.json({ user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, can_edit_website: Boolean(admin.can_edit_website) } });
}));


// Password recovery is restricted to active administrator/editor accounts.
// Tokens are random, single-use, stored only as SHA-256 hashes, and expire in 30 minutes.
const resetRequestAttempts = new Map();
function limitPasswordReset(req, res, next) {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = resetRequestAttempts.get(key) || { count: 0, start: Date.now() };
  if (Date.now() - entry.start > 60 * 60 * 1000) { entry.count = 0; entry.start = Date.now(); }
  if (entry.count >= 5) return res.status(429).json({ error: 'Too many reset requests. Please try again later.' });
  entry.count += 1; resetRequestAttempts.set(key, entry); next();
}
function mailTransport() {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const present = required.filter(key => Boolean(process.env[key]?.trim()));
  if (present.length === 0) return null;
  if (present.length !== required.length) throw new Error('Configure SMTP_HOST, SMTP_USER, and SMTP_PASS together.');
  const host = process.env.SMTP_HOST.trim();
  const username = process.env.SMTP_USER.trim();
  const sender = process.env.SMTP_FROM?.trim();
  if (/example\.com|your-smtp|replace_with/i.test(`${host} ${username} ${sender || ''}`) || process.env.SMTP_PASS === 'your-smtp-password') {
    throw new Error('Replace the sample SMTP values with credentials from your email provider.');
  }
  const port=Number(process.env.SMTP_PORT || 587);
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('SMTP_PORT must be a valid port number.');
  const secureSetting = process.env.SMTP_SECURE?.trim().toLowerCase() || undefined;
  if (secureSetting && !['true','false'].includes(secureSetting)) throw new Error('SMTP_SECURE must be true or false.');
  return nodemailer.createTransport({
    host,
    port,
    secure: secureSetting === undefined ? port===465 : secureSetting==='true',
    auth: { user: username, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });
}
async function sendTransactionalEmail({to,subject,text,html}) {
  let transport;
  try { transport=mailTransport(); }
  catch(error) {
    console.error('[MAIL] SMTP configuration error:',error.message);
    return {ok:false,reason:'configuration',message:error.message};
  }
  if(!transport) return {ok:false,reason:'not_configured'};
  try {
    await transport.sendMail({from:process.env.SMTP_FROM?.trim()||process.env.SMTP_USER?.trim(),to,subject,text,html});
    return {ok:true};
  } catch(error) {
    console.error('[MAIL] SMTP delivery failed:',{code:error.code||'UNKNOWN',responseCode:error.responseCode||null,command:error.command||null});
    return {ok:false,reason:'delivery',code:error.code||'UNKNOWN'};
  } finally { transport.close(); }
}
function publicSiteBaseUrl() {
  return (process.env.PUBLIC_SITE_URL||process.env.CLIENT_ORIGIN||'http://localhost:5173').split(',')[0].trim().replace(/\/$/,'');
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
app.post('/api/auth/forgot-password', limitPasswordReset, asyncRoute(async (req, res) => {
  const parsed = z.object({ email: z.string().email().max(254) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  const email = parsed.data.email.toLowerCase();
  const found = await pool.query(`SELECT id,email,name FROM users WHERE email=$1 AND active=true AND role IN ('super_admin','admin')`, [email]);
  // Always return the same response to avoid revealing whether an admin account exists.
  if (found.rowCount) {
    const user = found.rows[0];
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await pool.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [user.id]);
    await pool.query(`INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 minutes')`, [user.id, tokenHash]);
    const resetUrl=`${publicSiteBaseUrl()}/cms/reset-password?token=${rawToken}`;
    const delivery=await sendTransactionalEmail({
      to:user.email,
      subject:'Reset your ByteJournal admin password',
      text:`Hello ${user.name},\n\nUse this one-time link to reset your ByteJournal admin password. It expires in 30 minutes.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html:`<p>Hello ${escapeHtml(user.name)},</p><p>Use the one-time link below to reset your ByteJournal admin password. It expires in 30 minutes.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
    });
    if(!delivery.ok&&delivery.reason==='not_configured') {
      console.error('Password reset requested but SMTP is not configured; configure SMTP_HOST/SMTP_USER/SMTP_PASS to deliver reset emails.');
    }
  }
  res.json({ message: 'If an eligible administrator account exists for that email, a password reset link will be sent.' });
}));
app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
  const parsed = z.object({ token: z.string().length(64), password: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Use a valid reset link and a password with at least 12 characters.' });
  const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`SELECT t.id,t.user_id,u.email FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>NOW() AND u.active=true AND u.role IN ('super_admin','admin') FOR UPDATE`, [tokenHash]);
    if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' }); }
    const record = result.rows[0];
    const hash = await bcrypt.hash(parsed.data.password, 12);
    await client.query('UPDATE users SET password_hash=$1,token_version=token_version+1,updated_at=NOW() WHERE id=$2', [hash, record.user_id]);
    await client.query('UPDATE admins SET password_hash=$1 WHERE email=$2', [hash, record.email]);
    await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [record.user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Password updated. You can now sign in with your new password.' });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}));

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAdmin, (req, res) => {
  res.json({ user: { id: req.admin.sub, name: req.admin.name, email: req.admin.email, role: req.admin.role, can_edit_website: req.admin.can_edit_website, bio: req.admin.bio, expertise: req.admin.expertise, avatar_url: req.admin.avatar_url, created_at: req.admin.created_at, last_login_at: req.admin.last_login_at } });
});

// Signed-in contributors can save published articles to their personal dashboard.
app.get('/api/account/saved-articles', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT a.id,a.title,a.slug,a.excerpt,a.category,a.author,a.author_id,a.content,a.read_minutes,a.status,a.publication_status,a.cover_color,a.cover_image,a.tags,a.seo_title,a.meta_description,a.canonical_url,a.created_at,a.updated_at,a.published_at,s.created_at AS saved_at
    FROM saved_articles s JOIN articles a ON a.id=s.article_id
    WHERE s.user_id=$1 AND a.status='published' ORDER BY s.created_at DESC LIMIT 100`, [req.admin.sub]);
  res.json({ articles: result.rows.map(publicArticle) });
}));

app.post('/api/account/saved-articles/:articleId', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async (req, res) => {
  if (!/^\d+$/.test(req.params.articleId)) return res.status(400).json({ error: 'Invalid article ID.' });
  const article = await pool.query("SELECT id FROM articles WHERE id=$1 AND status='published'", [req.params.articleId]);
  if (!article.rowCount) return res.status(404).json({ error: 'Published article not found.' });
  await pool.query('INSERT INTO saved_articles(user_id,article_id) VALUES($1,$2) ON CONFLICT(user_id,article_id) DO NOTHING', [req.admin.sub, req.params.articleId]);
  res.status(201).json({ saved: true });
}));

app.delete('/api/account/saved-articles/:articleId', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async (req, res) => {
  if (!/^\d+$/.test(req.params.articleId)) return res.status(400).json({ error: 'Invalid article ID.' });
  await pool.query('DELETE FROM saved_articles WHERE user_id=$1 AND article_id=$2', [req.admin.sub, req.params.articleId]);
  res.json({ saved: false });
}));

// Signed-in user's own profile. This does not grant access to another user's account.
app.get('/api/auth/profile', requireAdmin, asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT id,name,email,role,COALESCE(bio,'') AS bio,COALESCE(expertise,'') AS expertise,
    avatar_url,created_at,last_login_at,updated_at FROM users WHERE id=$1 AND active=true`, [req.admin.sub]);
  if (!result.rowCount) return res.status(404).json({ error: 'Profile not found.' });
  res.json({ profile: result.rows[0] });
}));

app.put('/api/auth/profile', requireAdmin, asyncRoute(async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254),
    bio: z.string().trim().max(1000).optional().default(''),
    expertise: z.string().trim().max(180).optional().default(''),
    avatar_url: z.string().max(500).nullable().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') });
  const data = parsed.data;
  const avatarUrl = data.avatar_url || null;
  if (avatarUrl && !avatarUrl.startsWith('/uploads/') && !/^https:\/\//i.test(avatarUrl)) {
    return res.status(400).json({ error: 'Profile image must be an uploaded image or a secure HTTPS URL.' });
  }
  const client = await pool.connect();
  let profile;
  try {
    await client.query('BEGIN');
    const updated = await client.query(`UPDATE users SET name=$1,email=$2,bio=$3,expertise=$4,avatar_url=$5,
      email_verified_at=CASE WHEN lower(email)<>lower($2) THEN NULL ELSE email_verified_at END,updated_at=NOW()
      WHERE id=$6 AND active=true
      RETURNING id,name,email,role,COALESCE(bio,'') AS bio,COALESCE(expertise,'') AS expertise,avatar_url,created_at,last_login_at,updated_at,token_version`,
    [data.name,data.email.toLowerCase(),data.bio,data.expertise,avatarUrl,req.admin.sub]);
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Profile not found.' });
    }
    profile = updated.rows[0];
    await client.query('UPDATE admins SET name=LEFT($1,100),email=$2 WHERE lower(email)=lower($3)', [profile.name,profile.email,req.admin.email]);
    await client.query('UPDATE articles SET author=LEFT($1,80) WHERE author_id=$2', [profile.name,req.admin.sub]);
    await client.query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',
      [req.admin.sub,'profile.updated','user',String(req.admin.sub),JSON.stringify({ fields: ['name','email','bio','expertise','avatar_url'] })]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'That email address is already used by another account.' });
    throw error;
  } finally { client.release(); }
  setAuthCookie(res, signToken(profile));
  delete profile.token_version;
  res.json({ profile, user: { id: profile.id, name: profile.name, email: profile.email, role: profile.role, bio: profile.bio, expertise: profile.expertise, avatar_url: profile.avatar_url, created_at: profile.created_at, last_login_at: profile.last_login_at } });
}));

app.post('/api/auth/change-password', requireAdmin, asyncRoute(async (req, res) => {
  const parsed = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your current password and a new password with at least 12 characters.' });
  const client = await pool.connect();
  let updatedUser;
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT id,email,password_hash FROM users WHERE id=$1 AND active=true FOR UPDATE', [req.admin.sub]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Account not found.' }); }
    const account = found.rows[0];
    if (!(await bcrypt.compare(parsed.data.currentPassword, account.password_hash))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Your current password is incorrect.' });
    }
    if (await bcrypt.compare(parsed.data.newPassword, account.password_hash)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Choose a new password that is different from your current password.' });
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    const result = await client.query(`UPDATE users SET password_hash=$1,token_version=token_version+1,updated_at=NOW()
      WHERE id=$2 RETURNING id,name,email,role,token_version`, [passwordHash, account.id]);
    updatedUser = result.rows[0];
    await client.query('UPDATE admins SET password_hash=$1 WHERE lower(email)=lower($2)', [passwordHash, account.email]);
    await client.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [account.id]);
    await client.query('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5)',
      [account.id,'profile.password_changed','user',String(account.id),JSON.stringify({ changed: true })]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  // Rotate the current browser's cookie and invalidate all older sessions via token_version.
  setAuthCookie(res, signToken(updatedUser));
  res.json({ message: 'Password changed successfully. Other signed-in sessions have been invalidated.' });
}));

app.get('/api/articles', asyncRoute(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const offset = (page - 1) * limit;
  const clauses = ["status = 'published'"];
  const params = [];
  if (req.query.category) {
    params.push(String(req.query.category).slice(0, 80));
    clauses.push(`category = $${params.length}`);
  }
  if (req.query.tag) {
    params.push(String(req.query.tag).slice(0, 40));
    clauses.push(`$${params.length} = ANY(tags)`);
  }
  if (req.query.q) {
    const term = String(req.query.q).trim().slice(0, 100);
    params.push(`%${term}%`);
    const n = params.length;
    clauses.push(`(title ILIKE $${n} OR excerpt ILIKE $${n} OR content ILIKE $${n} OR array_to_string(tags, ' ') ILIKE $${n} OR category ILIKE $${n})`);
  }
  const where = clauses.join(' AND ');
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM articles WHERE ${where}`, params);
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,view_count,featured
     FROM articles WHERE ${where} ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`, params
  );
  const total = count.rows[0].total;
  res.json({ articles: result.rows.map(publicArticle), pagination: { page, limit, total, pages: Math.ceil(total / limit), hasMore: offset + result.rowCount < total } });
}));

app.get('/api/articles/popular', asyncRoute(async (req, res) => {
  const limit = Math.min(12, Math.max(1, Number.parseInt(req.query.limit, 10) || 4));
  const result = await pool.query(
    `SELECT id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,view_count
     FROM articles WHERE status='published'
     ORDER BY view_count DESC, published_at DESC NULLS LAST, created_at DESC LIMIT $1`, [limit]
  );
  res.json({ articles: result.rows.map(publicArticle) });
}));

app.get('/api/articles/featured', asyncRoute(async (req, res) => {
  const limit = Math.min(8, Math.max(1, Number.parseInt(req.query.limit, 10) || 1));
  const result = await pool.query(
    `SELECT id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,view_count,featured
     FROM articles WHERE status='published' AND featured=true ORDER BY published_at DESC NULLS LAST,created_at DESC LIMIT $1`, [limit]
  );
  res.json({articles:result.rows.map(publicArticle)});
}));

app.get('/api/categories', asyncRoute(async (_req, res) => {
  const result = await pool.query(`WITH names AS (
      SELECT category FROM articles WHERE status='published'
      UNION SELECT name AS category FROM categories WHERE is_active=true
    ) SELECT n.category,COUNT(a.id)::int AS count FROM names n
      LEFT JOIN articles a ON a.status='published' AND lower(a.category)=lower(n.category)
      GROUP BY n.category ORDER BY n.category`);
  res.json({ categories: result.rows });
}));
app.get('/api/tags', asyncRoute(async (_req, res) => {
  const result = await pool.query(`SELECT DISTINCT tag FROM (
      SELECT unnest(tags) AS tag FROM articles WHERE status='published'
      UNION SELECT name AS tag FROM tags
    ) all_tags ORDER BY tag`);
  res.json({ tags: result.rows.map(r => r.tag) });
}));

app.get('/api/articles/:slug', asyncRoute(async (req, res) => {
  const result = await pool.query(
    `UPDATE articles SET view_count=view_count+1
     WHERE slug = $1 AND status = 'published'
     RETURNING id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,view_count,featured`,
    [req.params.slug]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Article not found.' });
  res.json({ article: publicArticle(result.rows[0]) });
}));

app.post('/api/admin/upload', requireAdmin, (req, res) => {
  upload.single('image')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller.' : 'Upload a JPG, PNG, WEBP or GIF image.' });
    if (!req.file) return res.status(400).json({ error: 'Choose a valid image file.' });
    try {
      if (!(await verifyImageSignature(req.file.path, req.file.mimetype))) {
        await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'The uploaded file does not contain a valid supported image.' });
      }
      const url = `/uploads/${req.file.filename}`;
      const media = await pool.query(`INSERT INTO media_assets(user_id,url,mime_type,size_bytes) VALUES($1,$2,$3,$4) RETURNING id`,[req.admin.sub,url,req.file.mimetype,req.file.size]);
      res.status(201).json({ url, filename: req.file.filename, mediaId: media.rows[0].id });
    } catch (error) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      console.error('Image upload verification failed:', error.message);
      return res.status(500).json({ error: 'The image could not be processed.' });
    }
  });
});


app.get('/api/admin/media', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT m.id,m.url,m.mime_type,m.size_bytes,m.created_at,u.name AS uploaded_by,
    ((SELECT COUNT(*) FROM articles a WHERE a.cover_image=m.url)+
     (SELECT COUNT(*) FROM articles a WHERE position(m.url in a.content)>0)+
     (SELECT COUNT(*) FROM users account WHERE account.avatar_url=m.url)+
     (SELECT COUNT(*) FROM site_settings setting WHERE position(m.url in setting.setting_value::text)>0))::int AS reference_count
    FROM media_assets m LEFT JOIN users u ON u.id=m.user_id
    WHERE ($1::text<>'author' OR m.user_id=$2) ORDER BY m.created_at DESC LIMIT 250`,[req.admin.role,req.admin.sub]);
  res.json({assets:r.rows});
}));
app.delete('/api/admin/media/:id', requireAdmin, allowRoles('super_admin','admin','editor'), asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid media asset ID.'});
  const found=await pool.query('SELECT id,url FROM media_assets WHERE id=$1',[req.params.id]);
  if(!found.rowCount) return res.status(404).json({error:'Media asset not found.'});
  const url=found.rows[0].url;
  const used=await pool.query(`SELECT EXISTS(SELECT 1 FROM articles a WHERE a.cover_image=$1 OR position($1 in a.content)>0)
    OR EXISTS(SELECT 1 FROM users account WHERE account.avatar_url=$1)
    OR EXISTS(SELECT 1 FROM site_settings setting WHERE position($1 in setting.setting_value::text)>0) AS used`,[url]);
  if(used.rows[0].used) return res.status(409).json({error:'This asset is in use. Remove it from its article, profile or appearance setting before deleting it.'});
  const filename=path.basename(url);
  const expectedUrl=`/uploads/${filename}`;
  if(url!==expectedUrl || !/^[a-f0-9-]+\.(?:jpg|png|webp|gif)$/i.test(filename)) return res.status(409).json({error:'This asset does not use a managed upload path.'});
  await pool.query('DELETE FROM media_assets WHERE id=$1',[req.params.id]);
  await fs.promises.unlink(path.join(uploadDir,filename)).catch(error=>{if(error.code!=='ENOENT')throw error;});
  await audit(req.admin.sub,'media.deleted','media_asset',req.params.id);
  res.json({ok:true});
}));

const taxonomyName = z.string().trim().min(2).max(100);
const taxonomySlug = z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional();
const tagTaxonomySlug = z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional();
app.get('/api/admin/categories', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(_req,res)=>{
  const r=await pool.query(`SELECT c.id,c.name,c.slug,c.description,c.sort_order,c.is_active,c.created_at,c.updated_at,
    COUNT(a.id) FILTER (WHERE a.status='published')::int AS article_count
    FROM categories c LEFT JOIN articles a ON lower(a.category)=lower(c.name)
    GROUP BY c.id ORDER BY c.sort_order,c.name`);
  res.json({categories:r.rows});
}));
app.post('/api/admin/categories', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const parsed=z.object({name:taxonomyName,slug:taxonomySlug,description:z.string().max(2000).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Provide a category name and a valid optional slug/description.'});
  try {
    const slug=parsed.data.slug || slugifyTaxonomy(parsed.data.name,'category');
    const r=await pool.query(`INSERT INTO categories(name,slug,description) VALUES($1,$2,$3) RETURNING *`,[parsed.data.name,slug,parsed.data.description||null]);
    await audit(req.admin.sub,'category.created','category',r.rows[0].id,{name:r.rows[0].name});
    res.status(201).json({category:r.rows[0]});
  } catch(error) { if(error.code==='23505') return res.status(409).json({error:'A category with this name or slug already exists.'}); throw error; }
}));
app.patch('/api/admin/categories/:id', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid category ID.'});
  const parsed=z.object({name:taxonomyName.optional(),slug:taxonomySlug,description:z.string().max(2000).nullable().optional(),sort_order:z.coerce.number().int().min(-10000).max(10000).optional(),is_active:z.boolean().optional()}).refine(v=>Object.keys(v).length>0).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Provide valid category fields.'});
  const current=await pool.query('SELECT name FROM categories WHERE id=$1',[req.params.id]);
  if(!current.rowCount) return res.status(404).json({error:'Category not found.'});
  try {
    const data=parsed.data; const name=data.name ?? current.rows[0].name;
    const r=await pool.query(`UPDATE categories SET name=$1,slug=COALESCE($2,slug),description=COALESCE($3,description),sort_order=COALESCE($4,sort_order),is_active=COALESCE($5,is_active),updated_at=NOW() WHERE id=$6 RETURNING *`,
      [name,data.slug ?? null,data.description ?? null,data.sort_order ?? null,data.is_active ?? null,req.params.id]);
    if(name!==current.rows[0].name) await pool.query('UPDATE articles SET category=$1,updated_at=NOW() WHERE lower(category)=lower($2)',[name,current.rows[0].name]);
    await audit(req.admin.sub,'category.updated','category',req.params.id,{name});
    res.json({category:r.rows[0]});
  } catch(error) { if(error.code==='23505') return res.status(409).json({error:'A category with this name or slug already exists.'}); throw error; }
}));
app.delete('/api/admin/categories/:id', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid category ID.'});
  const found=await pool.query('SELECT id,name FROM categories WHERE id=$1',[req.params.id]);
  if(!found.rowCount) return res.status(404).json({error:'Category not found.'});
  const used=await pool.query(`SELECT EXISTS(SELECT 1 FROM articles WHERE lower(category)=lower($1)) OR EXISTS(SELECT 1 FROM article_categories WHERE category_id=$2) AS used`,[found.rows[0].name,req.params.id]);
  if(used.rows[0].used) return res.status(409).json({error:'This category is used by articles. Deactivate it to preserve article history.'});
  await pool.query('DELETE FROM categories WHERE id=$1',[req.params.id]);
  await audit(req.admin.sub,'category.deleted','category',req.params.id,{name:found.rows[0].name});
  res.json({ok:true});
}));
app.get('/api/admin/tags', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(_req,res)=>{
  const r=await pool.query(`SELECT t.id,t.name,t.slug,t.description,t.created_at,
    COUNT(DISTINCT a.id) FILTER (WHERE a.status='published')::int AS article_count
    FROM tags t LEFT JOIN articles a ON EXISTS(SELECT 1 FROM unnest(a.tags) article_tag WHERE lower(article_tag)=lower(t.name))
    GROUP BY t.id ORDER BY t.name`);
  res.json({tags:r.rows});
}));
app.post('/api/admin/tags', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const parsed=z.object({name:z.string().trim().min(1).max(80),slug:tagTaxonomySlug,description:z.string().max(2000).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Provide a tag name and a valid optional slug/description.'});
  try {
    const slug=parsed.data.slug || slugifyTaxonomy(parsed.data.name,'tag');
    const r=await pool.query(`INSERT INTO tags(name,slug,description) VALUES($1,$2,$3) RETURNING *`,[parsed.data.name,slug,parsed.data.description||null]);
    await audit(req.admin.sub,'tag.created','tag',r.rows[0].id,{name:r.rows[0].name});
    res.status(201).json({tag:r.rows[0]});
  } catch(error) { if(error.code==='23505') return res.status(409).json({error:'A tag with this name or slug already exists.'}); throw error; }
}));
app.patch('/api/admin/tags/:id', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid tag ID.'});
  const parsed=z.object({name:z.string().trim().min(1).max(80).optional(),slug:tagTaxonomySlug,description:z.string().max(2000).nullable().optional()}).refine(v=>Object.keys(v).length>0).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Provide valid tag fields.'});
  const current=await pool.query('SELECT name FROM tags WHERE id=$1',[req.params.id]);
  if(!current.rowCount) return res.status(404).json({error:'Tag not found.'});
  try {
    const r=await pool.query(`UPDATE tags SET name=COALESCE($1,name),slug=COALESCE($2,slug),description=COALESCE($3,description) WHERE id=$4 RETURNING *`,[parsed.data.name??null,parsed.data.slug??null,parsed.data.description??null,req.params.id]);
    if(parsed.data.name && parsed.data.name!==current.rows[0].name) await pool.query(`UPDATE articles SET tags=ARRAY(SELECT CASE WHEN lower(item)=lower($1) THEN $2 ELSE item END FROM unnest(tags) item) WHERE EXISTS(SELECT 1 FROM unnest(tags) item WHERE lower(item)=lower($1))`,[current.rows[0].name,parsed.data.name]);
    await audit(req.admin.sub,'tag.updated','tag',req.params.id,{name:r.rows[0].name});
    res.json({tag:r.rows[0]});
  } catch(error) { if(error.code==='23505') return res.status(409).json({error:'A tag with this name or slug already exists.'}); throw error; }
}));
app.delete('/api/admin/tags/:id', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid tag ID.'});
  const found=await pool.query('SELECT id,name FROM tags WHERE id=$1',[req.params.id]);
  if(!found.rowCount) return res.status(404).json({error:'Tag not found.'});
  const used=await pool.query(`SELECT EXISTS(SELECT 1 FROM article_tags WHERE tag_id=$1) OR EXISTS(SELECT 1 FROM articles a WHERE EXISTS(SELECT 1 FROM unnest(a.tags) t WHERE lower(t)=lower($2))) AS used`,[req.params.id,found.rows[0].name]);
  if(used.rows[0].used) return res.status(409).json({error:'This tag is used by articles and cannot be deleted.'});
  await pool.query('DELETE FROM tags WHERE id=$1',[req.params.id]);
  await audit(req.admin.sub,'tag.deleted','tag',req.params.id,{name:found.rows[0].name});
  res.json({ok:true});
}));

app.get('/api/admin/stats', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status='published')::int AS published,
    COUNT(*) FILTER (WHERE status='draft')::int AS drafts,
    COUNT(*) FILTER (WHERE publication_status='submitted')::int AS pending_reviews
    FROM articles WHERE ($1::text <> 'author' OR author_id=$2)`, [req.admin.role, req.admin.sub]);
  res.json({ stats: result.rows[0] });
}));

app.get('/api/admin/articles', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,featured,view_count
     FROM articles WHERE ($1::text <> 'author' OR author_id=$2) ORDER BY updated_at DESC`, [req.admin.role,req.admin.sub]
  );
  res.json({ articles: result.rows.map(publicArticle) });
}));

app.post('/api/admin/articles', requireAdmin, allowRoles('super_admin','admin','editor','author'), validateArticle, asyncRoute(async (req, res) => {
  const a = req.articleData;
  const directPublish = ['super_admin','admin'].includes(req.admin.role) && a.status === 'published';
  const status = directPublish ? 'published' : 'draft';
  const workflow = directPublish ? 'published' : 'draft';
  const client=await pool.connect();let result;
  try {
    await client.query('BEGIN');
    result = await client.query(
      `INSERT INTO articles (title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,featured,published_at)
       VALUES ($1,$2,$3,$4,$5,$15,$6,$7,$8,$16,$9,$10,$11,$12,$13,$14,$17,CASE WHEN $18::boolean THEN NOW() ELSE NULL END)
       RETURNING id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,featured,view_count`,
      [a.title,a.slug,a.excerpt,a.category,a.author,a.content,a.read_minutes,status,a.cover_color,a.cover_image || null,a.tags,a.seo_title || null,a.meta_description || null,a.canonical_url || null,req.admin.sub,workflow,a.featured,status==='published']
    );
    await syncArticleTaxonomy(client,result.rows[0].id,a);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { client.release(); }
  await audit(req.admin.sub, 'article.created', 'article', result.rows[0].id, { status, publication_status: workflow });
  res.status(201).json({ article: publicArticle(result.rows[0]) });
}));

app.put('/api/admin/articles/:id', requireAdmin, allowRoles('super_admin','admin','editor','author'), validateArticle, asyncRoute(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid article ID.' });
  const a = req.articleData;
  const isAuthor = req.admin.role === 'author';
  const isEditor = req.admin.role === 'editor';
  const status = isAuthor || isEditor ? 'draft' : a.status;
  const client=await pool.connect();let result;
  try {
    await client.query('BEGIN');
    result = await client.query(
      `UPDATE articles SET title=$1,slug=$2,excerpt=$3,category=$4,author=$5,content=$6,read_minutes=$7,status=$8,cover_color=$9,cover_image=$10,tags=$11,seo_title=$12,meta_description=$13,canonical_url=$14,featured=CASE WHEN $17::text IN ('super_admin','admin') THEN $15 ELSE featured END,
        published_at=CASE WHEN $19::boolean THEN COALESCE(published_at,NOW()) ELSE published_at END,
        publication_status=CASE WHEN $17::text='author' AND publication_status IN ('draft','revision_requested','rejected') THEN 'draft'
                                WHEN $17::text='editor' THEN publication_status
                                ELSE CASE WHEN $19::boolean THEN 'published' ELSE 'draft' END END,
        updated_at=NOW()
       WHERE id=$16
         AND ($17::text <> 'author' OR (author_id=$18 AND status='draft' AND publication_status IN ('draft','revision_requested','rejected')))
         AND ($17::text <> 'editor' OR publication_status IN ('submitted','approved','revision_requested'))
       RETURNING id,title,slug,excerpt,category,author,author_id,content,read_minutes,status,publication_status,submitted_at,cover_color,cover_image,tags,seo_title,meta_description,canonical_url,created_at,updated_at,published_at,featured,view_count`,
      [a.title,a.slug,a.excerpt,a.category,a.author,a.content,a.read_minutes,status,a.cover_color,a.cover_image || null,a.tags,a.seo_title || null,a.meta_description || null,a.canonical_url || null,a.featured,req.params.id,req.admin.role,req.admin.sub,status==='published']
    );
    if (!result.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Article not found, or you do not have permission to edit it in its current workflow state.' }); }
    await syncArticleTaxonomy(client,req.params.id,a);
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { client.release(); }
  await audit(req.admin.sub, 'article.updated', 'article', req.params.id, { status: result.rows[0].status, publication_status: result.rows[0].publication_status });
  res.json({ article: publicArticle(result.rows[0]) });
}));

app.delete('/api/admin/articles/:id', requireAdmin, allowRoles('super_admin','admin','author'), asyncRoute(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid article ID.' });
  const result = await pool.query(`DELETE FROM articles WHERE id=$1 AND ($2::text <> 'author' OR (author_id=$3 AND status='draft' AND publication_status IN ('draft','revision_requested','rejected'))) RETURNING id`, [req.params.id,req.admin.role,req.admin.sub]);
  if (!result.rowCount) return res.status(404).json({ error: 'Article not found, or it is not a draft you can delete.' });
  await audit(req.admin.sub, 'article.deleted', 'article', req.params.id);
  res.json({ ok: true });
}));


app.get('/robots.txt', (req,res) => {
  const origin = (process.env.PUBLIC_SITE_URL || process.env.CLIENT_ORIGIN || `${req.protocol}://${req.get('host')}`).replace(/\/$/,'');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /cms\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', asyncRoute(async (_req, res) => {
  const result = await pool.query("SELECT slug, canonical_url, updated_at, published_at FROM articles WHERE status='published' ORDER BY published_at DESC");
  const origin = (process.env.PUBLIC_SITE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const xml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\"','&quot;').replaceAll("'",'&apos;');
  const urls = result.rows.map(a => `<url><loc>${xml(a.canonical_url || `${origin}/article/${encodeURIComponent(a.slug)}`)}</loc><lastmod>${new Date(a.updated_at || a.published_at).toISOString()}</lastmod></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${xml(origin)}/</loc></url>${urls}</urlset>`);
}));
app.get('/feed.xml', asyncRoute(async (_req, res) => {
  const result = await pool.query("SELECT title,slug,excerpt,published_at,updated_at FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 30");
  const origin = (process.env.PUBLIC_SITE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/$/, '');
  const esc = v => String(v || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&apos;");
  const items = result.rows.map(a => `<item><title>${esc(a.title)}</title><link>${origin}/article/${encodeURIComponent(a.slug)}</link><guid>${origin}/article/${encodeURIComponent(a.slug)}</guid><description>${esc(a.excerpt)}</description><pubDate>${new Date(a.published_at).toUTCString()}</pubDate></item>`).join('');
  res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ByteJournal</title><link>${origin}</link><description>Technical articles from ByteJournal</description>${items}</channel></rss>`);
}));



app.post('/api/admin/articles/:id/submit', requireAdmin, allowRoles('author'), asyncRoute(async (req,res)=>{
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid article ID.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`UPDATE articles SET publication_status='submitted',submitted_at=NOW(),updated_at=NOW()
      WHERE id=$1 AND author_id=$2 AND status='draft' AND publication_status IN ('draft','revision_requested','rejected') RETURNING id`, [req.params.id,req.admin.sub]);
    if (!r.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({error:'Your editable draft was not found.'}); }
    await client.query(`INSERT INTO article_reviews(article_id,reviewer_id,action) VALUES($1,$2,'submitted')`,[req.params.id,req.admin.sub]);
    await client.query('COMMIT');
    await audit(req.admin.sub,'article.submitted','article',req.params.id);
    res.json({ok:true,status:'submitted'});
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));
app.post('/api/admin/articles/:id/review', requireAdmin, allowRoles('super_admin','admin','editor'), asyncRoute(async(req,res)=>{
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid article ID.' });
  const parsed=z.object({action:z.enum(['approved','revision_requested','rejected','published','unpublished']),comment:z.string().max(4000).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid review action.'});
  const {action,comment=''}=parsed.data;
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const found=await client.query('SELECT id,status,publication_status FROM articles WHERE id=$1 FOR UPDATE',[req.params.id]);
    if(!found.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Article not found.'});}
    const current=found.rows[0];
    const allowed = action === 'published' ? current.publication_status === 'approved'
      : action === 'unpublished' ? current.status === 'published'
      : current.publication_status === 'submitted';
    if (!allowed) { await client.query('ROLLBACK'); return res.status(409).json({error:'This article is not in a state that permits the requested review action.'}); }
    const status=action==='published'?'published':'draft';
    const workflow=action==='revision_requested'?'revision_requested':action==='rejected'?'rejected':action==='approved'?'approved':action==='unpublished'?'draft':action;
    await client.query(`UPDATE articles SET status=$1,publication_status=$2,reviewer_id=$3,review_notes=$4,
      published_at=CASE WHEN $6::boolean THEN COALESCE(published_at,NOW()) ELSE published_at END,updated_at=NOW() WHERE id=$5`,
      [status,workflow,req.admin.sub,comment,req.params.id,status==='published']);
    await client.query(`INSERT INTO article_reviews(article_id,reviewer_id,action,comment) VALUES($1,$2,$3,$4)`,[req.params.id,req.admin.sub,action,comment]);
    if (comment.trim()) await client.query(`INSERT INTO review_comments(article_id,user_id,body) VALUES($1,$2,$3)`,[req.params.id,req.admin.sub,comment.trim()]);
    await client.query('COMMIT');
    await audit(req.admin.sub,`article.${action}`,'article',req.params.id);
    res.json({ok:true,status,publication_status:workflow});
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}));
app.get('/api/admin/articles/:id/reviews', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async(req,res)=>{
  const article=await pool.query(`SELECT author_id FROM articles WHERE id=$1`,[req.params.id]);
  if(!article.rowCount) return res.status(404).json({error:'Article not found.'});
  if(req.admin.role==='author' && String(article.rows[0].author_id)!==String(req.admin.sub)) return res.status(403).json({error:'Not your article.'});
  const [reviews,comments]=await Promise.all([
    pool.query(`SELECT r.*,u.name AS reviewer_name FROM article_reviews r LEFT JOIN users u ON u.id=r.reviewer_id WHERE r.article_id=$1 ORDER BY r.created_at`,[req.params.id]),
    pool.query(`SELECT c.*,u.name AS user_name FROM review_comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.article_id=$1 ORDER BY c.created_at`,[req.params.id])
  ]);
  res.json({reviews:reviews.rows,comments:comments.rows});
}));
app.post('/api/admin/articles/:id/comments', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async(req,res)=>{
  const parsed=z.object({body:z.string().trim().min(1).max(4000)}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Comment must contain between 1 and 4000 characters.'});
  const article=await pool.query('SELECT author_id FROM articles WHERE id=$1',[req.params.id]);
  if(!article.rowCount) return res.status(404).json({error:'Article not found.'});
  if(req.admin.role==='author' && String(article.rows[0].author_id)!==String(req.admin.sub)) return res.status(403).json({error:'Not your article.'});
  const result=await pool.query('INSERT INTO review_comments(article_id,user_id,body) VALUES($1,$2,$3) RETURNING id,article_id,user_id,body,created_at',[req.params.id,req.admin.sub,parsed.data.body]);
  res.status(201).json({comment:result.rows[0]});
}));

// Public author application. Approval is deliberately separate from account creation.
const authorRequestAttempts = new Map();
function limitAuthorRequest(req,res,next) {
  const ip=req.ip || req.socket.remoteAddress || 'unknown';
  const now=Date.now(), entry=authorRequestAttempts.get(ip) || {count:0,start:now};
  if(now-entry.start>15*60*1000){entry.count=0;entry.start=now;}
  if(entry.count>=5) return res.status(429).json({error:'Too many applications from this network. Please try again later.'});
  entry.count+=1; authorRequestAttempts.set(ip,entry);
  if(authorRequestAttempts.size>10000) for(const [key,value] of authorRequestAttempts) if(now-value.start>30*60*1000) authorRequestAttempts.delete(key);
  next();
}
const optionalHttpUrl = z.string().url().max(1000).refine(value=>/^https?:\/\//i.test(value),'URL must use HTTP or HTTPS').optional().or(z.literal(''));
app.post('/api/author-requests', limitAuthorRequest, asyncRoute(async (req,res) => {
  const schema = z.object({
    full_name:z.string().trim().min(2).max(120), email:z.string().email().max(254),
    expertise:z.string().trim().min(2).max(180), biography:z.string().trim().min(30).max(3000),
    portfolio_url:optionalHttpUrl,
    github_url:optionalHttpUrl,
    linkedin_url:optionalHttpUrl,
    writing_experience:z.string().max(3000).optional(),
    sample_article_url:optionalHttpUrl,
    motivation:z.string().trim().min(30).max(3000)
  }).safeParse(req.body);
  if(!schema.success) return res.status(400).json({error:schema.error.issues.map(x=>x.message).join('; ')});
  const a=schema.data;
  try {
    const r=await pool.query(`INSERT INTO author_requests(full_name,email,expertise,biography,portfolio_url,github_url,linkedin_url,writing_experience,sample_article_url,motivation)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,status`,
      [a.full_name,a.email.toLowerCase(),a.expertise,a.biography,a.portfolio_url||null,a.github_url||null,a.linkedin_url||null,a.writing_experience||null,a.sample_article_url||null,a.motivation]);
    res.status(201).json({application:r.rows[0],message:'Your application has been received.'});
  } catch(e) { if(e.code==='23505') return res.status(409).json({error:'An active application already exists for this email.'}); throw e; }
}));

app.get('/api/admin/users', requireAdmin, allowRoles('super_admin'), asyncRoute(async (_req,res)=>{
  const r=await pool.query('SELECT id,name,email,role,active,can_edit_website,created_at FROM users ORDER BY created_at DESC');
  res.json({users:r.rows});
}));
app.patch('/api/admin/users/:id', requireAdmin, allowRoles('super_admin'), asyncRoute(async(req,res)=>{
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid user ID.'});
  const parsed=z.object({role:z.enum(['super_admin','admin','editor','author']).optional(),active:z.boolean().optional(),can_edit_website:z.boolean().optional()}).refine(v=>v.role!==undefined||v.active!==undefined||v.can_edit_website!==undefined).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Provide a valid role, active flag or website edit permission.'});
  if(String(req.params.id)===String(req.admin.sub) && parsed.data.active===false) return res.status(409).json({error:'You cannot deactivate your own active session.'});
  const current=await pool.query('SELECT id,role,active FROM users WHERE id=$1',[req.params.id]);
  if(!current.rowCount) return res.status(404).json({error:'User not found.'});
  if(current.rows[0].role==='super_admin' && current.rows[0].active && (parsed.data.active===false || (parsed.data.role && parsed.data.role!=='super_admin'))){
    const count=await pool.query("SELECT COUNT(*)::int AS total FROM users WHERE role='super_admin' AND active=true");
    if(count.rows[0].total<=1) return res.status(409).json({error:'At least one active Super Admin must remain.'});
  }
  const result=await pool.query(`UPDATE users SET role=COALESCE($1,role),active=COALESCE($2,active),can_edit_website=COALESCE($3::boolean,can_edit_website),updated_at=NOW() WHERE id=$4
    RETURNING id,name,email,role,active,can_edit_website,created_at`,[parsed.data.role??null,parsed.data.active??null,parsed.data.can_edit_website??null,req.params.id]);
  await audit(req.admin.sub,'user.updated','user',req.params.id,{role:result.rows[0].role,active:result.rows[0].active,can_edit_website:result.rows[0].can_edit_website});
  res.json({user:result.rows[0]});
}));

app.post('/api/admin/email/test', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const delivery=await sendTransactionalEmail({
    to:req.admin.email,
    subject:'ByteJournal email delivery test',
    text:'This test message confirms that ByteJournal can send email through the configured SMTP server.',
    html:'<p>This test message confirms that ByteJournal can send email through the configured SMTP server.</p>'
  });
  if(!delivery.ok) {
    if(delivery.reason==='not_configured') return res.status(503).json({error:'SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in the server .env file, then restart the API.'});
    if(delivery.reason==='configuration') return res.status(503).json({error:delivery.message});
    return res.status(502).json({error:`SMTP could not send the test email${delivery.code?` (${delivery.code})`:''}. Check SMTP host, port, security mode, username, password, and sender address; the API log has the provider response code.`});
  }
  res.json({sentTo:req.admin.email,message:`Test email sent to ${req.admin.email}.`});
}));

app.post('/api/admin/invitations', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const parsed=z.object({email:z.string().email().max(254),role:z.enum(['admin','editor','author'])}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Provide a valid email and role.'});
  if(req.admin.role!=='super_admin' && parsed.data.role!=='author') return res.status(403).json({error:'Only Super Admin can invite administrators or editors.'});
  const token=randomUUID()+randomUUID();
  const hash=createHash('sha256').update(token).digest('hex');
  const inviteEmail=parsed.data.email.toLowerCase();
  const existingUser=await pool.query('SELECT id FROM users WHERE lower(email)=$1',[inviteEmail]);
  if(existingUser.rowCount) return res.status(409).json({error:'An account already exists for this email.'});
  await pool.query('UPDATE invitations SET revoked_at=NOW() WHERE lower(email)=$1 AND accepted_at IS NULL AND revoked_at IS NULL',[inviteEmail]);
  const r=await pool.query(`INSERT INTO invitations(email,role,token_hash,invited_by,expires_at)
    VALUES($1,$2,$3,$4,NOW()+INTERVAL '72 hours') RETURNING id,email,role,expires_at`,
    [inviteEmail,parsed.data.role,hash,req.admin.sub]);
  await pool.query(`UPDATE author_requests SET status='Invited',reviewed_by=$2,updated_at=NOW()
    WHERE lower(email)=$1 AND status='Approved'`,[inviteEmail,req.admin.sub]);
  await audit(req.admin.sub,'invitation.created','invitation',r.rows[0].id,{email:r.rows[0].email,role:r.rows[0].role});
  const acceptanceUrl=`${publicSiteBaseUrl()}/accept-invitation?token=${token}`;
  const delivery=await sendTransactionalEmail({
    to:inviteEmail,
    subject:'You are invited to ByteJournal',
    text:`You have been invited to join ByteJournal as an ${parsed.data.role}. Use this one-time link within 72 hours to activate your account:\n\n${acceptanceUrl}\n\nIf you were not expecting this invitation, you can ignore this email.`,
    html:`<p>You have been invited to join ByteJournal as an ${escapeHtml(parsed.data.role)}.</p><p><a href="${escapeHtml(acceptanceUrl)}">Accept your invitation</a>. This one-time link expires in 72 hours.</p><p>If you were not expecting this invitation, you can ignore this email.</p>`
  });
  res.status(201).json({invitation:r.rows[0],...(delivery.ok?{}:{acceptanceUrl}),delivery:delivery.ok?'email':'manual',deliveryReason:delivery.reason||null,deliveryCode:delivery.code||null,deliveryMessage:delivery.message||null});
}));
app.post('/api/invitations/accept', asyncRoute(async(req,res)=>{
  const parsed=z.object({token:z.string().min(40).max(100),name:z.string().trim().min(2).max(120),password:z.string().min(12).max(200)}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Enter your name and a password of at least 12 characters.'});
  const hash=createHash('sha256').update(parsed.data.token).digest('hex');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const q=await client.query(`SELECT * FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW() FOR UPDATE`,[hash]);
    if(!q.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({error:'Invitation is invalid, expired, or already used.'}); }
    const inv=q.rows[0], passwordHash=await bcrypt.hash(parsed.data.password,12);
    const u=await client.query(`INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role`,
      [parsed.data.name,inv.email,passwordHash,inv.role]);
    await client.query('UPDATE invitations SET accepted_at=NOW() WHERE id=$1',[inv.id]);
    await client.query(`UPDATE author_requests SET status='Completed',updated_at=NOW() WHERE lower(email)=lower($1) AND status='Invited'`,[inv.email]);
    await client.query('COMMIT');
    res.status(201).json({user:u.rows[0]});
  } catch(e) { await client.query('ROLLBACK'); if(e.code==='23505') return res.status(409).json({error:'An account already exists for this email.'}); throw e; }
  finally { client.release(); }
}));
app.post('/api/admin/invitations/:id/resend', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid invitation ID.'});
  const token=randomUUID()+randomUUID();
  const hash=createHash('sha256').update(token).digest('hex');
  const r=await pool.query(`UPDATE invitations SET token_hash=$1,expires_at=NOW()+INTERVAL '72 hours',revoked_at=NULL
    WHERE id=$2 AND accepted_at IS NULL AND ($3::text='super_admin' OR role='author') RETURNING id,email,role,expires_at`,[hash,req.params.id,req.admin.role]);
  if(!r.rowCount) return res.status(404).json({error:'Unaccepted invitation not found.'});
  await audit(req.admin.sub,'invitation.resent','invitation',req.params.id);
  const acceptanceUrl=`${publicSiteBaseUrl()}/accept-invitation?token=${token}`;
  const delivery=await sendTransactionalEmail({
    to:r.rows[0].email,
    subject:'Your ByteJournal invitation link',
    text:`Use this one-time link within 72 hours to accept your ByteJournal invitation:\n\n${acceptanceUrl}\n\nIf you were not expecting this invitation, you can ignore this email.`,
    html:`<p>Use this one-time link within 72 hours to accept your ByteJournal invitation:</p><p><a href="${escapeHtml(acceptanceUrl)}">Accept your invitation</a></p><p>If you were not expecting this invitation, you can ignore this email.</p>`
  });
  res.json({invitation:r.rows[0],...(delivery.ok?{}:{acceptanceUrl}),delivery:delivery.ok?'email':'manual',deliveryReason:delivery.reason||null,deliveryCode:delivery.code||null,deliveryMessage:delivery.message||null});
}));

app.get('/api/admin/invitations', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const r=await pool.query(`SELECT id,email,role,expires_at,accepted_at,revoked_at,created_at FROM invitations
    WHERE ($1::text='super_admin' OR role='author') ORDER BY created_at DESC`,[req.admin.role]);
  res.json({invitations:r.rows});
}));
app.post('/api/admin/invitations/:id/revoke', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const r=await pool.query(`UPDATE invitations SET revoked_at=NOW() WHERE id=$1 AND accepted_at IS NULL AND revoked_at IS NULL
    AND ($2::text='super_admin' OR role='author') RETURNING id`,[req.params.id,req.admin.role]);
  if(!r.rowCount) return res.status(404).json({error:'Active invitation not found.'});
  await audit(req.admin.sub,'invitation.revoked','invitation',req.params.id);
  res.json({ok:true});
}));
app.get('/api/admin/author-requests', requireAdmin, allowRoles('super_admin','admin','editor'), asyncRoute(async(req,res)=>{
  const status=String(req.query.status||'').slice(0,24);
  const term=String(req.query.q||'').trim().slice(0,100);
  const clauses=[],params=[];
  if(status){params.push(status);clauses.push(`status=$${params.length}`);}
  if(term){params.push(`%${term}%`);clauses.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length} OR expertise ILIKE $${params.length})`);}
  const r=await pool.query(`SELECT * FROM author_requests ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY created_at DESC LIMIT 250`,params);
  res.json({applications:r.rows});
}));
app.patch('/api/admin/author-requests/:id', requireAdmin, allowRoles('super_admin','admin'), asyncRoute(async(req,res)=>{
  const parsed=z.object({status:z.enum(['Under Review','Approved','Rejected','Invited','Completed']),review_notes:z.string().max(4000).optional()}).safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid application status or review notes.'});
  const r=await pool.query(`UPDATE author_requests SET status=$1,review_notes=$2,reviewed_by=$3,updated_at=NOW() WHERE id=$4 RETURNING *`,
    [parsed.data.status,parsed.data.review_notes||null,req.admin.sub,req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'Application not found.'});
  await audit(req.admin.sub,'author_request.status_changed','author_request',req.params.id,{status:parsed.data.status});
  res.json({application:r.rows[0]});
}));
app.get('/api/authors', asyncRoute(async(_req,res)=>{
  const r=await pool.query(`SELECT u.id,u.name,u.bio,u.expertise,COUNT(a.id)::int AS article_count
    FROM users u LEFT JOIN articles a ON a.author_id=u.id AND a.status='published'
    WHERE u.active=true AND u.role IN ('author','editor','admin','super_admin')
    GROUP BY u.id,u.name,u.bio,u.expertise HAVING COUNT(a.id)>0 ORDER BY article_count DESC,u.name ASC`);
  res.json({authors:r.rows});
}));
app.get('/api/authors/:id', asyncRoute(async(req,res)=>{
  if(!/^\d+$/.test(req.params.id)) return res.status(400).json({error:'Invalid author ID.'});
  const r=await pool.query(`SELECT u.id,u.name,u.bio,u.expertise,COUNT(a.id)::int AS article_count
    FROM users u LEFT JOIN articles a ON a.author_id=u.id AND a.status='published'
    WHERE u.id=$1 AND u.active=true GROUP BY u.id,u.name,u.bio,u.expertise`,[req.params.id]);
  if(!r.rowCount) return res.status(404).json({error:'Author not found.'});
  const articles=await pool.query(`SELECT id,title,slug,excerpt,category,published_at,read_minutes FROM articles WHERE author_id=$1 AND status='published' ORDER BY published_at DESC LIMIT 30`,[req.params.id]);
  res.json({author:r.rows[0],articles:articles.rows});
}));

const defaultLightPalette={
  background:'#F7F3EB',surface:'#FFFFFF',elevatedSurface:'#F0EBE1',primaryText:'#242424',secondaryText:'#62635C',mutedText:'#77776F',
  primaryAccent:'#526B55',accentHover:'#405642',accentText:'#FFFFFF',links:'#405E45',borders:'#E2DCCF',inputs:'#FFFEFA'
};
const defaultDarkPalette={
  background:'#171916',surface:'#22251F',elevatedSurface:'#2A2D26',primaryText:'#F2EEE5',secondaryText:'#B6B7AE',mutedText:'#9B9D93',
  primaryAccent:'#A6B8A3',accentHover:'#C0D0BA',accentText:'#171916',links:'#C0D0BA',borders:'#393C34',inputs:'#1C1F1A'
};
const defaultAppearance = {
  siteName:'ByteJournal',tagline:'Ideas with depth.',browserTitle:'ByteJournal — Technical Journal',
  logoUrl:'',faviconUrl:'',defaultSocialImage:'',
  primaryColor:'#526B55',secondaryColor:'#FFFFFF',accentColor:'#405642',backgroundColor:'#F7F3EB',surfaceColor:'#FFFFFF',textColor:'#242424',linkColor:'#405E45',
  lightPalette:defaultLightPalette,darkPalette:defaultDarkPalette,
  headingFont:'manrope',bodyFont:'system',codeFont:'mono',fontSize:'medium',
  headerLayout:'split',navigationLayout:'links',footerLayout:'columns',articleCardStyle:'bordered',borderRadius:8,contentWidth:1200,homepageLayout:'editorial',homepageIntro:'A technical journal for curious builders. Explore software architecture, web engineering, databases, and the ideas shaping what comes next.',
  homepageOrder:['featured','latest','popular','topics'],homepageCategories:[],showFeatured:true,showLatest:true,showPopular:true,featuredCount:1,latestCount:8,popularCount:4,themePreference:'system'
};
function mergeAppearance(...sources) {
  const merged={...defaultAppearance,lightPalette:{...defaultLightPalette},darkPalette:{...defaultDarkPalette}};
  for(const source of sources) {
    if(!source) continue;
    for(const [key,value] of Object.entries(source)) if(key!=='lightPalette'&&key!=='darkPalette') merged[key]=value;
    merged.lightPalette={...merged.lightPalette,...(source.lightPalette||{})};
    merged.darkPalette={...merged.darkPalette,...(source.darkPalette||{})};
  }
  return merged;
}
const sitePageDefinitions = [
  ['home','Home page'],['articles','Articles page'],['articleDetail','Article detail pages'],['categories','Categories page'],['categoryDetail','Category detail pages'],['tagDetail','Tag detail pages'],
  ['tutorials','Tutorials page'],['techNews','Tech news page'],['about','About page'],['becomeAuthor','Become an author page'],
  ['search','Search page'],['faqs','FAQs page'],['contact','Contact page'],['login','Sign in page'],['register','Account activation page'],
  ['acceptInvitation','Invitation acceptance page'],['authorProfile','Author profile page'],['dashboard','Member dashboard page'],['privacyPolicy','Privacy policy'],['terms','Terms & Conditions'],['cookiePolicy','Cookie policy'],
  ['disclaimer','Disclaimer'],['notFound','404 page']
];
const sitePageKeys = sitePageDefinitions.map(([key])=>key);
const defaultSitePages = Object.fromEntries(sitePageKeys.map(key=>[key,{title:'',intro:'',body:''}]));
const sitePanelSchema=z.object({
  id:z.string().trim().min(8).max(100),title:z.string().max(180),body:z.string().max(20000),
  placement:z.object({target:z.string().max(700),edge:z.enum(['before','after'])}).strict().optional()
}).strict();
const sitePanelSizeSchema=z.object({
  width:z.number().int().min(40).max(1600),height:z.number().int().min(24).max(1600)
}).strict();
const siteElementStyleSchema=z.object({
  fontSize:z.number().int().min(8).max(96).optional(),
  fontFamily:z.enum(['system','manrope','serif','inter','mono']).optional(),
  fontWeight:z.enum(['400','500','600','700','800']).optional(),
  fontStyle:z.enum(['normal','italic']).optional(),
  color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  backgroundColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  alignment:z.enum(['left','center','right']).optional(),
  textAlign:z.enum(['left','center','right','justify']).optional(),
  offsetX:z.number().int().min(-1000).max(1000).optional(),
  offsetY:z.number().int().min(-1000).max(1000).optional(),
  positionTouched:z.boolean().optional(),
  hoverColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  hoverBackgroundColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  afterContent:z.string().trim().max(80).optional(),
  afterColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  afterBackgroundColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  afterFontSize:z.number().int().min(8).max(96).optional()
}).strict();
const sitePageSchema=z.object({
  title:z.string().trim().max(180).optional(),
  intro:z.string().max(1200).optional(),
  body:z.string().max(50000).optional(),
  textOverrides:z.record(z.string().max(700),z.string().max(10000)).optional(),
  panelSizes:z.record(z.string().max(700),sitePanelSizeSchema).optional(),
  elementStyles:z.record(z.string().max(700),siteElementStyleSchema).optional(),
  panels:z.array(sitePanelSchema).max(20).optional()
}).strict();
const sitePagesSchema=z.record(z.string(),sitePageSchema).superRefine((pages,context)=>{
  let totalCharacters=0;
  for(const [key,page] of Object.entries(pages)) {
    if(!sitePageKeys.includes(key)) context.addIssue({code:'custom',path:[key],message:'Unknown website page.'});
    if(Object.keys(page.elementStyles||{}).length>1000) context.addIssue({code:'custom',path:[key,'elementStyles'],message:'A website page can have at most 1,000 styled items.'});
    totalCharacters+=page.title?.length||0;
    totalCharacters+=page.intro?.length||0;
    totalCharacters+=page.body?.length||0;
    totalCharacters+=Object.values(page.textOverrides||{}).reduce((total,value)=>total+value.length,0);
    totalCharacters+=JSON.stringify(page.panelSizes||{}).length+JSON.stringify(page.elementStyles||{}).length;
    totalCharacters+=(page.panels||[]).reduce((total,panel)=>total+panel.title.length+panel.body.length,0);
  }
  if(totalCharacters>150000) context.addIssue({code:'custom',message:'Combined website page content must be under 150,000 characters.'});
});
const appearanceAssetUrl=z.string().trim().max(500).refine(value=>value===''||/^https?:\/\//i.test(value)||/^\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp|gif)$/i.test(value),'Use an HTTP(S) URL or a supported uploaded image path.').optional();
const themePaletteSchema=z.object({
  background:z.string().regex(/^#[0-9a-fA-F]{6}$/),surface:z.string().regex(/^#[0-9a-fA-F]{6}$/),elevatedSurface:z.string().regex(/^#[0-9a-fA-F]{6}$/),
  primaryText:z.string().regex(/^#[0-9a-fA-F]{6}$/),secondaryText:z.string().regex(/^#[0-9a-fA-F]{6}$/),mutedText:z.string().regex(/^#[0-9a-fA-F]{6}$/),
  primaryAccent:z.string().regex(/^#[0-9a-fA-F]{6}$/),accentHover:z.string().regex(/^#[0-9a-fA-F]{6}$/),accentText:z.string().regex(/^#[0-9a-fA-F]{6}$/),
  links:z.string().regex(/^#[0-9a-fA-F]{6}$/),borders:z.string().regex(/^#[0-9a-fA-F]{6}$/),inputs:z.string().regex(/^#[0-9a-fA-F]{6}$/)
}).strict();
const appearanceSchema=z.object({
  siteName:z.string().trim().min(1).max(80).optional(),tagline:z.string().max(180).optional(),browserTitle:z.string().trim().max(120).optional(),
  logoUrl:appearanceAssetUrl,faviconUrl:appearanceAssetUrl,defaultSocialImage:appearanceAssetUrl,
  lightPalette:themePaletteSchema.optional(),darkPalette:themePaletteSchema.optional(),
  primaryColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),secondaryColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),backgroundColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),surfaceColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),textColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),linkColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  headingFont:z.enum(['system','manrope','serif','inter']).optional(),bodyFont:z.enum(['system','manrope','serif','inter']).optional(),codeFont:z.enum(['mono','system','serif']).optional(),fontSize:z.enum(['small','medium','large']).optional(),
  headerLayout:z.enum(['split','centered','compact']).optional(),navigationLayout:z.enum(['links','pills']).optional(),footerLayout:z.enum(['columns','compact']).optional(),articleCardStyle:z.enum(['bordered','minimal','filled']).optional(),borderRadius:z.number().int().min(0).max(24).optional(),contentWidth:z.number().int().min(900).max(1600).optional(),homepageLayout:z.enum(['editorial','grid','list']).optional(),
  homepageIntro:z.string().max(500).optional(),homepageOrder:z.array(z.enum(['featured','latest','popular','topics'])).max(4).refine(items=>new Set(items).size===items.length,'Homepage sections must be unique.').optional(),homepageCategories:z.array(z.string().trim().min(1).max(100)).max(12).optional(),showFeatured:z.boolean().optional(),showLatest:z.boolean().optional(),showPopular:z.boolean().optional(),featuredCount:z.number().int().min(1).max(8).optional(),latestCount:z.number().int().min(1).max(12).optional(),popularCount:z.number().int().min(1).max(12).optional(),themePreference:z.enum(['system','light','dark']).optional()
});
app.get('/api/settings', asyncRoute(async(_req,res)=>{
  const r=await pool.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key IN ('appearance','appearance_published','pages','pages_published')`);
  const values=Object.fromEntries(r.rows.map(row=>[row.setting_key,row.setting_value]));
  res.json({settings:mergeAppearance(values.appearance_published||values.appearance||{}),pages:{...defaultSitePages,...(values.pages_published||{})}});
}));
app.get('/api/admin/settings/pages', requireAdmin, allowWebsiteEditing, asyncRoute(async(_req,res)=>{
  const r=await pool.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key IN ('pages','pages_published')`);
  const values=Object.fromEntries(r.rows.map(row=>[row.setting_key,row.setting_value]));
  res.json({draft:{...defaultSitePages,...(values.pages||values.pages_published||{})},hasPublished:Boolean(values.pages_published)});
}));
app.put('/api/admin/settings/pages', requireAdmin, allowWebsiteEditing, asyncRoute(async(req,res)=>{
  const parsed=sitePagesSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid website page content.',details:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`)});
  const current=await pool.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key IN ('pages','pages_published')`);
  const values=Object.fromEntries(current.rows.map(row=>[row.setting_key,row.setting_value]));
  const draft={...defaultSitePages,...(values.pages||values.pages_published||{}),...parsed.data};
  await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_by) VALUES('pages',$1,$2)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[JSON.stringify(draft),req.admin.sub]);
  await audit(req.admin.sub,'pages.saved','site_settings','pages',{page_count:Object.keys(parsed.data).length});
  res.json({pages:draft});
}));
app.post('/api/admin/settings/pages/publish', requireAdmin, allowWebsiteEditing, asyncRoute(async(req,res)=>{
  const draft=await pool.query('SELECT setting_value FROM site_settings WHERE setting_key=$1',['pages']);
  const pages={...defaultSitePages,...(draft.rows[0]?.setting_value||{})};
  const result=await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_by) VALUES('pages_published',$1,$2)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING setting_value`,[JSON.stringify(pages),req.admin.sub]);
  await audit(req.admin.sub,'pages.published','site_settings','pages');
  res.json({pages:result.rows[0].setting_value});
}));
app.get('/api/admin/settings/appearance', requireAdmin, allowWebsiteEditing, asyncRoute(async(_req,res)=>{
  const r=await pool.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key IN ('appearance','appearance_published')`);
  const settings=Object.fromEntries(r.rows.map(row=>[row.setting_key,row.setting_value]));
  res.json({draft:mergeAppearance(settings.appearance||settings.appearance_published||{}),published:mergeAppearance(settings.appearance_published||settings.appearance||{}),hasPublished:Boolean(settings.appearance_published)});
}));
app.put('/api/admin/settings/appearance', requireAdmin, allowWebsiteEditing, asyncRoute(async(req,res)=>{
  const parsed=appearanceSchema.safeParse(req.body);
  if(!parsed.success) return res.status(400).json({error:'Invalid appearance settings.',details:parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`)});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const current=await client.query(`SELECT setting_key,setting_value FROM site_settings WHERE setting_key IN ('appearance','appearance_published') FOR UPDATE`);
    const values=Object.fromEntries(current.rows.map(row=>[row.setting_key,row.setting_value]));
    const draft=mergeAppearance(values.appearance||values.appearance_published||{},parsed.data);
    if(!values.appearance_published) await client.query(`INSERT INTO site_settings(setting_key,setting_value,updated_by) VALUES('appearance_published',$1,$2) ON CONFLICT(setting_key) DO NOTHING`,[JSON.stringify(mergeAppearance(values.appearance||{})),req.admin.sub]);
    await client.query(`INSERT INTO site_settings(setting_key,setting_value,updated_by) VALUES('appearance',$1,$2)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=NOW()`,[JSON.stringify(draft),req.admin.sub]);
    await client.query('COMMIT');
    await audit(req.admin.sub,'appearance.saved','site_settings','appearance');
    res.json({settings:draft});
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { client.release(); }
}));
app.post('/api/admin/settings/appearance/publish', requireAdmin, allowWebsiteEditing, asyncRoute(async(req,res)=>{
  const draft=await pool.query('SELECT setting_value FROM site_settings WHERE setting_key=$1',['appearance']);
  const published=mergeAppearance(draft.rows[0]?.setting_value||{});
  const r=await pool.query(`INSERT INTO site_settings(setting_key,setting_value,updated_by) VALUES('appearance_published',$1,$2)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_by=EXCLUDED.updated_by,updated_at=NOW() RETURNING setting_value`,[JSON.stringify(published),req.admin.sub]);
  await audit(req.admin.sub,'appearance.published','site_settings','appearance');
  res.json({settings:r.rows[0].setting_value});
}));
app.get('/api/admin/dashboard', requireAdmin, allowRoles('super_admin','admin','editor','author'), asyncRoute(async(req,res)=>{
  const [articles,users,requests,recent]=await Promise.all([
    pool.query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='published')::int published,COUNT(*) FILTER(WHERE status='draft')::int drafts,COUNT(*) FILTER(WHERE publication_status='submitted')::int pending_reviews
      FROM articles WHERE ($1::text <> 'author' OR author_id=$2)`,[req.admin.role,req.admin.sub]),
    pool.query(`SELECT COUNT(*)::int total FROM users WHERE role='author' AND active=true`),
    pool.query(`SELECT COUNT(*)::int total FROM author_requests WHERE status IN('Pending','Under Review')`),
    pool.query(`SELECT id,title,status,publication_status,updated_at FROM articles WHERE ($1::text <> 'author' OR author_id=$2) ORDER BY updated_at DESC LIMIT 8`,[req.admin.role,req.admin.sub])
  ]);
  res.json({stats:{...articles.rows[0],authors:users.rows[0].total,pending_author_requests:requests.rows[0].total},recent:recent.rows});
}));

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));

app.use((err, _req, res, _next) => {
  if (err?.code === '23505') return res.status(409).json({ error: 'That URL slug is already in use. Choose a unique slug.' });
  console.error(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  res.status(Number(err?.status) >= 400 && Number(err?.status) < 500 ? Number(err.status) : 500)
    .json({ error: Number(err?.status) >= 400 && Number(err?.status) < 500 ? err.message : 'Something went wrong on the server. Check the server terminal for details.' });
});

await initializeDatabase();
const server = app.listen(PORT, HOST, () => console.log(`ByteJournal API running at http://${HOST}:${PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(async () => { await pool.end(); process.exit(0); }));
}

import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, ensureSchema } from './db';

export const COOKIE = 'nh_session';
const SESSION_DAYS = 180;

/* ---------- পাসওয়ার্ড ---------- */
// scrypt নোডের ভেতরেই আছে, তাই বাইরের কোনো লাইব্রেরি লাগে না

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64);
  return 's1$' + salt.toString('hex') + '$' + key.toString('hex');
}

export function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 's1') return false;
  let key;
  try {
    key = scryptSync(password, Buffer.from(parts[1], 'hex'), 64);
  } catch (err) {
    return false;
  }
  const want = Buffer.from(parts[2], 'hex');
  if (key.length !== want.length) return false;
  return timingSafeEqual(key, want);
}

/* ---------- সেশন ---------- */
// টোকেন যায় কুকিতে, ডেটাবেসে থাকে শুধু তার হ্যাশ

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId) {
  const sql = db();
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await sql`
    insert into nh_sessions (token_hash, user_id, expires_at)
    values (${hashToken(token)}, ${userId}, ${expires.toISOString()})
  `;
  return { token, expires };
}

export async function destroySession(token) {
  if (!token) return;
  const sql = db();
  await sql`delete from nh_sessions where token_hash = ${hashToken(token)}`;
}

// কুকির টোকেন থেকে ব্যবহারকারী বের করি, মেয়াদ পেরোলে না
export async function userFromToken(token) {
  if (!token) return null;
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    select u.id, u.username, u.display_name, u.partner_id
    from nh_sessions s
    join nh_users u on u.id = s.user_id
    where s.token_hash = ${hashToken(token)} and s.expires_at > now()
    limit 1
  `;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    username: rows[0].username,
    name: rows[0].display_name || rows[0].username,
    partnerId: rows[0].partner_id ? Number(rows[0].partner_id) : null,
  };
}

export function cookieOptions(expires) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  };
}

/* ---------- ইনপুট যাচাই ---------- */

export function checkUsername(value) {
  const name = String(value || '').trim().toLowerCase();
  if (name.length < 3) return { ok: false, error: 'ইউজারনেম অন্তত ৩ অক্ষরের হতে হবে' };
  if (name.length > 24) return { ok: false, error: 'ইউজারনেম ২৪ অক্ষরের বেশি নয়' };
  if (!/^[a-z0-9._-]+$/.test(name)) {
    return { ok: false, error: 'ইউজারনেমে শুধু ইংরেজি অক্ষর, সংখ্যা আর . _ - চলবে' };
  }
  return { ok: true, value: name };
}

export function checkPassword(value) {
  const pw = String(value || '');
  if (pw.length < 6) return { ok: false, error: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে' };
  if (pw.length > 200) return { ok: false, error: 'পাসওয়ার্ড অনেক বড় হয়ে গেছে' };
  return { ok: true, value: pw };
}

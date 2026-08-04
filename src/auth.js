'use strict';
// auth.js — password hashing, sessions, CSRF, brute-force throttling.
// Deliberately dependency-free (crypto is a Node built-in). In production
// swap the in-memory Maps below for Redis so sessions survive restarts
// and work across multiple app instances — see README.

const crypto = require('node:crypto');

const SESSION_COOKIE = 'bteu_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8h
const SECRET = process.env.SESSION_SECRET;
if (!SECRET || SECRET.length < 16) {
  throw new Error(
    'SESSION_SECRET env var is missing or too short (>=16 chars). ' +
    'Set it in .env — see .env.example. Refusing to start with a weak/default secret.'
  );
}

// ---- password hashing (scrypt, salted) --------------------------------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- sessions (signed, server-side store) -----------------------------
// The cookie only carries an opaque random id; the actual session data
// lives server-side, so nothing sensitive is exposed to the client.

const sessions = new Map(); // id -> { adminId, username, role, expires }

function sign(value) {
  const mac = crypto.createHmac('sha256', SECRET).update(value).digest('hex');
  return `${value}.${mac}`;
}
function unsign(signed) {
  const idx = signed.lastIndexOf('.');
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(value).digest('hex');
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

function createSession(admin) {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, {
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    expires: Date.now() + SESSION_TTL_MS,
  });
  return { cookieName: SESSION_COOKIE, cookieValue: sign(id) };
}

function getSession(signedId) {
  if (!signedId) return null;
  const id = unsign(signedId);
  if (!id) return null;
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() > s.expires) {
    sessions.delete(id);
    return null;
  }
  return s;
}

function destroySession(signedId) {
  const id = signedId && unsign(signedId);
  if (id) sessions.delete(id);
}

// periodic cleanup so the Map doesn't grow forever in a long-running dev process
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now > s.expires) sessions.delete(id);
}, 60_000).unref();

// ---- CSRF ---------------------------------------------------------------

function csrfTokenFor(session) {
  // Deterministic per-session token; regenerated whenever the session is (re)created.
  return crypto.createHmac('sha256', SECRET).update(String(session.adminId) + session.expires).digest('hex');
}

// ---- brute-force throttling for /admin/login ----------------------------

const loginAttempts = new Map(); // ip -> { count, resetAt }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}
function recordFailedAttempt(ip) {
  const rec = loginAttempts.get(ip) || { count: 0, resetAt: Date.now() + WINDOW_MS };
  rec.count += 1;
  loginAttempts.set(ip, rec);
}
function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  csrfTokenFor,
  isRateLimited,
  recordFailedAttempt,
  clearAttempts,
};

'use strict';
// server.js — application entry point.
// Built on Node's built-in `http` module rather than Express so the
// project runs with zero external dependencies in this sandbox. The code
// is organised the way an Express app would be (routes/middleware
// separated) so swapping in Express later is a mechanical change — see
// README "От прототипа к продакшену".

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

loadEnvFile(); // .env support without a package (see helper below)

const db = require('./db');
const auth = require('./auth');
const render = require('./render');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_BODY_BYTES = 1024 * 1024; // 1MB — plenty for a news form, blocks naive DoS via huge bodies

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

// ---------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = (m[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function setCookie(res, name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path || '/'}`);
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  const existing = res.getHeader('Set-Cookie');
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parseForm(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

function slugify(str) {
  const map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return str
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || crypto.randomBytes(4).toString('hex');
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function getClientIp(req) {
  // Only trust X-Forwarded-For if you actually sit behind a reverse proxy
  // that sets it (see README nginx config). Otherwise this is spoofable.
  if (process.env.TRUST_PROXY === 'true') {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

async function ensureBootstrapAdmin() {
  if (db.countAdmins() > 0) return;
  const username = process.env.ADMIN_BOOTSTRAP_USER;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) {
    console.warn(
      '[auth] No admin accounts exist and ADMIN_BOOTSTRAP_USER/PASSWORD are not set.\n' +
      '        Set them in .env for first run, then remove them — see README.'
    );
    return;
  }
  const { salt, hash } = auth.hashPassword(password);
  db.createAdmin({ username, password_hash: hash, salt, role: 'admin' });
  console.log(`[auth] Bootstrap admin "${username}" created. Remove ADMIN_BOOTSTRAP_* from .env now.`);
}

// ---------------------------------------------------------------------
// static file serving (public/)
// ---------------------------------------------------------------------

function serveStatic(req, res, urlPath) {
  const rel = urlPath.replace(/^\/public\//, '');
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return true;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.css' || ext === '.js' ? 'public, max-age=3600' : 'public, max-age=86400',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ---------------------------------------------------------------------
// route handlers
// ---------------------------------------------------------------------

function requireAuth(req, res) {
  const cookies = parseCookies(req);
  const session = auth.getSession(cookies[auth.SESSION_COOKIE]);
  if (!session) {
    res.writeHead(302, { Location: '/admin/login' }).end();
    return null;
  }
  return session;
}

function checkCsrf(session, body) {
  const expected = auth.csrfTokenFor(session);
  return body._csrf && body._csrf === expected;
}

async function handlePublic(req, res, pathname, query) {
  if (pathname === '/') {
    const html = render.homePage({
      news: db.listPublishedNews({ limit: 8 }),
      events: db.listUpcomingEvents(4),
      programs: db.listPrograms(),
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    return true;
  }

  if (pathname === '/news') {
    const category = query.get('category') || null;
    const html = render.newsListPage({ news: db.listPublishedNews({ category, limit: 50 }), category });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    return true;
  }

  const newsMatch = pathname.match(/^\/news\/([a-z0-9-]+)$/);
  if (newsMatch) {
    const item = db.getNewsBySlug(newsMatch[1]);
    if (!item || item.status !== 'published') return false;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(render.newsDetailPage(item));
    return true;
  }

  // JSON API — e.g. for a future mobile app or headless frontend
  if (pathname === '/api/news') {
    const items = db.listPublishedNews({ limit: 50 });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(items));
    return true;
  }

  return false;
}

async function handleAdmin(req, res, pathname, method) {
  if (pathname === '/admin/login') {
    if (method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(render.loginPage());
      return true;
    }
    if (method === 'POST') {
      const ip = getClientIp(req);
      if (auth.isRateLimited(ip)) {
        res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(render.loginPage({ error: 'Слишком много попыток входа. Повторите позже.' }));
        return true;
      }
      const body = parseForm(await readBody(req));
      const admin = db.getAdminByUsername(body.username || '');
      const ok = admin && auth.verifyPassword(body.password || '', admin.salt, admin.password_hash);
      if (!ok) {
        auth.recordFailedAttempt(ip);
        res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(render.loginPage({ error: 'Неверный логин или пароль.' }));
        return true;
      }
      auth.clearAttempts(ip);
      const { cookieName, cookieValue } = auth.createSession(admin);
      setCookie(res, cookieName, cookieValue, { maxAge: 60 * 60 * 8 });
      res.writeHead(302, { Location: '/admin' }).end();
      return true;
    }
  }

  if (pathname === '/admin/logout' && method === 'POST') {
    const cookies = parseCookies(req);
    auth.destroySession(cookies[auth.SESSION_COOKIE]);
    setCookie(res, auth.SESSION_COOKIE, '', { maxAge: 0 });
    res.writeHead(302, { Location: '/admin/login' }).end();
    return true;
  }

  // Everything below requires an authenticated session.
  const session = requireAuth(req, res);
  if (!session) return true; // requireAuth already redirected

  if (pathname === '/admin' && method === 'GET') {
    const html = render.adminDashboard({
      news: db.listAllNewsForAdmin(),
      session,
      csrfToken: auth.csrfTokenFor(session),
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    return true;
  }

  if (pathname === '/admin/news/new' && method === 'GET') {
    const html = render.adminNewsForm({
      categories: db.listCategories(),
      session,
      csrfToken: auth.csrfTokenFor(session),
    });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    return true;
  }

  if (pathname === '/admin/news' && method === 'POST') {
    const body = parseForm(await readBody(req));
    if (!checkCsrf(session, body)) return sendCsrfError(res);
    const slug = (body.slug || slugify(body.title)).trim();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    try {
      const id = db.createNews({
        slug,
        title: body.title.trim(),
        excerpt: body.excerpt || '',
        body: body.body || '',
        cover_image: body.cover_image || null,
        category_id: body.category_id ? Number(body.category_id) : null,
        status: body.status === 'published' ? 'published' : 'draft',
        published_at: body.status === 'published' ? now : null,
        author_id: session.adminId,
      });
      db.logAction(session.adminId, 'news.create', 'news', id);
    } catch (e) {
      const html = render.adminNewsForm({
        item: body, categories: db.listCategories(), session,
        error: 'Не удалось сохранить: возможно, такой slug уже используется.',
        csrfToken: auth.csrfTokenFor(session),
      });
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      return true;
    }
    res.writeHead(302, { Location: '/admin' }).end();
    return true;
  }

  const editMatch = pathname.match(/^\/admin\/news\/(\d+)\/edit$/);
  if (editMatch && method === 'GET') {
    const item = db.getNewsById(Number(editMatch[1]));
    if (!item) return false;
    const html = render.adminNewsForm({ item, categories: db.listCategories(), session, csrfToken: auth.csrfTokenFor(session) });
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    return true;
  }

  const updateMatch = pathname.match(/^\/admin\/news\/(\d+)$/);
  if (updateMatch && method === 'POST') {
    const id = Number(updateMatch[1]);
    const body = parseForm(await readBody(req));
    if (!checkCsrf(session, body)) return sendCsrfError(res);
    const existing = db.getNewsById(id);
    if (!existing) return false;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const nextStatus = body.status === 'published' ? 'published' : 'draft';
    db.updateNews(id, {
      slug: (body.slug || slugify(body.title)).trim(),
      title: body.title.trim(),
      excerpt: body.excerpt || '',
      body: body.body || '',
      cover_image: body.cover_image || null,
      category_id: body.category_id ? Number(body.category_id) : null,
      status: nextStatus,
      published_at: nextStatus === 'published' ? (existing.published_at || now) : null,
    });
    db.logAction(session.adminId, 'news.update', 'news', id);
    res.writeHead(302, { Location: '/admin' }).end();
    return true;
  }

  const deleteMatch = pathname.match(/^\/admin\/news\/(\d+)\/delete$/);
  if (deleteMatch && method === 'POST') {
    const id = Number(deleteMatch[1]);
    const body = parseForm(await readBody(req));
    if (!checkCsrf(session, body)) return sendCsrfError(res);
    db.deleteNews(id);
    db.logAction(session.adminId, 'news.delete', 'news', id);
    res.writeHead(302, { Location: '/admin' }).end();
    return true;
  }

  return false;
}

function sendCsrfError(res) {
  res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Invalid CSRF token');
  return true;
}

// ---------------------------------------------------------------------
// server
// ---------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/public/')) {
      if (serveStatic(req, res, pathname)) return;
      res.writeHead(404).end('Not found');
      return;
    }

    if (pathname.startsWith('/admin')) {
      if (await handleAdmin(req, res, pathname, req.method)) return;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    if (await handlePublic(req, res, pathname, url.searchParams)) return;

    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<h1>404</h1><p>Страница не найдена. <a href="/">На главную</a></p>');
  } catch (err) {
    const status = err.status || 500;
    console.error(err);
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(
      status === 413 ? 'Payload too large' : 'Internal server error'
    );
  }
});

ensureBootstrapAdmin().then(() => {
  server.listen(PORT, () => {
    console.log(`BTEU CMS listening on http://localhost:${PORT}`);
  });
});

module.exports = server;

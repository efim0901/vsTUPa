'use strict';
// db.js — thin data-access layer.
// Uses node:sqlite (built into Node 22.5+) so the project runs with ZERO
// external dependencies. See README "Переход на PostgreSQL" for the
// production-scale swap — the query functions below are the only place
// that would need to change.

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'bteu.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const isNew = !fs.existsSync(DB_PATH);
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function runScript(file) {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8');
  db.exec(sql);
}

// Always apply schema (idempotent — CREATE TABLE IF NOT EXISTS).
runScript('schema.sql');

// Seed only on first run, and only if explicitly allowed (keeps prod DBs
// from being silently reseeded).
if (isNew && process.env.SEED_ON_INIT !== 'false') {
  runScript('seed.sql');
  console.log('[db] fresh database created and seeded ->', DB_PATH);
}

// ---- helpers -------------------------------------------------------

function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}
function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}
function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}

// ---- news ------------------------------------------------------------

function listPublishedNews({ category = null, limit = 20, offset = 0 } = {}) {
  if (category) {
    return all(
      `SELECT n.*, c.slug AS category_slug, c.title AS category_title
       FROM news n LEFT JOIN categories c ON c.id = n.category_id
       WHERE n.status = 'published' AND c.slug = @category
       ORDER BY n.published_at DESC LIMIT @limit OFFSET @offset`,
      { category, limit, offset }
    );
  }
  return all(
    `SELECT n.*, c.slug AS category_slug, c.title AS category_title
     FROM news n LEFT JOIN categories c ON c.id = n.category_id
     WHERE n.status = 'published'
     ORDER BY n.published_at DESC LIMIT @limit OFFSET @offset`,
    { limit, offset }
  );
}

function getNewsBySlug(slug) {
  return get(
    `SELECT n.*, c.slug AS category_slug, c.title AS category_title
     FROM news n LEFT JOIN categories c ON c.id = n.category_id
     WHERE n.slug = @slug`,
    { slug }
  );
}

function listAllNewsForAdmin() {
  return all(
    `SELECT n.*, c.title AS category_title FROM news n
     LEFT JOIN categories c ON c.id = n.category_id
     ORDER BY n.updated_at DESC`
  );
}

function getNewsById(id) {
  return get('SELECT * FROM news WHERE id = @id', { id });
}

function createNews(data) {
  const res = run(
    `INSERT INTO news (slug, title, excerpt, body, cover_image, category_id, status, published_at, author_id)
     VALUES (@slug, @title, @excerpt, @body, @cover_image, @category_id, @status, @published_at, @author_id)`,
    data
  );
  return res.lastInsertRowid;
}

function updateNews(id, data) {
  run(
    `UPDATE news SET slug=@slug, title=@title, excerpt=@excerpt, body=@body,
       cover_image=@cover_image, category_id=@category_id, status=@status,
       published_at=@published_at, updated_at=datetime('now')
     WHERE id=@id`,
    { ...data, id }
  );
}

function deleteNews(id) {
  run('DELETE FROM news WHERE id = @id', { id });
}

// ---- categories / events / programs ----------------------------------

function listCategories() {
  return all('SELECT * FROM categories ORDER BY title');
}

function listUpcomingEvents(limit = 6) {
  return all(
    `SELECT * FROM events WHERE event_date >= date('now') ORDER BY event_date ASC LIMIT @limit`,
    { limit }
  );
}

function listPrograms() {
  return all('SELECT * FROM programs ORDER BY sort_order');
}

// ---- admins / audit ----------------------------------------------------

function getAdminByUsername(username) {
  return get('SELECT * FROM admins WHERE username = @username', { username });
}

function createAdmin({ username, password_hash, salt, role = 'editor' }) {
  return run(
    'INSERT INTO admins (username, password_hash, salt, role) VALUES (@username, @password_hash, @salt, @role)',
    { username, password_hash, salt, role }
  ).lastInsertRowid;
}

function countAdmins() {
  return get('SELECT COUNT(*) AS n FROM admins').n;
}

function logAction(adminId, action, entity = null, entityId = null) {
  run(
    'INSERT INTO audit_log (admin_id, action, entity, entity_id) VALUES (@adminId, @action, @entity, @entityId)',
    { adminId, action, entity, entityId }
  );
}

module.exports = {
  db,
  listPublishedNews,
  getNewsBySlug,
  listAllNewsForAdmin,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
  listCategories,
  listUpcomingEvents,
  listPrograms,
  getAdminByUsername,
  createAdmin,
  countAdmins,
  logAction,
};

'use strict';
// db.js — thin data-access layer for PostgreSQL.

const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('[db] No DATABASE_URL provided. Cannot initialize DB.');
    return;
  }
  
  // Создаем таблицы
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);

  // Сидируем базу только если таблица категорий пуста
  if (process.env.SEED_ON_INIT !== 'false') {
    const { rows } = await pool.query('SELECT COUNT(*) AS n FROM categories');
    if (parseInt(rows[0].n, 10) === 0) {
      const seed = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');
      await pool.query(seed);
      console.log('[db] fresh database seeded with demo data');
    }
  }
}

// ---- news ------------------------------------------------------------

async function listPublishedNews({ category = null, limit = 20, offset = 0 } = {}) {
  if (category) {
    const { rows } = await pool.query(
      `SELECT n.*, c.slug AS category_slug, c.title AS category_title
       FROM news n LEFT JOIN categories c ON c.id = n.category_id
       WHERE n.status = 'published' AND c.slug = $1
       ORDER BY n.published_at DESC LIMIT $2 OFFSET $3`,
      [category, limit, offset]
    );
    return rows;
  }
  const { rows } = await pool.query(
    `SELECT n.*, c.slug AS category_slug, c.title AS category_title
     FROM news n LEFT JOIN categories c ON c.id = n.category_id
     WHERE n.status = 'published'
     ORDER BY n.published_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function getNewsBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT n.*, c.slug AS category_slug, c.title AS category_title
     FROM news n LEFT JOIN categories c ON c.id = n.category_id
     WHERE n.slug = $1`,
    [slug]
  );
  return rows[0];
}

async function listAllNewsForAdmin() {
  const { rows } = await pool.query(
    `SELECT n.*, c.title AS category_title FROM news n
     LEFT JOIN categories c ON c.id = n.category_id
     ORDER BY n.updated_at DESC`
  );
  return rows;
}

async function getNewsById(id) {
  const { rows } = await pool.query('SELECT * FROM news WHERE id = $1', [id]);
  return rows[0];
}

async function createNews(data) {
  const { rows } = await pool.query(
    `INSERT INTO news (slug, title, excerpt, body, cover_image, category_id, status, published_at, author_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [data.slug, data.title, data.excerpt, data.body, data.cover_image, data.category_id, data.status, data.published_at, data.author_id]
  );
  return rows[0].id;
}

async function updateNews(id, data) {
  await pool.query(
    `UPDATE news SET slug=$1, title=$2, excerpt=$3, body=$4,
       cover_image=$5, category_id=$6, status=$7,
       published_at=$8, updated_at=CURRENT_TIMESTAMP
     WHERE id=$9`,
    [data.slug, data.title, data.excerpt, data.body, data.cover_image, data.category_id, data.status, data.published_at, id]
  );
}

async function deleteNews(id) {
  await pool.query('DELETE FROM news WHERE id = $1', [id]);
}

// ---- categories / events / programs ----------------------------------

async function listCategories() {
  const { rows } = await pool.query('SELECT * FROM categories ORDER BY title');
  return rows;
}

async function listUpcomingEvents(limit = 6) {
  const { rows } = await pool.query(
    `SELECT * FROM events WHERE event_date >= CURRENT_DATE ORDER BY event_date ASC LIMIT $1`,
    [limit]
  );
  return rows;
}

async function listPrograms() {
  const { rows } = await pool.query('SELECT * FROM programs ORDER BY sort_order');
  return rows;
}

// ---- admins / audit ----------------------------------------------------

async function getAdminByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  return rows[0];
}

async function createAdmin({ username, password_hash, salt, role = 'editor' }) {
  const { rows } = await pool.query(
    'INSERT INTO admins (username, password_hash, salt, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [username, password_hash, salt, role]
  );
  return rows[0].id;
}

async function countAdmins() {
  const { rows } = await pool.query('SELECT COUNT(*) AS n FROM admins');
  return parseInt(rows[0].n, 10);
}

async function logAction(adminId, action, entity = null, entityId = null) {
  await pool.query(
    'INSERT INTO audit_log (admin_id, action, entity, entity_id) VALUES ($1, $2, $3, $4)',
    [adminId, action, entity, entityId]
  );
}

module.exports = {
  pool,
  initDb,
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

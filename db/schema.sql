CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'editor',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  slug  VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS news (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(255) UNIQUE NOT NULL,
  title         VARCHAR(255) NOT NULL,
  excerpt       TEXT,
  body          TEXT NOT NULL DEFAULT '',
  cover_image   TEXT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'draft',
  published_at  TIMESTAMP,
  author_id     INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_news_status_pub ON news(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category_id);

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

CREATE TABLE IF NOT EXISTS programs (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(255) NOT NULL,
  level      VARCHAR(100) NOT NULL DEFAULT 'бакалавриат',
  form       VARCHAR(100) NOT NULL DEFAULT 'очно',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS faculties (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(255) UNIQUE NOT NULL,
  title       VARCHAR(255) NOT NULL,
  profile     TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pages (
  id         SERIAL PRIMARY KEY,
  slug       VARCHAR(255) UNIQUE NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER REFERENCES admins(id) ON DELETE SET NULL,
  action     VARCHAR(255) NOT NULL,
  entity     VARCHAR(255),
  entity_id  INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

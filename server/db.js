/*
 * Capa de datos. SQLite (módulo integrado node:sqlite) en data/seniors.db.
 *
 * Modelo de publicación:
 *  - Las tablas `content` (secciones únicas) e `items` (colecciones) son la COPIA DE TRABAJO que edita el panel.
 *  - «Publicar cambios» guarda una instantánea completa de la copia de trabajo en `publications`.
 *  - La página pública SIEMPRE se construye desde la última publicación (solo elementos con estado «publicado»).
 *  - Restaurar una versión = copiar una instantánea anterior a la copia de trabajo.
 */
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'seniors.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','editor','gestor')),
  active INTEGER NOT NULL DEFAULT 1,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_login TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador','publicado','despublicado')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_collection ON items(collection, sort_order);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  thumb_url TEXT,
  name TEXT NOT NULL,
  original_name TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  mime TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  category TEXT NOT NULL DEFAULT 'General',
  alt TEXT,
  created_at TEXT NOT NULL,
  uploaded_by TEXT
);
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  service TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  preferred_time TEXT NOT NULL,
  message TEXT,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','revision','contactado','confirmado','cancelado')),
  notes TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status, created_at);
CREATE TABLE IF NOT EXISTS publications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  user_name TEXT
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  user_id INTEGER,
  user_name TEXT,
  entity TEXT NOT NULL,
  label TEXT NOT NULL,
  action TEXT NOT NULL,
  pub_state TEXT NOT NULL DEFAULT 'sin publicar'
);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at);
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

const now = () => new Date().toISOString();

function tx(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- Contenido (secciones únicas) ----------
function getContent(key) {
  const row = db.prepare('SELECT data FROM content WHERE key = ?').get(key);
  return row ? JSON.parse(row.data) : null;
}
function getAllContent() {
  const out = {};
  for (const r of db.prepare('SELECT key, data FROM content').all()) out[r.key] = JSON.parse(r.data);
  return out;
}
function setContent(key, data, userName) {
  db.prepare(`INSERT INTO content (key, data, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .run(key, JSON.stringify(data), now(), userName || null);
}

// ---------- Colecciones ----------
function rowToItem(r) {
  return { id: r.id, collection: r.collection, status: r.status, sort_order: r.sort_order, created_at: r.created_at, updated_at: r.updated_at, updated_by: r.updated_by, ...JSON.parse(r.data) };
}
function listItems(collection) {
  return db.prepare('SELECT * FROM items WHERE collection = ? ORDER BY sort_order, id').all(collection).map(rowToItem);
}
function allItems() {
  return db.prepare('SELECT * FROM items ORDER BY collection, sort_order, id').all().map(rowToItem);
}
function getItem(id) {
  const r = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  return r ? rowToItem(r) : null;
}
function createItem(collection, data, status, userName) {
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM items WHERE collection = ?').get(collection).m;
  const t = now();
  const res = db.prepare('INSERT INTO items (collection, data, status, sort_order, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(collection, JSON.stringify(data), status || 'borrador', max + 10, t, t, userName || null);
  return getItem(Number(res.lastInsertRowid));
}
function updateItem(id, data, status, userName) {
  db.prepare('UPDATE items SET data = ?, status = ?, updated_at = ?, updated_by = ? WHERE id = ?')
    .run(JSON.stringify(data), status, now(), userName || null, id);
  return getItem(id);
}
function setItemStatus(id, status, userName) {
  db.prepare('UPDATE items SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?').run(status, now(), userName || null, id);
}
function deleteItem(id) {
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
}
function reorderItems(collection, ids) {
  tx(() => {
    const st = db.prepare('UPDATE items SET sort_order = ? WHERE id = ? AND collection = ?');
    ids.forEach((id, i) => st.run((i + 1) * 10, id, collection));
  });
}

// ---------- Instantáneas y publicación ----------
function workingSnapshot() {
  const items = {};
  for (const it of allItems()) (items[it.collection] = items[it.collection] || []).push(it);
  return { content: getAllContent(), items };
}
function latestPublication() {
  const r = db.prepare('SELECT * FROM publications ORDER BY id DESC LIMIT 1').get();
  return r ? { id: r.id, created_at: r.created_at, user_name: r.user_name, note: r.note, snapshot: JSON.parse(r.snapshot) } : null;
}
function publish(userName, note) {
  const snap = workingSnapshot();
  const res = db.prepare('INSERT INTO publications (snapshot, note, created_at, user_name) VALUES (?, ?, ?, ?)')
    .run(JSON.stringify(snap), note || null, now(), userName || null);
  db.prepare("UPDATE activity SET pub_state = 'publicado' WHERE pub_state = 'sin publicar'").run();
  return Number(res.lastInsertRowid);
}
function restoreSnapshot(snapshot) {
  tx(() => {
    db.exec('DELETE FROM content; DELETE FROM items;');
    const c = db.prepare('INSERT INTO content (key, data, updated_at, updated_by) VALUES (?, ?, ?, ?)');
    for (const [k, v] of Object.entries(snapshot.content || {})) c.run(k, JSON.stringify(v), now(), 'restauración');
    const i = db.prepare('INSERT INTO items (id, collection, data, status, sort_order, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const list of Object.values(snapshot.items || {})) {
      for (const it of list) {
        const { id, collection, status, sort_order, created_at, updated_at, updated_by, ...data } = it;
        i.run(id, collection, JSON.stringify(data), status, sort_order, created_at || now(), now(), 'restauración');
      }
    }
  });
}

// ---------- Actividad ----------
function logActivity(user, entity, label, action, pubState) {
  db.prepare('INSERT INTO activity (at, user_id, user_name, entity, label, action, pub_state) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(now(), user ? user.id : null, user ? user.name : 'Sistema', entity, label, action, pubState || 'sin publicar');
}

function getMeta(key) {
  const r = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return r ? r.value : null;
}
function setMeta(key, value) {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

module.exports = {
  db, DB_FILE, DATA_DIR, now, tx,
  getContent, getAllContent, setContent,
  listItems, allItems, getItem, createItem, updateItem, setItemStatus, deleteItem, reorderItems,
  workingSnapshot, latestPublication, publish, restoreSnapshot,
  logActivity, getMeta, setMeta
};

/*
 * Servidor de la plataforma Seniors.
 *   /            Página pública (desde la última publicación)
 *   /admin       Panel administrativo (requiere sesión)
 *   /api/...     API pública (solicitudes de visita) y administrativa
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const D = require('./db');
const { seed } = require('./seed');
const { createAuth, hashPassword, passwordProblem } = require('./auth');
const { validateFields, cleanText } = require('./validate');
const { renderPage, renderPolicy, renderSitemap, PAGES, LEGACY } = require('./render');
const S = require('../shared/schema');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ADMIN_DIR = path.join(ROOT, 'admin');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const BACKUP_DIR = path.join(D.DATA_DIR, 'backups');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

seed();
migrateToPages();

/*
 * Migración (una sola vez): el sitio pasó de una sola página con #secciones a páginas independientes.
 * Convierte los enlaces #seccion guardados en rutas (/servicios, /contacto#agendar…) tanto en la copia
 * de trabajo como en la versión publicada, y agrega el contenido editable del resumen de Inicio.
 */
function migrateToPages() {
  if (D.getMeta('migr_pages_v1')) return;
  const fixJson = (json) => {
    let s = json;
    for (const [from, to] of Object.entries(LEGACY)) {
      s = s.split(`"${from}"`).join(`"${to}"`).split(`href=\\"${from}\\"`).join(`href=\\"${to}\\"`);
    }
    return s;
  };
  const HOME = { cta_title: '¿Quieres conocernos?', cta_text: 'Agenda una visita y recorre nuestras instalaciones. Será un gusto recibirte a ti y a tu familia.' };
  D.tx(() => {
    for (const r of D.db.prepare('SELECT key, data FROM content').all()) {
      const fixed = fixJson(r.data);
      if (fixed !== r.data) D.db.prepare('UPDATE content SET data = ? WHERE key = ?').run(fixed, r.key);
    }
    for (const r of D.db.prepare('SELECT id, data FROM items').all()) {
      const fixed = fixJson(r.data);
      if (fixed !== r.data) D.db.prepare('UPDATE items SET data = ? WHERE id = ?').run(fixed, r.id);
    }
    if (!D.getContent('home')) D.setContent('home', HOME, 'Sistema');
    // La versión publicada se ajusta igual para que el sitio en línea quede coherente.
    for (const r of D.db.prepare('SELECT id, snapshot FROM publications').all()) {
      const snap = JSON.parse(fixJson(r.snapshot));
      snap.content = snap.content || {};
      if (!snap.content.home) snap.content.home = HOME;
      D.db.prepare('UPDATE publications SET snapshot = ? WHERE id = ?').run(JSON.stringify(snap), r.id);
    }
    D.setMeta('migr_pages_v1', new Date().toISOString());
  });
}

const app = express();
const auth = createAuth(D);
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 'loopback');

// ---------------- Cabeceras de seguridad ----------------
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'"
].join('; ');
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Redirección a HTTPS en producción (detrás de un proxy que informa X-Forwarded-Proto)
  if (IS_PROD && process.env.FORCE_HTTPS !== '0' && req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, 'https://' + req.get('host') + req.originalUrl);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

// ---------------- Archivos estáticos ----------------
const staticOpts = IS_PROD ? { maxAge: '7d', index: false } : { index: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') };
app.use('/css', express.static(path.join(PUBLIC_DIR, 'css'), staticOpts));
app.use('/js', express.static(path.join(PUBLIC_DIR, 'js'), staticOpts));
app.use('/brand', express.static(path.join(PUBLIC_DIR, 'brand'), staticOpts));
app.use('/placeholders', express.static(path.join(PUBLIC_DIR, 'placeholders'), staticOpts));
app.use('/shared', express.static(path.join(ROOT, 'shared'), staticOpts));
app.use('/uploads', (req, res, next) => {
  // Los archivos subidos nunca se ejecutan como documentos (protege contra SVG maliciosos).
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox");
  next();
}, express.static(UPLOAD_DIR, { maxAge: IS_PROD ? '30d' : 0, index: false }));
app.use('/admin/assets', express.static(path.join(ADMIN_DIR, 'assets'), { index: false, setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

// ---------------- Página pública ----------------
const pageCache = new Map();
function liveSnapshot() {
  const p = D.latestPublication();
  return p ? p.snapshot : D.workingSnapshot();
}
function invalidate() { pageCache.clear(); }

// Cada opción del menú es una página independiente; Inicio muestra un resumen.
for (const [key, page] of Object.entries(PAGES)) {
  app.get(page.path, (req, res, next) => {
    if (!pageCache.has(key)) pageCache.set(key, renderPage(liveSnapshot(), key, {}));
    const html = pageCache.get(key);
    if (!html) return next(); // página desactivada → 404
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  });
}
app.get('/politica-de-privacidad', (req, res) => res.type('html').send(renderPolicy(liveSnapshot(), 'privacy')));
app.get('/tratamiento-de-datos', (req, res) => res.type('html').send(renderPolicy(liveSnapshot(), 'data')));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(renderSitemap(liveSnapshot())));
app.get('/robots.txt', (req, res) => {
  const seo = (liveSnapshot().content || {}).seo || {};
  const base = String(seo.site_url || '').replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /preview\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ''}`);
});
app.get('/favicon.ico', (req, res) => {
  const b = (liveSnapshot().content || {}).brand || {};
  res.redirect(302, b.favicon || '/brand/favicon-64.png');
});

// ---------------- Solicitudes de visita (público) ----------------
const visitHits = new Map();
function bogotaToday() { return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); }

app.post('/api/visitas', express.json({ limit: '20kb' }), (req, res) => {
  const ip = req.ip;
  const hits = (visitHits.get(ip) || []).filter((t) => t > Date.now() - 10 * 60e3);
  if (hits.length >= 5) return res.status(429).json({ error: 'Has enviado varias solicitudes en poco tiempo. Inténtalo de nuevo en unos minutos.' });

  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // trampa para bots
  const snap = liveSnapshot();
  const services = (snap.items.services || []).filter((x) => x.status === 'publicado').map((x) => x.title).concat('Otro / Quiero más información');
  const slots = String(((snap.content || {}).booking || {}).time_slots || '').split('\n').map((s) => s.trim()).filter(Boolean);

  const v = {
    name: cleanText(b.name).slice(0, 120), phone: cleanText(b.phone).slice(0, 30), email: cleanText(b.email).toLowerCase().slice(0, 160),
    service: cleanText(b.service), date: cleanText(b.date), time: cleanText(b.time), message: cleanText(b.message).slice(0, 1000),
    consent: b.consent === true || b.consent === 'on' || b.consent === 'true'
  };
  const errors = {};
  if (v.name.length < 3) errors.name = 'Ingresa tu nombre completo.';
  if (!/^\+?[\d\s()-]{7,20}$/.test(v.phone) || v.phone.replace(/\D/g, '').length < 7) errors.phone = 'Ingresa un número de teléfono válido.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email)) errors.email = 'Ingresa un correo electrónico válido.';
  if (!services.includes(v.service)) errors.service = 'Selecciona un servicio.';
  const today = bogotaToday();
  const maxDate = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || isNaN(new Date(v.date))) errors.date = 'Selecciona una fecha.';
  else if (v.date < today) errors.date = 'La fecha no puede ser anterior a hoy.';
  else if (v.date > maxDate) errors.date = 'Selecciona una fecha dentro del próximo año.';
  if (!slots.includes(v.time)) errors.time = 'Selecciona un horario.';
  if (!v.consent) errors.consent = 'Debes aceptar la política de tratamiento de datos.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revisa los campos marcados.', errors });

  hits.push(Date.now());
  visitHits.set(ip, hits);
  const t = D.now();
  D.db.prepare(`INSERT INTO requests (name, phone, email, service, preferred_date, preferred_time, message, consent_at, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', '[]', ?, ?)`).run(v.name, v.phone, v.email, v.service, v.date, v.time, v.message, t, t, t);
  res.status(201).json({ ok: true });
});

// ---------------- Autenticación ----------------
app.post('/api/auth/login', auth.login);
app.post('/api/auth/forgot', auth.requestReset);
app.post('/api/auth/reset', auth.doReset);
app.post('/api/auth/logout', (req, res) => {
  const s = auth.loadSession(req);
  if (s) D.logActivity(s.user, 'sesión', s.user.email, 'Cierre de sesión', '—');
  auth.destroySession(req, res);
  res.json({ ok: true });
});

// Páginas del panel
const sendAdmin = (file) => (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(path.join(ADMIN_DIR, file)); };
app.get('/admin/login', (req, res, next) => (auth.loadSession(req) ? res.redirect('/admin') : next()), sendAdmin('login.html'));
app.get('/admin/restablecer', sendAdmin('login.html'));
app.get(['/admin', '/admin/*'], auth.requireAuth, sendAdmin('index.html'));

// Vista previa (copia de trabajo + cambios sin guardar opcionales)
const previews = new Map();
app.get('/preview', auth.requireAuth, (req, res) => {
  if (!req.user.perms.some((p) => ['content', 'links', 'brand', 'settings'].includes(p))) return res.status(403).send('Sin permisos');
  const snap = D.workingSnapshot();
  const ov = req.query.o && previews.get(String(req.query.o));
  if (ov && ov.userId === req.user.id) applyOverlay(snap, ov.data);
  const page = String(req.query.page || '');
  res.setHeader('Cache-Control', 'no-store');
  const popts = { preview: true, overlay: ov ? String(req.query.o) : '', previewLabel: ov ? 'Incluye cambios que aún no has guardado.' : 'Así se verá el sitio cuando publiques los cambios guardados.' };
  if (page === 'privacy' || page === 'data') return res.type('html').send(renderPolicy(snap, page, popts));
  const html = renderPage(snap, PAGES[page] ? page : 'inicio', popts);
  if (!html) {
    return res.type('html').send(renderPage(snap, 'inicio', { ...popts, previewLabel: 'Esta página está desactivada, por eso se muestra el Inicio. Actívala en «Página principal».' }));
  }
  res.type('html').send(html);
});
function applyOverlay(snap, data) {
  if (!data) return;
  for (const [k, v] of Object.entries(data.content || {})) {
    if (k === '__proto__' || k === 'constructor') continue;
    snap.content[k] = v;
  }
  for (const it of data.items || []) {
    if (!S.COLLECTIONS[it.collection]) continue;
    const list = (snap.items[it.collection] = snap.items[it.collection] || []);
    const idx = list.findIndex((x) => x.id === it.id);
    const merged = { ...(idx >= 0 ? list[idx] : { id: -1, sort_order: 99999, collection: it.collection }), ...it.data, status: it.status || 'publicado' };
    if (idx >= 0) list[idx] = merged; else list.push(merged);
  }
}

// ---------------- API administrativa ----------------
const api = express.Router();
api.use(auth.requireAuth);
const perm = auth.requirePerm;

api.get('/me', (req, res) => res.json({ user: req.user, csrf: req.csrf, roles: S.ROLES }));

api.post('/me/password', (req, res) => {
  const { current, password } = req.body || {};
  const u = D.db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!require('./auth').verifyPassword(String(current || ''), u.password_hash)) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });
  D.db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?').run(hashPassword(password), u.id);
  D.logActivity(req.user, 'usuarios', u.email, 'Cambió su contraseña', '—');
  res.json({ ok: true });
});

// ---- Panel de control ----
api.get('/dashboard', (req, res) => {
  const live = liveSnapshot();
  const pubCount = (col) => (live.items[col] || []).filter((i) => i.status === 'publicado').length;
  const lastPub = D.latestPublication();
  const lastEdit = D.db.prepare("SELECT MAX(at) AS m FROM activity WHERE entity NOT IN ('sesión')").get().m;
  res.json({
    stats: {
      services: pubCount('services'), experiences: pubCount('experiences'), testimonials: pubCount('testimonials'),
      images: D.db.prepare("SELECT COUNT(*) AS n FROM media WHERE kind = 'image'").get().n,
      videos: D.db.prepare("SELECT COUNT(*) AS n FROM media WHERE kind = 'video'").get().n,
      pending: D.db.prepare("SELECT COUNT(*) AS n FROM requests WHERE status = 'pendiente'").get().n,
      faqs: pubCount('faqs'), facilities: pubCount('facilities')
    },
    last_publication: lastPub ? { at: lastPub.created_at, by: lastPub.user_name } : null,
    last_edit: lastEdit,
    pending_changes: hasPendingChanges(),
    activity: D.db.prepare("SELECT * FROM activity WHERE entity NOT IN ('sesión') ORDER BY id DESC LIMIT 10").all(),
    unvalidated: countUnvalidated()
  });
});
function countUnvalidated() {
  const w = D.workingSnapshot();
  const n = (col, f) => (w.items[col] || []).filter((i) => i.status === 'publicado' && !i[f]).length;
  return { benefits: n('benefits', 'validated'), faqs: n('faqs', 'validated'), testimonials_example: (w.items.testimonials || []).filter((i) => i.status === 'publicado' && i.example).length };
}

// ---- Estado de publicación ----
function normalize(snap) {
  const items = {};
  for (const [col, list] of Object.entries(snap.items || {})) {
    items[col] = list.map(({ updated_at, updated_by, created_at, ...rest }) => rest).sort((a, b) => a.id - b.id);
  }
  const content = {};
  for (const k of Object.keys(snap.content || {}).sort()) content[k] = snap.content[k];
  return JSON.stringify({ content, items: Object.keys(items).sort().reduce((o, k) => ((o[k] = items[k]), o), {}) });
}
function hasPendingChanges() {
  const p = D.latestPublication();
  if (!p) return true;
  return normalize(D.workingSnapshot()) !== normalize(p.snapshot);
}

function diffSummary() {
  const p = D.latestPublication();
  const w = D.workingSnapshot();
  const out = [];
  if (!p) return out;
  const sectionLabel = (k) => (S.SECTIONS[k] || S.SETTINGS[k] || { label: k === 'layout' ? 'Secciones visibles' : k }).label;
  for (const k of new Set([...Object.keys(w.content), ...Object.keys(p.snapshot.content)])) {
    if (JSON.stringify(w.content[k]) !== JSON.stringify(p.snapshot.content[k])) out.push({ type: 'Sección', label: sectionLabel(k), change: 'modificada' });
  }
  for (const col of Object.keys(S.COLLECTIONS)) {
    const def = S.COLLECTIONS[col];
    const a = new Map((p.snapshot.items[col] || []).map((i) => [i.id, i]));
    const b = new Map((w.items[col] || []).map((i) => [i.id, i]));
    const strip = ({ updated_at, updated_by, created_at, ...r }) => JSON.stringify(r);
    for (const [id, it] of b) {
      if (!a.has(id)) out.push({ type: def.label, label: it[def.titleField] || '#' + id, change: 'nuevo' });
      else if (strip(a.get(id)) !== strip(it)) out.push({ type: def.label, label: it[def.titleField] || '#' + id, change: a.get(id).status !== it.status ? `estado: ${S.STATUS[it.status]}` : 'modificado' });
    }
    for (const [id, it] of a) if (!b.has(id)) out.push({ type: def.label, label: it[def.titleField] || '#' + id, change: 'eliminado' });
  }
  return out;
}

api.get('/publish/status', (req, res) => {
  const p = D.latestPublication();
  res.json({ pending: hasPendingChanges(), changes: diffSummary(), last: p ? { id: p.id, at: p.created_at, by: p.user_name } : null });
});

function validateWorking() {
  const w = D.workingSnapshot();
  const problems = [];
  const options = selectOptions(w);
  for (const [k, def] of Object.entries({ ...S.SECTIONS, ...S.SETTINGS })) {
    const { errors } = validateFields(def.fields, w.content[k] || {}, { options });
    for (const [f, msg] of Object.entries(errors)) problems.push(`${def.label} → ${labelOf(def.fields, f)}: ${msg}`);
  }
  for (const [col, def] of Object.entries(S.COLLECTIONS)) {
    for (const it of (w.items[col] || []).filter((i) => i.status === 'publicado')) {
      const { errors } = validateFields(def.fields, it, { options });
      for (const [f, msg] of Object.entries(errors)) problems.push(`${def.label} → «${it[def.titleField] || '#' + it.id}» → ${labelOf(def.fields, f)}: ${msg}`);
    }
  }
  return problems;
}
const labelOf = (fields, name) => (fields.find((f) => f.name === name) || { label: name }).label;
function selectOptions(w) {
  const snap = w || D.workingSnapshot();
  return {
    facility_categories: (snap.items.facility_categories || []).map((c) => c.name),
    experience_categories: (snap.items.experience_categories || []).map((c) => c.name)
  };
}

api.post('/publish', perm('publish'), (req, res) => {
  const problems = validateWorking();
  if (problems.length) return res.status(422).json({ error: 'Hay contenidos que deben corregirse antes de publicar.', problems });
  const changes = diffSummary();
  const id = D.publish(req.user.name, cleanText((req.body || {}).note).slice(0, 200) || null);
  invalidate();
  D.logActivity(req.user, 'publicación', 'Versión #' + id, `Se publicaron los cambios (${changes.length} elemento${changes.length === 1 ? '' : 's'})`, 'publicado');
  res.json({ ok: true, id });
});

// ---- Historial ----
api.get('/history', perm('history'), (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const q = cleanText(req.query.q || '');
  const where = q ? "WHERE (label LIKE ? OR action LIKE ? OR user_name LIKE ? OR entity LIKE ?)" : '';
  const args = q ? Array(4).fill('%' + q + '%') : [];
  const total = D.db.prepare(`SELECT COUNT(*) AS n FROM activity ${where}`).get(...args).n;
  const rows = D.db.prepare(`SELECT * FROM activity ${where} ORDER BY id DESC LIMIT 25 OFFSET ?`).all(...args, (page - 1) * 25);
  res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / 25)) });
});
api.get('/publications', perm('history'), (req, res) => {
  res.json(D.db.prepare('SELECT id, created_at, user_name, note FROM publications ORDER BY id DESC LIMIT 50').all());
});
api.post('/publications/:id/restore', perm('publish'), (req, res) => {
  const r = D.db.prepare('SELECT * FROM publications WHERE id = ?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Versión no encontrada.' });
  D.restoreSnapshot(JSON.parse(r.snapshot));
  D.logActivity(req.user, 'historial', 'Versión #' + r.id, 'Se restauró una versión anterior en la copia de trabajo');
  res.json({ ok: true });
});

// ---- Contenido de secciones únicas ----
function contentDef(key) {
  if (S.SECTIONS[key]) return S.SECTIONS[key];
  if (S.SETTINGS[key]) return S.SETTINGS[key];
  return null;
}
api.get('/content', (req, res) => {
  const all = D.getAllContent();
  const out = {};
  for (const [k, v] of Object.entries(all)) {
    const def = contentDef(k);
    const p = def ? def.permission : 'content';
    if (req.user.perms.includes(p) || req.user.perms.includes('content')) out[k] = v;
  }
  res.json(out);
});
api.put('/content/:key', (req, res) => {
  const key = req.params.key;
  if (key === 'layout') {
    if (!req.user.perms.includes('content')) return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
    const allowed = Object.entries(S.SECTIONS).filter(([, d]) => d.toggle).map(([k]) => k);
    const hidden = Array.isArray(req.body.hidden) ? req.body.hidden.filter((k) => allowed.includes(k)) : [];
    D.setContent('layout', { hidden }, req.user.name);
    D.logActivity(req.user, 'página principal', 'Secciones visibles', 'Se actualizó la visibilidad de las secciones');
    return res.json({ ok: true, data: { hidden } });
  }
  const def = contentDef(key);
  if (!def) return res.status(404).json({ error: 'Sección no encontrada.' });
  if (!req.user.perms.includes(def.permission)) return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
  const { data, errors } = validateFields(def.fields, req.body || {}, { options: selectOptions() });
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revisa los campos marcados.', errors });
  const prev = D.getContent(key) || {};
  D.setContent(key, { ...prev, ...data }, req.user.name);
  D.logActivity(req.user, def.label, def.label, 'Se modificó el contenido de la sección');
  res.json({ ok: true, data: { ...prev, ...data } });
});

// ---- Colecciones ----
function colDef(req, res) {
  const def = S.COLLECTIONS[req.params.collection];
  if (!def) { res.status(404).json({ error: 'Colección no encontrada.' }); return null; }
  if (!req.user.perms.includes(def.permission)) { res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' }); return null; }
  return def;
}
const VALID_STATUS = Object.keys(S.STATUS);

api.get('/items/:collection', (req, res) => {
  const def = colDef(req, res); if (!def) return;
  res.json(D.listItems(req.params.collection));
});
api.post('/items/:collection', (req, res) => {
  const def = colDef(req, res); if (!def) return;
  const col = req.params.collection;
  const body = req.body || {};
  const status = VALID_STATUS.includes(body.status) ? body.status : 'borrador';
  const { data, errors } = validateFields(def.fields, body.data || {}, { options: selectOptions() });
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revisa los campos marcados.', errors });
  if (col === 'links') data.key = 'custom_' + crypto.randomBytes(4).toString('hex');
  if (col.endsWith('_categories') && D.listItems(col).some((c) => c.name.toLowerCase() === data.name.toLowerCase())) return res.status(400).json({ error: 'Ya existe una categoría con ese nombre.', errors: { name: 'Nombre repetido.' } });
  const it = D.createItem(col, data, status, req.user.name);
  D.logActivity(req.user, def.label, data[def.titleField] || '', `Se agregó ${def.singular === 'fotografía' || def.singular === 'publicación' || def.singular === 'pregunta' || def.singular === 'categoría' ? 'una' : 'un'} ${def.singular} (${S.STATUS[status].toLowerCase()})`);
  res.status(201).json(it);
});
api.put('/items/:collection/:id', (req, res) => {
  const def = colDef(req, res); if (!def) return;
  const col = req.params.collection;
  const cur = D.getItem(Number(req.params.id));
  if (!cur || cur.collection !== col) return res.status(404).json({ error: 'Elemento no encontrado.' });
  const body = req.body || {};
  const status = VALID_STATUS.includes(body.status) ? body.status : cur.status;
  const { data, errors } = validateFields(def.fields, body.data || {}, { options: selectOptions() });
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revisa los campos marcados.', errors });
  if (col === 'links') data.key = cur.key; // el identificador interno no se modifica
  if (col.endsWith('_categories') && cur.name !== data.name) {
    // Renombrar categoría: actualizar elementos que la usan
    const target = col === 'facility_categories' ? 'facilities' : 'experiences';
    if (D.listItems(col).some((c) => c.id !== cur.id && c.name.toLowerCase() === data.name.toLowerCase())) return res.status(400).json({ error: 'Ya existe una categoría con ese nombre.', errors: { name: 'Nombre repetido.' } });
    for (const it of D.listItems(target).filter((x) => x.category === cur.name)) {
      const { id, collection, status: st, sort_order, created_at, updated_at, updated_by, ...d } = it;
      D.updateItem(id, { ...d, category: data.name }, st, req.user.name);
    }
  }
  const it = D.updateItem(cur.id, data, status, req.user.name);
  D.logActivity(req.user, def.label, data[def.titleField] || '', status !== cur.status ? `Se actualizó y cambió el estado a «${S.STATUS[status]}»` : `Se actualizó ${def.singular === 'fotografía' || def.singular === 'publicación' || def.singular === 'pregunta' || def.singular === 'categoría' ? 'la' : 'el'} ${def.singular}`);
  res.json(it);
});
api.patch('/items/:collection/:id/status', (req, res) => {
  const def = colDef(req, res); if (!def) return;
  const cur = D.getItem(Number(req.params.id));
  if (!cur || cur.collection !== req.params.collection) return res.status(404).json({ error: 'Elemento no encontrado.' });
  const status = (req.body || {}).status;
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Estado no válido.' });
  if (status === 'publicado') {
    const { errors } = validateFields(def.fields, cur, { options: selectOptions() });
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Completa los campos obligatorios antes de publicar este elemento.', errors });
  }
  D.setItemStatus(cur.id, status, req.user.name);
  D.logActivity(req.user, def.label, cur[def.titleField] || '', `Estado cambiado a «${S.STATUS[status]}»`);
  res.json({ ok: true });
});
api.delete('/items/:collection/:id', (req, res) => {
  const def = colDef(req, res); if (!def) return;
  const col = req.params.collection;
  const cur = D.getItem(Number(req.params.id));
  if (!cur || cur.collection !== col) return res.status(404).json({ error: 'Elemento no encontrado.' });
  if (col === 'links' && !cur.key.startsWith('custom_')) return res.status(400).json({ error: 'Este enlace lo usa la estructura del sitio y no se puede eliminar. Puedes desactivarlo (Despublicado) para ocultarlo.' });
  if (col.endsWith('_categories')) {
    const target = col === 'facility_categories' ? 'facilities' : 'experiences';
    const n = D.listItems(target).filter((x) => x.category === cur.name).length;
    if (n) return res.status(409).json({ error: `La categoría tiene ${n} elemento(s) asociados. Muévelos a otra categoría antes de eliminarla.` });
  }
  D.deleteItem(cur.id);
  D.logActivity(req.user, def.label, cur[def.titleField] || '', `Se eliminó ${def.singular === 'fotografía' || def.singular === 'publicación' || def.singular === 'pregunta' || def.singular === 'categoría' ? 'la' : 'el'} ${def.singular}`);
  res.json({ ok: true });
});
api.post('/items/:collection/reorder', (req, res) => {
  const def = colDef(req, res); if (!def) return;
  const ids = Array.isArray((req.body || {}).ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  D.reorderItems(req.params.collection, ids);
  D.logActivity(req.user, def.label, def.label, 'Se cambió el orden de presentación');
  res.json({ ok: true });
});

// ---- Vista previa con cambios sin guardar ----
api.post('/preview', (req, res) => {
  const id = crypto.randomBytes(12).toString('base64url');
  const body = req.body || {};
  const data = { content: {}, items: [] };
  for (const [k, v] of Object.entries(body.content || {})) {
    const def = contentDef(k);
    if (k === 'layout') { data.content.layout = { hidden: Array.isArray(v.hidden) ? v.hidden.map(String) : [] }; continue; }
    if (!def) continue;
    data.content[k] = { ...(D.getContent(k) || {}), ...validateFields(def.fields, v, { options: selectOptions() }).data };
  }
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 20) : []) {
    const def = S.COLLECTIONS[it.collection];
    if (!def) continue;
    data.items.push({ collection: it.collection, id: Number(it.id) || -1, status: VALID_STATUS.includes(it.status) ? it.status : 'publicado', data: validateFields(def.fields, it.data || {}, { options: selectOptions() }).data });
  }
  previews.set(id, { data, userId: req.user.id, exp: Date.now() + 30 * 60e3 });
  for (const [k, v] of previews) if (v.exp < Date.now()) previews.delete(k);
  res.json({ id, url: '/preview?o=' + id });
});

// ---- Biblioteca multimedia ----
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 10 } });
const IMG_MAX = 10 * 1024 * 1024;

function sniff(buf) {
  const h = buf.subarray(0, 16);
  if (h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff) return { kind: 'image', mime: 'image/jpeg' };
  if (h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: 'image', mime: 'image/png' };
  if (h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (h.toString('ascii', 0, 3) === 'GIF') return { kind: 'image', mime: 'image/gif' };
  if (h.toString('ascii', 4, 8) === 'ftyp') {
    const brand = h.toString('ascii', 8, 12);
    if (/^(avif|avis)/.test(brand)) return { kind: 'image', mime: 'image/avif' };
    return { kind: 'video', mime: 'video/mp4' };
  }
  if (h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return { kind: 'video', mime: 'video/webm' };
  const text = buf.subarray(0, 2048).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) return { kind: 'image', mime: 'image/svg+xml' };
  return null;
}
function svgIsSafe(buf) {
  const s = buf.toString('utf8');
  return !/<script|<foreignObject|<iframe|<embed|<object|<!ENTITY|\son[a-z]+\s*=|javascript:|data:text\/html/i.test(s) &&
    !/(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/)/i.test(s);
}
function uploadName(ext) {
  const d = new Date();
  const dir = path.join(UPLOAD_DIR, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });
  const base = crypto.randomBytes(8).toString('hex');
  return { dir, base, rel: `/uploads/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/` };
}

async function storeFile(file) {
  const kind = sniff(file.buffer);
  if (!kind) throw new Error(`«${file.originalname}»: formato no permitido. Usa JPG, PNG, WebP, SVG, MP4 o WebM.`);
  if (kind.kind === 'image' && file.size > IMG_MAX) throw new Error(`«${file.originalname}»: la imagen supera el tamaño máximo de 10 MB.`);
  const { dir, base, rel } = uploadName();
  if (kind.mime === 'image/svg+xml') {
    if (!svgIsSafe(file.buffer)) throw new Error(`«${file.originalname}»: el SVG contiene elementos no permitidos (scripts o enlaces externos).`);
    fs.writeFileSync(path.join(dir, base + '.svg'), file.buffer);
    return { url: rel + base + '.svg', thumb_url: rel + base + '.svg', kind: 'image', mime: kind.mime, size: file.size, width: null, height: null };
  }
  if (kind.kind === 'video') {
    const ext = kind.mime === 'video/webm' ? '.webm' : '.mp4';
    fs.writeFileSync(path.join(dir, base + ext), file.buffer);
    return { url: rel + base + ext, thumb_url: null, kind: 'video', mime: kind.mime, size: file.size, width: null, height: null };
  }
  // Imágenes rasterizadas: se optimizan a WebP (máx. 2400 px) y se genera miniatura.
  const img = sharp(file.buffer, { limitInputPixels: 80e6, animated: false }).rotate();
  const meta = await img.metadata();
  const out = await img.clone().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  fs.writeFileSync(path.join(dir, base + '.webp'), out.data);
  const th = await sharp(out.data).resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  fs.writeFileSync(path.join(dir, base + '-thumb.webp'), th);
  return { url: rel + base + '.webp', thumb_url: rel + base + '-thumb.webp', kind: 'image', mime: 'image/webp', size: out.data.length, width: out.info.width, height: out.info.height, original_mime: meta.format };
}

function mediaUsage(url) {
  const where = [];
  const scan = (snap, scope) => {
    for (const [k, v] of Object.entries(snap.content || {})) {
      if (JSON.stringify(v).includes(JSON.stringify(url).slice(1, -1))) where.push({ scope, place: (contentDef(k) || { label: k }).label });
    }
    for (const [col, list] of Object.entries(snap.items || {})) {
      for (const it of list) {
        if (JSON.stringify(it).includes(url)) where.push({ scope, place: `${(S.COLLECTIONS[col] || { label: col }).label}: ${it[(S.COLLECTIONS[col] || {}).titleField] || '#' + it.id}` });
      }
    }
  };
  scan(D.workingSnapshot(), 'borrador');
  const p = D.latestPublication();
  if (p) scan(p.snapshot, 'publicado');
  return where;
}

api.get('/media', perm('media'), (req, res) => {
  const q = cleanText(req.query.q || '');
  const cat = cleanText(req.query.category || '');
  const kind = cleanText(req.query.kind || '');
  const cond = [], args = [];
  if (q) { cond.push('(name LIKE ? OR original_name LIKE ?)'); args.push('%' + q + '%', '%' + q + '%'); }
  if (cat) { cond.push('category = ?'); args.push(cat); }
  if (kind === 'image' || kind === 'video') { cond.push('kind = ?'); args.push(kind); }
  const rows = D.db.prepare(`SELECT * FROM media ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''} ORDER BY id DESC`).all(...args);
  res.json(rows);
});
// Acceso de solo lectura a la biblioteca para quien edita marca/configuración (selector de imágenes)
api.get('/media-picker', (req, res) => {
  if (!req.user.perms.some((p) => ['media', 'brand', 'settings', 'content'].includes(p))) return res.status(403).json({ error: 'Sin permisos.' });
  res.json(D.db.prepare('SELECT id, url, thumb_url, name, kind, category, width, height FROM media ORDER BY id DESC').all());
});
api.get('/media/:id/usage', perm('media'), (req, res) => {
  const m = D.db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Archivo no encontrado.' });
  res.json(mediaUsage(m.url));
});

function uploadMiddleware(req, res, next) {
  upload.array('files', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido (60 MB para videos, 10 MB para imágenes).' : 'No se pudo procesar la carga de archivos.' });
    next();
  });
}
const canUpload = (req, res, next) => (req.user.perms.some((p) => ['media', 'brand'].includes(p)) ? next() : res.status(403).json({ error: 'No tienes permisos para subir archivos.' }));

api.post('/media', canUpload, uploadMiddleware, async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'Selecciona al menos un archivo.' });
  const category = S.MEDIA_CATEGORIES.includes(req.body.category) ? req.body.category : 'General';
  const created = [], errors = [];
  for (const f of files) {
    try {
      const st = await storeFile(f);
      const name = cleanText(req.body.name && files.length === 1 ? req.body.name : f.originalname.replace(/\.[^.]+$/, '')).slice(0, 120) || 'Archivo';
      const r = D.db.prepare('INSERT INTO media (url, thumb_url, name, original_name, kind, mime, size, width, height, category, alt, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(st.url, st.thumb_url, name, cleanText(f.originalname).slice(0, 200), st.kind, st.mime, st.size, st.width, st.height, category, name, D.now(), req.user.name);
      created.push(D.db.prepare('SELECT * FROM media WHERE id = ?').get(Number(r.lastInsertRowid)));
      D.logActivity(req.user, 'Multimedia', name, st.kind === 'video' ? 'Se cargó un video' : 'Se agregó una nueva fotografía', '—');
    } catch (e) { errors.push(e.message || 'Error al procesar el archivo.'); }
  }
  res.status(created.length ? 201 : 400).json({ created, errors, error: created.length ? undefined : errors[0] });
});

api.put('/media/:id', perm('media'), (req, res) => {
  const m = D.db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Archivo no encontrado.' });
  const name = cleanText((req.body || {}).name).slice(0, 120);
  const alt = cleanText((req.body || {}).alt).slice(0, 200);
  const category = S.MEDIA_CATEGORIES.includes((req.body || {}).category) ? req.body.category : m.category;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio.', errors: { name: 'Obligatorio.' } });
  D.db.prepare('UPDATE media SET name = ?, alt = ?, category = ? WHERE id = ?').run(name, alt, category, m.id);
  D.logActivity(req.user, 'Multimedia', name, 'Se actualizaron los datos del archivo', '—');
  res.json(D.db.prepare('SELECT * FROM media WHERE id = ?').get(m.id));
});

// Reemplazar: se sube el archivo nuevo y se actualizan todas las referencias en la copia de trabajo.
api.post('/media/:id/replace', perm('media'), uploadMiddleware, async (req, res) => {
  const m = D.db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Archivo no encontrado.' });
  const f = (req.files || [])[0];
  if (!f) return res.status(400).json({ error: 'Selecciona un archivo.' });
  let st;
  try { st = await storeFile(f); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (st.kind !== m.kind) return res.status(400).json({ error: m.kind === 'image' ? 'Debes reemplazar la imagen por otra imagen.' : 'Debes reemplazar el video por otro video.' });
  const oldUrl = m.url;
  D.tx(() => {
    D.db.prepare('UPDATE media SET url = ?, thumb_url = ?, mime = ?, size = ?, width = ?, height = ?, original_name = ?, created_at = ?, uploaded_by = ? WHERE id = ?')
      .run(st.url, st.thumb_url, st.mime, st.size, st.width, st.height, cleanText(f.originalname).slice(0, 200), D.now(), req.user.name, m.id);
    for (const [k, v] of Object.entries(D.getAllContent())) {
      const s = JSON.stringify(v);
      if (s.includes(oldUrl)) D.setContent(k, JSON.parse(s.split(oldUrl).join(st.url)), req.user.name);
    }
    for (const it of D.allItems()) {
      const { id, collection, status, sort_order, created_at, updated_at, updated_by, ...data } = it;
      const s = JSON.stringify(data);
      if (s.includes(oldUrl)) D.updateItem(id, JSON.parse(s.split(oldUrl).join(st.url)), status, req.user.name);
    }
  });
  D.logActivity(req.user, 'Multimedia', m.name, 'Se reemplazó la imagen (actualizada en todas las secciones que la usan)');
  res.json(D.db.prepare('SELECT * FROM media WHERE id = ?').get(m.id));
});

api.delete('/media/:id', perm('media'), (req, res) => {
  const m = D.db.prepare('SELECT * FROM media WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: 'Archivo no encontrado.' });
  const usage = mediaUsage(m.url);
  if (usage.length && req.query.force !== '1') return res.status(409).json({ error: 'El archivo se está usando en el sitio.', usage });
  D.db.prepare('DELETE FROM media WHERE id = ?').run(m.id);
  if (m.url.startsWith('/uploads/') && !usage.some((u) => u.scope === 'publicado')) {
    for (const u of [m.url, m.thumb_url]) {
      if (!u || !u.startsWith('/uploads/')) continue;
      const p = path.join(ROOT, u);
      if (p.startsWith(UPLOAD_DIR)) fs.rm(p, { force: true }, () => {});
    }
  }
  D.logActivity(req.user, 'Multimedia', m.name, 'Se eliminó el archivo', '—');
  res.json({ ok: true });
});

// ---- Solicitudes de visita ----
function requestRow(r) { return { ...r, notes: JSON.parse(r.notes || '[]') }; }
function requestQuery(req) {
  const cond = [], args = [];
  const q = cleanText(req.query.q || '');
  if (q) { cond.push('(name LIKE ? OR email LIKE ? OR phone LIKE ? OR service LIKE ?)'); args.push(...Array(4).fill('%' + q + '%')); }
  if (S.REQUEST_STATUS[req.query.status]) { cond.push('status = ?'); args.push(req.query.status); }
  const field = req.query.by === 'visit' ? 'preferred_date' : 'substr(created_at,1,10)';
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) { cond.push(`${field} >= ?`); args.push(req.query.from); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) { cond.push(`${field} <= ?`); args.push(req.query.to); }
  return { where: cond.length ? 'WHERE ' + cond.join(' AND ') : '', args };
}
api.get('/requests', perm('requests'), (req, res) => {
  const { where, args } = requestQuery(req);
  const rows = D.db.prepare(`SELECT * FROM requests ${where} ORDER BY created_at DESC LIMIT 500`).all(...args).map(requestRow);
  const counts = {};
  for (const r of D.db.prepare('SELECT status, COUNT(*) AS n FROM requests GROUP BY status').all()) counts[r.status] = r.n;
  res.json({ rows, counts });
});
api.get('/requests.csv', perm('requests'), (req, res) => {
  const { where, args } = requestQuery(req);
  const rows = D.db.prepare(`SELECT * FROM requests ${where} ORDER BY created_at DESC`).all(...args);
  const csvCell = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita inyección de fórmulas en hojas de cálculo
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const head = ['ID', 'Nombre', 'Teléfono', 'Correo', 'Servicio', 'Fecha solicitada', 'Horario', 'Mensaje', 'Recibida', 'Estado'];
  const body = rows.map((r) => [r.id, r.name, r.phone, r.email, r.service, r.preferred_date, r.preferred_time, r.message, r.created_at, S.REQUEST_STATUS[r.status]].map(csvCell).join(';'));
  D.logActivity(req.user, 'Solicitudes', `${rows.length} registros`, 'Se exportaron solicitudes', '—');
  res.setHeader('Content-Disposition', 'attachment; filename="solicitudes-seniors.csv"');
  res.type('text/csv; charset=utf-8').send('﻿' + [head.join(';'), ...body].join('\r\n'));
});
api.patch('/requests/:id', perm('requests'), (req, res) => {
  const r = D.db.prepare('SELECT * FROM requests WHERE id = ?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  const status = (req.body || {}).status;
  if (!S.REQUEST_STATUS[status]) return res.status(400).json({ error: 'Estado no válido.' });
  const notes = JSON.parse(r.notes || '[]');
  notes.push({ at: D.now(), by: req.user.name, text: `Estado cambiado de «${S.REQUEST_STATUS[r.status]}» a «${S.REQUEST_STATUS[status]}».`, system: true });
  D.db.prepare('UPDATE requests SET status = ?, notes = ?, updated_at = ? WHERE id = ?').run(status, JSON.stringify(notes), D.now(), r.id);
  D.logActivity(req.user, 'Solicitudes', `Solicitud #${r.id} (${r.name})`, `Estado cambiado a «${S.REQUEST_STATUS[status]}»`, '—');
  res.json(requestRow(D.db.prepare('SELECT * FROM requests WHERE id = ?').get(r.id)));
});
api.post('/requests/:id/notes', perm('requests'), (req, res) => {
  const r = D.db.prepare('SELECT * FROM requests WHERE id = ?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada.' });
  const text = cleanText((req.body || {}).text).slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Escribe una observación.' });
  const notes = JSON.parse(r.notes || '[]');
  notes.push({ at: D.now(), by: req.user.name, text });
  D.db.prepare('UPDATE requests SET notes = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(notes), D.now(), r.id);
  D.logActivity(req.user, 'Solicitudes', `Solicitud #${r.id} (${r.name})`, 'Se registró una observación interna', '—');
  res.json(requestRow(D.db.prepare('SELECT * FROM requests WHERE id = ?').get(r.id)));
});

// ---- Usuarios y permisos ----
const userPublic = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: !!u.active, created_at: u.created_at, last_login: u.last_login });
const activeAdmins = () => D.db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;

api.get('/users', perm('users'), (req, res) => res.json(D.db.prepare('SELECT * FROM users ORDER BY id').all().map(userPublic)));
api.post('/users', perm('users'), (req, res) => {
  const b = req.body || {};
  const name = cleanText(b.name).slice(0, 100), email = cleanText(b.email).toLowerCase().slice(0, 160);
  const errors = {};
  if (name.length < 2) errors.name = 'Ingresa el nombre.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Correo no válido.';
  if (!S.ROLES[b.role]) errors.role = 'Selecciona un rol.';
  const pp = passwordProblem(b.password); if (pp) errors.password = pp;
  if (D.db.prepare('SELECT id FROM users WHERE email = ?').get(email)) errors.email = 'Ya existe un usuario con ese correo.';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revisa los campos marcados.', errors });
  const r = D.db.prepare('INSERT INTO users (name, email, password_hash, role, active, must_change, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)').run(name, email, hashPassword(b.password), b.role, D.now());
  D.logActivity(req.user, 'Usuarios', email, `Se creó el usuario con rol «${S.ROLES[b.role].label}»`, '—');
  res.status(201).json(userPublic(D.db.prepare('SELECT * FROM users WHERE id = ?').get(Number(r.lastInsertRowid))));
});
api.put('/users/:id', perm('users'), (req, res) => {
  const u = D.db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const b = req.body || {};
  const name = cleanText(b.name).slice(0, 100) || u.name;
  const email = cleanText(b.email || u.email).toLowerCase().slice(0, 160);
  const role = S.ROLES[b.role] ? b.role : u.role;
  const active = b.active === undefined ? !!u.active : !!b.active;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Correo no válido.', errors: { email: 'Correo no válido.' } });
  const dup = D.db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, u.id);
  if (dup) return res.status(400).json({ error: 'Ya existe un usuario con ese correo.', errors: { email: 'Correo repetido.' } });
  if (u.id === req.user.id && (role !== u.role || !active)) return res.status(400).json({ error: 'No puedes cambiar tu propio rol ni desactivar tu propio usuario.' });
  if (u.role === 'admin' && u.active && (role !== 'admin' || !active) && activeAdmins() <= 1) return res.status(400).json({ error: 'Debe existir al menos un administrador activo.' });
  D.db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?').run(name, email, role, active ? 1 : 0, u.id);
  if (!active || role !== u.role) D.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  const changes = [];
  if (role !== u.role) changes.push(`rol «${S.ROLES[role].label}»`);
  if (active !== !!u.active) changes.push(active ? 'activado' : 'desactivado');
  D.logActivity(req.user, 'Usuarios', email, 'Se actualizó el usuario' + (changes.length ? ': ' + changes.join(', ') : ''), '—');
  res.json(userPublic(D.db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)));
});
api.post('/users/:id/password', perm('users'), (req, res) => {
  const u = D.db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const pp = passwordProblem((req.body || {}).password);
  if (pp) return res.status(400).json({ error: pp, errors: { password: pp } });
  D.db.prepare('UPDATE users SET password_hash = ?, must_change = ? WHERE id = ?').run(hashPassword(req.body.password), u.id === req.user.id ? 0 : 1, u.id);
  if (u.id !== req.user.id) D.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  D.logActivity(req.user, 'Usuarios', u.email, 'Se asignó una nueva contraseña', '—');
  res.json({ ok: true });
});

// ---- Copias de seguridad ----
function makeBackup(target) {
  if (fs.existsSync(target)) fs.rmSync(target);
  D.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}
api.get('/backup', perm('settings'), (req, res) => {
  const file = path.join(BACKUP_DIR, `manual-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  makeBackup(file);
  D.logActivity(req.user, 'Configuración', 'Copia de seguridad', 'Se descargó una copia de seguridad de la base de datos', '—');
  res.download(file, 'seniors-respaldo.db');
});
function autoBackup() {
  try {
    const file = path.join(BACKUP_DIR, `auto-${new Date().toISOString().slice(0, 10)}.db`);
    if (!fs.existsSync(file)) makeBackup(file);
    const autos = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('auto-')).sort();
    while (autos.length > 14) fs.rmSync(path.join(BACKUP_DIR, autos.shift()));
  } catch (e) { console.error('Copia de seguridad automática falló:', e.message); }
}
autoBackup();
setInterval(autoBackup, 6 * 3600e3).unref();

app.use('/api/admin', api);

// ---------------- Errores ----------------
app.use('/api', (req, res) => res.status(404).json({ error: 'Recurso no encontrado.' }));
app.use((req, res) => {
  res.status(404).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página no encontrada · Seniors</title><link rel="stylesheet" href="/css/site.css"></head><body class="legal-page"><main class="section"><div class="container narrow center"><p class="eyebrow">Error 404</p><h1>No encontramos esta página</h1><p><a class="btn btn-primary" href="/">Volver al inicio</a></p></div></main></body></html>`);
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api')) return res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'La información enviada es demasiado grande.' : 'Ocurrió un error inesperado. Inténtalo nuevamente.' });
  res.status(500).send('Error interno');
});

app.listen(PORT, () => {
  console.log(`\n  Seniors en marcha:`);
  console.log(`   · Sitio público:       http://localhost:${PORT}/`);
  console.log(`   · Panel administrativo: http://localhost:${PORT}/admin\n`);
});

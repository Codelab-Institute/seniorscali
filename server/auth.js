/*
 * Autenticación en el servidor:
 *  - Contraseñas con scrypt + sal aleatoria (nunca se guardan ni se envían en claro).
 *  - Sesión en cookie HttpOnly + SameSite=Strict; en la base solo se guarda el hash del token.
 *  - Token CSRF por sesión exigido en todas las peticiones que modifican datos.
 *  - Limitación de intentos de inicio de sesión por IP y por cuenta.
 */
const crypto = require('crypto');
const { ROLES } = require('../shared/schema');

const SESSION_COOKIE = 'seniors_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const IS_PROD = process.env.NODE_ENV === 'production';

// PROTOTIPO: tres cuentas fijas con la misma contraseña; no se consulta la contraseña guardada en la base.
// shortcut: credenciales y firma de sesión en el código; reemplazar por contraseñas reales y SESSION_SECRET antes de producción.
const PROTOTYPE_PASSWORD = '1234567890';
const PROTOTYPE_USERS = ['admin@seniorscali.co', 'editor@seniorscali.co', 'solicitudes@seniorscali.co'];
const SESSION_SECRET = process.env.SESSION_SECRET || 'seniors-prototipo-sesion';

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$' + salt.toString('base64') + '$' + hash.toString('base64');
}
function verifyPassword(pw, stored) {
  try {
    const [alg, s, h] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(h, 'base64');
    const got = crypto.scryptSync(pw, Buffer.from(s, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, got);
  } catch (e) { return false; }
}

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (pw.length > 200) return 'La contraseña es demasiado larga.';
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw) || !/[0-9]/.test(pw)) return 'La contraseña debe incluir letras y números.';
  return null;
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function cookieAttrs(maxAgeSec) {
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}` + (IS_PROD ? '; Secure' : '');
}

function createAuth(D) {
  const { db, now } = D;

  // Sesión firmada en la cookie (sin tabla): en Vercel cada instancia tiene su propia base en memoria,
  // así que una sesión guardada en la base se perdía al caer en otra instancia o tras un reinicio.
  // shortcut: cerrar sesión solo borra la cookie (no revoca el token); está bien para el prototipo.
  const sign = (data) => crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');

  function createSession(res, userId) {
    const csrf = crypto.randomBytes(24).toString('base64url');
    const data = Buffer.from(JSON.stringify({ uid: userId, csrf, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${data}.${sign(data)}; ${cookieAttrs(SESSION_TTL_MS / 1000)}`);
    return csrf;
  }

  function destroySession(req, res) {
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttrs(0)}`);
  }

  function loadSession(req) {
    const [data, sig] = String(parseCookies(req)[SESSION_COOKIE] || '').split('.');
    if (!data || !sig) return null;
    const a = Buffer.from(sig), b = Buffer.from(sign(data));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    let s;
    try { s = JSON.parse(Buffer.from(data, 'base64url').toString()); } catch (e) { return null; }
    if (!s || s.exp < Date.now()) return null;
    const row = db.prepare('SELECT id, name, email, role, active, must_change FROM users WHERE id = ?').get(s.uid);
    if (!row || !row.active) return null;
    return { user: { id: row.id, name: row.name, email: row.email, role: row.role, must_change: !!row.must_change, perms: (ROLES[row.role] || { perms: [] }).perms }, csrf: s.csrf };
  }

  // Middleware: exige sesión válida. Para APIs responde 401; para páginas redirige al inicio de sesión.
  function requireAuth(req, res, next) {
    const s = loadSession(req);
    if (!s) {
      if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Tu sesión ha finalizado. Inicia sesión nuevamente.' });
      return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
    }
    req.user = s.user;
    req.csrf = s.csrf;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const sent = req.get('X-CSRF-Token') || '';
      const a = Buffer.from(sent), b = Buffer.from(s.csrf);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: 'Solicitud no válida (CSRF). Recarga la página.' });
    }
    next();
  }

  function requirePerm(perm) {
    return (req, res, next) => {
      if (!req.user || !req.user.perms.includes(perm)) return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
      next();
    };
  }

  // ---- Limitación de intentos ----
  const attempts = new Map(); // clave → { n, until }
  function tooMany(key) {
    const a = attempts.get(key);
    return a && a.until > Date.now() && a.n >= 5;
  }
  function fail(key) {
    const a = attempts.get(key) || { n: 0, until: 0 };
    if (a.until < Date.now()) { a.n = 0; }
    a.n += 1;
    a.until = Date.now() + 15 * 60 * 1000;
    attempts.set(key, a);
  }
  function clear(key) { attempts.delete(key); }

  function login(req, res) {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
    const password = String((req.body && req.body.password) || '').slice(0, 200);
    const ipKey = 'ip:' + req.ip, userKey = 'u:' + email;
    if (tooMany(ipKey) || tooMany(userKey)) return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' });
    if (!email || !password) return res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = PROTOTYPE_USERS.includes(email) && password === PROTOTYPE_PASSWORD;
    if (!u || !ok || !u.active) {
      fail(ipKey); fail(userKey);
      return res.status(401).json({ error: u && ok && !u.active ? 'Tu usuario está desactivado. Contacta al administrador.' : 'Correo o contraseña incorrectos.' });
    }
    clear(ipKey); clear(userKey);
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now(), u.id);
    const csrf = createSession(res, u.id);
    D.logActivity(u, 'sesión', u.email, 'Inicio de sesión', '—');
    res.json({ ok: true, csrf });
  }

  // Recuperación de contraseña: genera un enlace de un solo uso (1 hora).
  // En el prototipo el enlace se escribe en la consola del servidor (simula el envío de correo).
  function requestReset(req, res) {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase().slice(0, 200);
    const key = 'reset:' + req.ip;
    if (tooMany(key)) return res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo más tarde.' });
    fail(key);
    const u = email && db.prepare('SELECT id, email, active FROM users WHERE email = ?').get(email);
    if (u && u.active) {
      const token = crypto.randomBytes(32).toString('base64url');
      db.prepare('INSERT INTO reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), u.id, Date.now() + 3600e3);
      const link = `${req.protocol}://${req.get('host')}/admin/restablecer?token=${token}`;
      console.log(`\n[Correo simulado] Para: ${u.email}\nAsunto: Restablecer contraseña del panel Seniors\nEnlace (válido 1 hora): ${link}\n`);
    }
    res.json({ ok: true, message: 'Si el correo está registrado, recibirás un enlace para restablecer la contraseña.' });
  }

  function doReset(req, res) {
    const token = String((req.body && req.body.token) || '');
    const pw = String((req.body && req.body.password) || '');
    const problem = passwordProblem(pw);
    if (problem) return res.status(400).json({ error: problem });
    const row = db.prepare('SELECT * FROM reset_tokens WHERE token_hash = ?').get(sha256(token));
    if (!row || row.used || row.expires_at < Date.now()) return res.status(400).json({ error: 'El enlace no es válido o ya expiró. Solicita uno nuevo.' });
    db.prepare('UPDATE users SET password_hash = ?, must_change = 0 WHERE id = ?').run(hashPassword(pw), row.user_id);
    db.prepare('UPDATE reset_tokens SET used = 1 WHERE token_hash = ?').run(row.token_hash);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    D.logActivity({ id: row.user_id, name: 'Usuario #' + row.user_id }, 'usuarios', 'Contraseña', 'Se restableció la contraseña', '—');
    res.json({ ok: true });
  }

  return { createSession, destroySession, loadSession, requireAuth, requirePerm, login, requestReset, doReset };
}

module.exports = { hashPassword, verifyPassword, passwordProblem, createAuth, parseCookies, SESSION_COOKIE, PROTOTYPE_PASSWORD };

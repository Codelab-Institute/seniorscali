/*
 * Prueba de humo de extremo a extremo contra un servidor en ejecución.
 * Uso: node scripts/smoke-test.js  (lee las credenciales de data/credenciales-iniciales.txt)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const creds = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', 'data', 'credenciales-iniciales.txt'), 'utf8').split('\n')) {
  const m = line.match(/^(\w+)\s+(\S+)\s+→\s+(\S+)/);
  if (m) creds[m[1]] = { email: m[2], password: m[3] };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); } };

async function session(role) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds[role]) });
  const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
  const { csrf } = await r.json();
  const call = async (method, url, body, extra) => {
    const headers = { Cookie: cookie, 'X-CSRF-Token': csrf, ...(extra || {}) };
    let b = body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
    const res = await fetch(BASE + url, { method, headers, body: b, redirect: 'manual' });
    let json = null; try { json = await res.json(); } catch (e) { /* noop */ }
    return { status: res.status, json };
  };
  return { cookie, csrf, call };
}
const pub = async (p) => (await fetch(BASE + (p || '/'))).text();

(async () => {
  console.log('\nPáginas independientes');
  for (const p of ['/', '/nosotros', '/servicios', '/instalaciones', '/experiencias', '/testimonios', '/preguntas-frecuentes', '/contacto']) {
    ok((await fetch(BASE + p)).status === 200, `Página ${p} disponible`);
  }
  const home = await pub('/');
  ok(home.includes('href="/servicios"') && home.includes('href="/nosotros"') && !home.includes('id="booking-form"'), 'Inicio muestra el resumen con enlaces a cada página');
  const sv = await pub('/servicios');
  ok(sv.includes('service-card') && sv.includes('comp-grid') && !sv.includes('id="booking-form"') && !sv.includes('benefit-card') && !sv.includes('class="gallery"'), 'Servicios muestra solo su contenido');
  const ct = await pub('/contacto');
  ok(ct.includes('id="booking-form"') && !ct.includes('service-card') && !ct.includes('benefit-card'), 'Contacto muestra solo contacto y formulario');
  ok(sv.includes('href="/servicios" class="is-active" aria-current="page"'), 'El menú marca la página actual');
  ok(!/href="#(servicios|nosotros|agendar|contacto|inicio)"/.test(home + sv + ct), 'No quedan enlaces de una sola página (#seccion)');

  console.log('\nSeguridad');
  ok((await fetch(BASE + '/api/admin/dashboard')).status === 401, 'API administrativa sin sesión → 401');
  const red = await fetch(BASE + '/admin', { redirect: 'manual' });
  ok(red.status === 302 && /\/admin\/login/.test(red.headers.get('location')), '/admin sin sesión redirige al inicio de sesión');
  const bad = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: creds.admin.email, password: 'incorrecta123' }) });
  ok(bad.status === 401, 'Contraseña incorrecta rechazada');
  const html = await pub();
  ok(!/admin/i.test((html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/) || [''])[0]), 'El menú público no enlaza a /admin');

  const A = await session('admin');
  const E = await session('editor');
  const G = await session('gestor');
  ok(!!A.csrf && !!E.csrf && !!G.csrf, 'Inicio de sesión de los tres roles');
  const noCsrf = await fetch(BASE + '/api/admin/content/hero', { method: 'PUT', headers: { Cookie: A.cookie, 'Content-Type': 'application/json' }, body: '{}' });
  ok(noCsrf.status === 403, 'Petición sin token CSRF rechazada');

  console.log('\nPermisos');
  ok((await E.call('POST', '/api/admin/publish', {})).status === 403, 'Editor no puede publicar');
  ok((await E.call('GET', '/api/admin/users')).status === 403, 'Editor no gestiona usuarios');
  ok((await G.call('PUT', '/api/admin/content/hero', { title: 'x' })).status === 403, 'Gestor no modifica contenidos');
  ok((await G.call('GET', '/api/admin/requests')).status === 200, 'Gestor consulta solicitudes');
  ok((await E.call('GET', '/api/admin/requests')).status === 403, 'Editor no ve solicitudes');

  console.log('\nEdición, vista previa y publicación');
  const content = (await A.call('GET', '/api/admin/content')).json;
  const original = content.hero.title;
  const nuevo = 'Título de prueba ' + Date.now();
  ok((await E.call('PUT', '/api/admin/content/hero', { ...content.hero, title: nuevo })).status === 200, 'Editor guarda el título del Hero');
  ok(!(await pub()).includes(nuevo), 'El cambio NO aparece en el sitio antes de publicar');
  const prev = await fetch(BASE + '/preview', { headers: { Cookie: A.cookie } });
  ok((await prev.text()).includes(nuevo), 'La vista previa muestra el cambio guardado');
  ok((await fetch(BASE + '/preview', { redirect: 'manual' })).status === 302, 'La vista previa exige sesión');
  const st = (await A.call('GET', '/api/admin/publish/status')).json;
  ok(st.pending && st.changes.length > 0, 'Estado: cambios sin publicar detectados');
  ok((await A.call('POST', '/api/admin/publish', { note: 'Prueba' })).status === 200, 'Administrador publica');
  ok((await pub()).includes(nuevo), 'El sitio público muestra el cambio publicado');
  const badLink = await A.call('PUT', '/api/admin/content/hero', { ...content.hero, title: '' });
  ok(badLink.status === 400 && badLink.json.errors.title, 'Validación: título obligatorio');

  console.log('\nServicios y estados');
  const services = (await A.call('GET', '/api/admin/items/services')).json;
  const s0 = services[0];
  await A.call('PATCH', `/api/admin/items/services/${s0.id}/status`, { status: 'despublicado' });
  await A.call('POST', '/api/admin/publish', {});
  ok(!(await pub('/servicios')).includes(`data-service="${s0.id}"`), 'Servicio desactivado deja de mostrarse');
  await A.call('PATCH', `/api/admin/items/services/${s0.id}/status`, { status: 'publicado' });

  console.log('\nMultimedia');
  const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#4DBBC8' } }).png().toBuffer();
  const fd = new FormData();
  fd.append('files', new Blob([png], { type: 'image/png' }), 'prueba.png');
  fd.append('category', 'Experiencias');
  const up = await E.call('POST', '/api/admin/media', fd);
  ok(up.status === 201 && /\.webp$/.test(up.json.created[0].url), 'Imagen subida y convertida a WebP');
  const evil = new FormData();
  evil.append('files', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/svg+xml' }), 'x.svg');
  ok((await A.call('POST', '/api/admin/media', evil)).status === 400, 'SVG con script rechazado');
  const fake = new FormData();
  fake.append('files', new Blob(['MZ ejecutable'], { type: 'image/png' }), 'virus.png');
  ok((await A.call('POST', '/api/admin/media', fake)).status === 400, 'Archivo disfrazado de imagen rechazado');

  console.log('\nExperiencias');
  const exp = await E.call('POST', '/api/admin/items/experiences', { status: 'publicado', data: { media: up.json.created[0].url, title: 'Experiencia de prueba', description: 'Desc', category: 'Actividades artísticas', date: '2026-11-01' } });
  ok(exp.status === 201, 'Experiencia creada con la imagen nueva');
  await A.call('POST', '/api/admin/publish', {});
  const h2 = await pub('/experiencias');
  ok(h2.includes('Experiencia de prueba') && h2.includes(up.json.created[0].url), 'Experiencia e imagen visibles tras publicar');
  const usage = await A.call('DELETE', `/api/admin/media/${up.json.created[0].id}`);
  ok(usage.status === 409 && usage.json.usage.length > 0, 'Advertencia al eliminar imagen en uso');
  await A.call('DELETE', `/api/admin/items/experiences/${exp.json.id}`);

  console.log('\nEnlaces');
  const links = (await A.call('GET', '/api/admin/items/links')).json;
  const cta = links.find((l) => l.key === 'header_cta');
  const r1 = await A.call('PUT', `/api/admin/items/links/${cta.id}`, { status: 'publicado', data: { ...cta, url: 'javascript:alert(1)' } });
  ok(r1.status === 400, 'Enlace con destino no válido rechazado');

  console.log('\nFormulario de agendamiento');
  const bk = content.booking.time_slots.split('\n')[0];
  const tomorrow = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
  const valid = { name: 'Persona de Prueba', phone: '+57 300 000 0000', email: 'prueba@example.com', service: 'Pasadía', date: tomorrow, time: bk, message: 'Hola', consent: true };
  const pv = await fetch(BASE + '/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, date: '2020-01-01' }) });
  ok(pv.status === 400, 'Fecha pasada rechazada');
  const pe = await fetch(BASE + '/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, email: 'no-es-correo' }) });
  ok(pe.status === 400, 'Correo inválido rechazado');
  const pc = await fetch(BASE + '/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...valid, consent: false }) });
  ok(pc.status === 400, 'Sin aceptar política → rechazado');
  const p1 = await fetch(BASE + '/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
  ok(p1.status === 201, 'Solicitud válida registrada');
  const reqs = (await G.call('GET', '/api/admin/requests')).json;
  const mine = reqs.rows.find((r) => r.email === 'prueba@example.com');
  ok(mine && mine.status === 'pendiente', 'Queda «Pendiente» (no se confirma automáticamente)');
  ok((await G.call('PATCH', `/api/admin/requests/${mine.id}`, { status: 'contactado' })).json.status === 'contactado', 'Gestor cambia el estado');
  ok((await G.call('POST', `/api/admin/requests/${mine.id}/notes`, { text: 'Nota interna' })).json.notes.length >= 2, 'Gestor registra observación');

  console.log('\nHistorial y restauración');
  const hist = (await A.call('GET', '/api/admin/history')).json;
  ok(hist.total > 5 && hist.rows[0].user_name, 'Historial registra usuario, fecha y acción');
  const pubs = (await A.call('GET', '/api/admin/publications')).json;
  ok(pubs.length >= 3, 'Versiones publicadas disponibles');

  // Restaurar el título original y publicar
  const c2 = (await A.call('GET', '/api/admin/content')).json;
  await A.call('PUT', '/api/admin/content/hero', { ...c2.hero, title: original });
  await A.call('POST', '/api/admin/publish', { note: 'Fin de prueba' });
  ok((await pub()).includes(original), 'Contenido original restaurado');

  console.log('\nPáginas desactivadas y vista previa');
  const lay = (await A.call('GET', '/api/admin/content')).json.layout || { hidden: [] };
  await A.call('PUT', '/api/admin/content/layout', { hidden: [...lay.hidden, 'testimonials'] });
  await A.call('POST', '/api/admin/publish', {});
  ok((await fetch(BASE + '/testimonios')).status === 404, 'Página desactivada responde 404');
  ok(!(await pub('/')).includes('href="/testimonios"'), 'Página desactivada desaparece del menú y del resumen');
  await A.call('PUT', '/api/admin/content/layout', { hidden: lay.hidden });
  await A.call('POST', '/api/admin/publish', {});
  ok((await fetch(BASE + '/testimonios')).status === 200, 'Página reactivada');
  const pvs = await (await fetch(BASE + '/preview?page=servicios', { headers: { Cookie: A.cookie } })).text();
  ok(pvs.includes('service-card') && pvs.includes('/preview?page=contacto'), 'Vista previa por página, con navegación dentro de la vista previa');

  console.log('\nSEO');
  ok((await (await fetch(BASE + '/robots.txt')).text()).includes('Disallow: /admin'), 'robots.txt bloquea /admin');
  ok((await (await fetch(BASE + '/sitemap.xml')).text()).includes('<urlset'), 'sitemap.xml disponible');
  ok(/<meta property="og:title"/.test(await pub()), 'Metadatos para redes sociales');

  console.log(`\n${pass} correctas, ${fail} fallidas\n`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

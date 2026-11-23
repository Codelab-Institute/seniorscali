/*
 * Revisión del sitio construido (dist/): enlaces internos, imágenes, anclas, idiomas y metadatos.
 * Uso: npm run build && npm run check
 */
const fs = require('fs');
const path = require('path');
const DIST = path.join(__dirname, '..', 'dist');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const pages = walk(DIST).filter((f) => f.endsWith('.html'));
let errors = 0, checks = 0;
const fail = (msg) => { errors++; console.log('  ✘ ' + msg); };

const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

function resolve(fromFile, href) {
  if (BASE) {
    if (!href.startsWith(BASE + '/')) return { target: '', hash: '' }; // en subcarpeta todo enlace interno debe llevar el prefijo
    href = href.slice(BASE.length);
  }
  const [p, hash] = href.split('#');
  let target = p ? path.join(DIST, decodeURIComponent(p)) : fromFile;
  if (p && (p.endsWith('/') || !path.extname(p))) target = path.join(target, 'index.html');
  return { target, hash };
}

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = '/' + path.relative(DIST, file).split(path.sep).join('/');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const refs = [...html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) m[1].split(',').forEach((s) => refs.push(s.trim().split(' ')[0]));
  for (const href of refs) {
    checks++;
    const { target, hash } = resolve(file, href);
    if (!target || !fs.existsSync(target)) { fail(`${rel}: enlace roto ${href}`); continue; }
    if (hash && target.endsWith('.html')) {
      const t = fs.readFileSync(target, 'utf8');
      if (!new RegExp(`\\sid="${hash}"`).test(t)) fail(`${rel}: ancla inexistente ${href}`);
    }
  }
  for (const m of html.matchAll(/href="#([^"]+)"/g)) { checks++; if (!ids.has(m[1])) fail(`${rel}: ancla local inexistente #${m[1]}`); }
  if (!rel.endsWith('404.html')) {
    checks += 4;
    if (!/<title>[^<]{5,}<\/title>/.test(html)) fail(`${rel}: sin título`);
    if (!/<meta name="description" content="[^"]{20,}"/.test(html) && !/politica|policy|datos|data/.test(rel)) fail(`${rel}: sin descripción`);
    if (!/hreflang="es-CO"/.test(html) || !/hreflang="en"/.test(html)) fail(`${rel}: faltan enlaces alternos de idioma`);
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) fail(`${rel}: debe tener exactamente un <h1>`);
  }
  const lang = (html.match(/<html lang="([^"]+)"/) || [])[1];
  checks++;
  if (rel.startsWith('/en/') ? lang !== 'en' : lang !== 'es-CO') fail(`${rel}: idioma del documento incorrecto (${lang})`);
  for (const m of html.matchAll(/<img [^>]*>/g)) { checks++; if (!/\salt="/.test(m[0])) fail(`${rel}: imagen sin alt`); }
}

console.log(`\n${pages.length} páginas revisadas, ${checks} comprobaciones, ${errors} problema(s)\n`);
process.exit(errors ? 1 : 0);

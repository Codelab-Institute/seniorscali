/*
 * Construye el sitio estático en la carpeta dist/.
 *   npm run build                         → dist/ listo para publicar en cualquier hosting estático
 *   BASE_PATH=/seniors npm run build      → si el sitio se publica en una subcarpeta (p. ej. GitHub Pages de proyecto)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ASSETS = path.join(SRC, 'assets');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache', 'img');

const RASTER = /\.(jpe?g|png|webp|avif|tiff?)$/i;
// Anchos generados para cada fotografía (se omiten los mayores que el original)
const WIDTHS = { images: [480, 800, 1200, 1800], brand: [200, 400] };

const hash = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

function svgSize(buf) {
  const s = buf.toString('utf8', 0, 600);
  const vb = s.match(/viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/);
  if (vb) return { width: Math.round(+vb[1]), height: Math.round(+vb[2]) };
  const w = s.match(/width="([\d.]+)"/), h = s.match(/height="([\d.]+)"/);
  return w && h ? { width: Math.round(+w[1]), height: Math.round(+h[1]) } : {};
}

async function processImages() {
  const manifest = {};
  fs.mkdirSync(CACHE, { recursive: true });
  for (const file of walk(ASSETS)) {
    if (/favicon-\d+\.png$/.test(file)) continue; // los favicons se optimizan y copian aparte
    const rel = path.relative(ASSETS, file).split(path.sep).join('/');
    const group = rel.split('/')[0];
    const buf = fs.readFileSync(file);
    const outDir = path.join(DIST, 'img');
    fs.mkdirSync(outDir, { recursive: true });
    const base = rel.replace(/\.[^.]+$/, '').replace(/\//g, '-');

    if (/\.svg$/i.test(file)) {
      const name = `${base}.${hash(buf)}.svg`;
      fs.writeFileSync(path.join(outDir, name), buf);
      manifest[rel] = { src: '/img/' + name, ...svgSize(buf) };
    } else if (RASTER.test(file)) {
      const meta = await sharp(buf).metadata();
      const h = hash(buf);
      const widths = (WIDTHS[group] || WIDTHS.images).filter((w) => w < meta.width);
      if (!widths.length || widths[widths.length - 1] < meta.width) widths.push(Math.min(meta.width, (WIDTHS[group] || WIDTHS.images).slice(-1)[0]));
      const uniq = [...new Set(widths)];
      const set = [];
      for (const w of uniq) {
        const name = `${base}-${w}.${h}.webp`;
        const cached = path.join(CACHE, name);
        if (!fs.existsSync(cached)) {
          await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: group === 'brand' ? 82 : 78, effort: 5 }).toFile(cached);
        }
        fs.copyFileSync(cached, path.join(outDir, name));
        set.push({ w, url: '/img/' + name });
      }
      const largest = set[set.length - 1];
      manifest[rel] = {
        src: largest.url,
        srcset: set.length > 1 ? set.map((s) => `${s.url} ${s.w}w`).join(', ') : '',
        width: largest.w,
        height: Math.round((largest.w * meta.height) / meta.width)
      };
    } else {
      // Videos u otros archivos: se copian con huella
      const ext = path.extname(file);
      const name = `${base}.${hash(buf)}${ext}`;
      fs.writeFileSync(path.join(outDir, name), buf);
      manifest[rel] = { src: '/img/' + name };
    }
  }
  return manifest;
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

async function build() {
  const t0 = Date.now();
  // Recargar contenidos y plantillas en cada construcción (modo desarrollo)
  for (const k of Object.keys(require.cache)) if (k.startsWith(SRC)) delete require.cache[k];
  const { renderAll, sitemap, BASE } = require('../src/templates');
  const C = require('../src/content');
  // En GitHub Pages la dirección pública la define el flujo de publicación (SITE_URL)
  if (process.env.SITE_URL) C.settings.siteUrl = process.env.SITE_URL.replace(/\/$/, '');

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

  const manifest = await processImages();
  const assets = {
    image(p) {
      const m = manifest[p];
      if (!m) throw new Error(`Imagen no encontrada en src/assets: ${p}`);
      return m;
    },
    file(p) { return this.image(p).src; }
  };

  // Favicons (se publican sin huella para que los navegadores los encuentren siempre)
  fs.mkdirSync(path.join(DIST, 'brand'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ASSETS, 'brand')).filter((f) => f.startsWith('favicon'))) {
    const src = path.join(ASSETS, 'brand', f);
    const cached = path.join(CACHE, 'opt-' + f);
    if (!fs.existsSync(cached) || fs.statSync(cached).mtimeMs < fs.statSync(src).mtimeMs) {
      await sharp(src).png({ palette: true, quality: 85, compressionLevel: 9, effort: 10 }).toFile(cached);
    }
    fs.copyFileSync(cached, path.join(DIST, 'brand', f));
  }
  manifest['brand/favicon-32.png'] = { src: '/brand/favicon-32.png', width: 32, height: 32 };
  manifest['brand/favicon-64.png'] = { src: '/brand/favicon-64.png', width: 64, height: 64 };
  manifest['brand/favicon-180.png'] = { src: '/brand/favicon-180.png', width: 180, height: 180 };
  manifest['brand/favicon-192.png'] = { src: '/brand/favicon-192.png', width: 192, height: 192 };
  manifest['brand/favicon-512.png'] = { src: '/brand/favicon-512.png', width: 512, height: 512 };

  // CSS y JS con huella para caché de larga duración
  const css = minifyCss(fs.readFileSync(path.join(SRC, 'styles', 'site.css'), 'utf8'));
  const cssName = `site.${hash(css)}.css`;
  fs.writeFileSync(path.join(DIST, 'assets', cssName), css);
  const js = fs.readFileSync(path.join(SRC, 'scripts', 'site.js'), 'utf8');
  const jsName = `site.${hash(js)}.js`;
  fs.writeFileSync(path.join(DIST, 'assets', jsName), js);

  const pages = renderAll(assets, { css: `${BASE}/assets/${cssName}`, js: `${BASE}/assets/${jsName}` });
  for (const p of pages) {
    const file = p.path.endsWith('.html') ? path.join(DIST, p.path) : path.join(DIST, p.path, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, p.html.replace(/\n\s+/g, '\n'));
  }

  const site = C.settings.siteUrl.replace(/\/$/, '') + BASE;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap());
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
  fs.writeFileSync(path.join(DIST, 'site.webmanifest'), JSON.stringify({
    name: C.settings.name, short_name: C.settings.shortName, start_url: BASE + '/', display: 'browser',
    background_color: '#F6F7F3', theme_color: '#52665D',
    icons: [{ src: BASE + '/brand/favicon-192.png', sizes: '192x192', type: 'image/png' }, { src: BASE + '/brand/favicon-512.png', sizes: '512x512', type: 'image/png' }]
  }, null, 2));
  fs.writeFileSync(path.join(DIST, '.nojekyll'), ''); // GitHub Pages: publicar carpetas tal cual
  // Cabeceras de caché para Netlify/Cloudflare Pages (otros hostings las ignoran)
  fs.writeFileSync(path.join(DIST, '_headers'), `/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n`);

  const size = walk(DIST).reduce((a, f) => a + fs.statSync(f).size, 0);
  console.log(`✔ ${pages.length} páginas generadas en dist/ (${(size / 1024).toFixed(0)} KB en total) en ${Date.now() - t0} ms`);
}

module.exports = { build };
if (require.main === module) build().catch((e) => { console.error(e); process.exit(1); });

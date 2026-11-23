/*
 * Servidor local para revisar el sitio.
 *   npm run dev    → construye, sirve dist/ y reconstruye al guardar cambios en src/ (recarga el navegador)
 *   npm start      → solo sirve dist/ (como lo haría el hosting)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { build } = require('./build');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3000);
const WATCH = process.argv.includes('--watch');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2'
};

// Recarga automática del navegador en modo desarrollo
const clients = new Set();
const RELOAD = `<script>new EventSource('/__reload').onmessage=()=>location.reload()</script>`;

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (WATCH && urlPath === '/__reload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  let file = path.join(DIST, urlPath);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  let status = 200;
  if (!fs.existsSync(file)) {
    // /servicios → /servicios/
    if (fs.existsSync(path.join(DIST, urlPath, 'index.html'))) { res.writeHead(301, { Location: urlPath + '/' }); return res.end(); }
    file = path.join(DIST, '404.html');
    status = 404;
  }
  const ext = path.extname(file);
  const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': WATCH ? 'no-cache' : (/\/(assets|img)\//.test(urlPath) ? 'public, max-age=31536000, immutable' : 'no-cache') };
  let body = fs.readFileSync(file);
  if (WATCH && ext === '.html') body = Buffer.from(body.toString().replace('</body>', RELOAD + '</body>'));
  res.writeHead(status, headers);
  res.end(body);
});

(async () => {
  if (WATCH || !fs.existsSync(DIST)) await build();
  server.listen(PORT, () => console.log(`\n  Sitio en http://localhost:${PORT}/  (inglés: http://localhost:${PORT}/en/)\n`));
  if (WATCH) {
    let timer = null, running = false, again = false;
    const run = async () => {
      if (running) { again = true; return; }
      running = true;
      try { await build(); clients.forEach((c) => c.write('data: reload\n\n')); } catch (e) { console.error('✘ Error al construir:', e.message); }
      running = false;
      if (again) { again = false; run(); }
    };
    fs.watch(path.join(ROOT, 'src'), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(run, 150); });
    console.log('  Observando cambios en src/ …');
  }
})();

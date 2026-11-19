/*
 * Reinicia la base de datos al contenido inicial (borra solicitudes, historial y archivos subidos).
 * Detén el servidor antes de ejecutarlo. Uso: npm run reset
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
for (const f of ['seniors.db', 'seniors.db-wal', 'seniors.db-shm', 'credenciales-iniciales.txt']) fs.rmSync(path.join(DATA, f), { force: true });
fs.rmSync(path.join(ROOT, 'uploads'), { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, 'uploads'), { recursive: true });
require('../server/seed').seed();
console.log('Base de datos reiniciada.');

// Punto de entrada para Vercel: toda la aplicación Express corre como una sola función.
// Usa el paquete generado por `npm run vercel-build`, porque el cargador de Vercel no admite require() de
// módulos ES (htmlparser2, dependencia de sanitize-html) y esbuild los convierte a CommonJS.
module.exports = require('./_server.js');

/*
 * Prepara los recursos de marca a partir de los archivos originales de la carpeta raíz:
 *  - Logo.png         → logo para fondos oscuros (texto blanco) y versión para fondos claros (texto verde).
 *  - Favicon 2.png    → favicon circular con fondo transparente en varios tamaños.
 * Uso: npm run brand
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const GREEN = [0x52, 0x66, 0x5d];
const DARK = [0x30, 0x3a, 0x36];

async function logos() {
  const src = path.join(ROOT, 'Logo.png');
  const base = sharp(src).trim({ threshold: 5 }).resize({ width: 900 });
  await base.clone().png({ compressionLevel: 9 }).toFile(path.join(OUT, 'logo-oscuro.png'));

  const { data, info } = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a === 0) continue;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.22) {
      // Píxeles grises/blancos (letras y su contorno): se pasan a verde institucional.
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const t = Math.min(1, Math.max(0, (lum - 0.35) / 0.6));
      data[i] = Math.round(DARK[0] + (GREEN[0] - DARK[0]) * t);
      data[i + 1] = Math.round(DARK[1] + (GREEN[1] - DARK[1]) * t);
      data[i + 2] = Math.round(DARK[2] + (GREEN[2] - DARK[2]) * t);
      if (lum < 0.3) data[i + 3] = Math.round(a * 0.35); // suaviza el ruido oscuro del borde
    }
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(path.join(OUT, 'logo-claro.png'));
}

async function favicons() {
  const src = path.join(ROOT, 'Favicon 2.png');
  const size = 1254;
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 22}" fill="#fff"/></svg>`);
  const round = await sharp(src).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  for (const s of [512, 192, 180, 64, 32]) {
    await sharp(round).resize(s, s).png({ compressionLevel: 9 }).toFile(path.join(OUT, `favicon-${s}.png`));
  }
  await sharp(round).resize(512, 512).png().toFile(path.join(OUT, 'isotipo.png'));
}

// Favicon exclusivo del panel administrativo (fondo blanco), para diferenciarlo del sitio público.
async function adminFavicons() {
  const src = path.join(ROOT, 'Favicon Admin.webp');
  if (!fs.existsSync(src)) return;
  const meta = await sharp(src).metadata();
  const size = Math.min(meta.width, meta.height);
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 4}" fill="#fff"/></svg>`);
  const flat = await sharp(src).resize(size, size).flatten({ background: '#ffffff' }).png().toBuffer();
  const round = await sharp(flat).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  for (const s of [512, 192, 180, 64, 32]) {
    await sharp(round).resize(s, s).png({ compressionLevel: 9 }).toFile(path.join(OUT, `admin-favicon-${s}.png`));
  }
}

(async () => {
  await logos();
  await favicons();
  await adminFavicons();
  console.log('Recursos de marca generados en public/brand');
})().catch((e) => { console.error(e); process.exit(1); });

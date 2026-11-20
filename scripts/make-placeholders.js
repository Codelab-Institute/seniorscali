/*
 * Genera imágenes de referencia (sin texto, válidas para ambos idiomas) en src/assets/images.
 * Se reemplazan por fotografías reales: copia la foto en src/assets/images y cambia el nombre en src/content.
 * Uso: node scripts/make-placeholders.js
 */
const fs = require('fs');
const path = require('path');
const { icon } = require('../src/lib/icons');

const OUT = path.join(__dirname, '..', 'src', 'assets', 'images');
fs.mkdirSync(OUT, { recursive: true });

const TONES = [
  ['#52665D', '#91A49A', '#E8EEEA'],
  ['#3f8f99', '#91A49A', '#F6F7F3'],
  ['#91A49A', '#52665D', '#E8EEEA'],
  ['#5e7a6f', '#4DBBC8', '#F6F7F3'],
  ['#435650', '#7fb7b3', '#E8EEEA'],
  ['#6f8b80', '#b5c7bd', '#F6F7F3']
];

function photo(iconName, i, w = 1200, h = 900) {
  const [a, b, c] = TONES[i % TONES.length];
  const cx = w / 2, cy = h / 2;
  const ic = icon(iconName, { size: 96, stroke: 1.3 }).replace('<svg', `<svg x="${cx - 48}" y="${cy - 48}" color="#ffffff" opacity=".9"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="r" cx=".8" cy=".15" r=".7"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/><rect width="${w}" height="${h}" fill="url(#r)"/>
<path d="M0 ${h * 0.78} C ${w * 0.25} ${h * 0.68} ${w * 0.45} ${h * 0.86} ${w * 0.7} ${h * 0.76} S ${w} ${h * 0.7} ${w} ${h * 0.72} V${h} H0Z" fill="#fff" opacity=".1"/>
<circle cx="${cx}" cy="${cy}" r="96" fill="#fff" opacity=".12"/>${ic}
</svg>`;
}

function panorama(i) {
  const skies = [['#bfe6ea', '#F6F7F3'], ['#d7ece3', '#F6F7F3'], ['#c9e3e6', '#E8EEEA'], ['#e3efe8', '#F6F7F3'], ['#cfe8ec', '#E8EEEA']];
  const [s1, s2] = skies[i % skies.length];
  let trees = '';
  for (let k = 0; k < 26; k++) {
    const x = 60 + k * 117 + ((k * 37) % 50);
    const r = 34 + ((k * 13) % 28);
    trees += `<rect x="${x - 5}" y="${640 - r}" width="10" height="${r + 20}" fill="#52665D" opacity=".7"/><circle cx="${x}" cy="${640 - r * 1.4}" r="${r}" fill="${k % 3 ? '#91A49A' : '#52665D'}" opacity=".85"/>`;
  }
  let houses = '';
  for (let k = 0; k < 4; k++) {
    const x = 300 + k * 720;
    houses += `<g transform="translate(${x} 470)"><rect width="260" height="170" rx="6" fill="#fff"/><path d="M-20 0 L130 -90 L280 0Z" fill="#52665D"/><rect x="30" y="50" width="50" height="50" rx="4" fill="#4DBBC8" opacity=".6"/><rect x="180" y="50" width="50" height="50" rx="4" fill="#4DBBC8" opacity=".6"/><rect x="105" y="80" width="50" height="90" rx="4" fill="#91A49A"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3000 1000" width="3000" height="1000">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs>
<rect width="3000" height="1000" fill="url(#s)"/><circle cx="${400 + i * 500}" cy="200" r="80" fill="#fff" opacity=".9"/>
<path d="M0 620 C 400 520 800 660 1200 590 S 2000 520 2400 600 S 2800 640 3000 590 V1000 H0Z" fill="#91A49A" opacity=".55"/>
${houses}${trees}
<path d="M0 700 C 600 660 1200 740 1800 690 S 2600 660 3000 700 V1000 H0Z" fill="#7d9488"/>
</svg>`;
}

const files = {
  'hero.svg': photo('sun', 0, 1200, 1400),
  'nosotros.svg': photo('hand-heart', 3, 1200, 1000),
  'servicio-estadia.svg': photo('bed', 0),
  'servicio-pasadia.svg': photo('sun', 1),
  'servicio-talleres.svg': photo('brush', 2)
};
['bed', 'leaf', 'sofa', 'utensils', 'puzzle', 'palette'].forEach((ic, c) => {
  files[`instalacion-${c}-1.svg`] = photo(ic, c);
  files[`instalacion-${c}-2.svg`] = photo(ic, c + 3);
});
['cake', 'palette', 'puzzle', 'dumbbell', 'users', 'sparkles'].forEach((ic, k) => { files[`experiencia-${k + 1}.svg`] = photo(ic, k + 2); });
for (let k = 0; k < 5; k++) files[`panorama-${k + 1}.svg`] = panorama(k);

for (const [name, svg] of Object.entries(files)) fs.writeFileSync(path.join(OUT, name), svg.replace(/\n/g, ''));
console.log(`${Object.keys(files).length} imágenes de referencia en src/assets/images`);

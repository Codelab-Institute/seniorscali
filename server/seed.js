/*
 * Contenido inicial. Los datos institucionales (dirección, teléfonos, servicios, preguntas frecuentes)
 * provienen del sitio actual seniorscali.co. Las fotografías son imágenes de referencia (marcadores)
 * que deben reemplazarse desde el panel por fotografías reales de Seniors.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const D = require('./db');
const { hashPassword } = require('./auth');
const { icon } = require('../shared/icons');

const PUBLIC = path.join(__dirname, '..', 'public');
const PH_DIR = path.join(PUBLIC, 'placeholders');

const PALETTES = [
  ['#52665D', '#91A49A', '#E8EEEA'],
  ['#4DBBC8', '#91A49A', '#F6F7F3'],
  ['#91A49A', '#52665D', '#E8EEEA'],
  ['#3f8f99', '#52665D', '#F6F7F3']
];

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function photoPlaceholder(label, iconName, idx) {
  const [a, b, c] = PALETTES[idx % PALETTES.length];
  const ic = icon(iconName, { size: 120, stroke: 1.4 }).replace('<svg', '<svg x="540" y="300" color="#ffffff"');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>
<circle cx="1040" cy="140" r="260" fill="${c}" opacity=".12"/><circle cx="160" cy="720" r="320" fill="${c}" opacity=".10"/>
<path d="M0 640 C 260 560 420 700 640 630 S 1000 560 1200 620 V800 H0Z" fill="#ffffff" opacity=".12"/>
<circle cx="600" cy="360" r="120" fill="#ffffff" opacity=".14"/>
${ic}
<text x="600" y="545" text-anchor="middle" font-family="Georgia, 'Lora', serif" font-size="46" fill="#ffffff">${esc(label)}</text>
<text x="600" y="595" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" letter-spacing="3" fill="#ffffff" opacity=".8">IMAGEN DE REFERENCIA · REEMPLAZAR</text>
</svg>`;
}

function panoramaPlaceholder(label, idx) {
  const skies = [['#bfe6ea', '#F6F7F3'], ['#d7ece3', '#F6F7F3'], ['#c9e3e6', '#E8EEEA'], ['#e3efe8', '#F6F7F3'], ['#cfe8ec', '#E8EEEA']];
  const [s1, s2] = skies[idx % skies.length];
  let trees = '';
  for (let i = 0; i < 26; i++) {
    const x = 60 + i * 117 + ((i * 37) % 50);
    const r = 34 + ((i * 13) % 28);
    trees += `<rect x="${x - 5}" y="${640 - r}" width="10" height="${r + 20}" fill="#52665D" opacity=".7"/><circle cx="${x}" cy="${640 - r * 1.4}" r="${r}" fill="${i % 3 ? '#91A49A' : '#52665D'}" opacity=".85"/>`;
  }
  let houses = '';
  for (let i = 0; i < 4; i++) {
    const x = 300 + i * 720;
    houses += `<g transform="translate(${x} 470)"><rect width="260" height="170" rx="6" fill="#ffffff"/><path d="M-20 0 L130 -90 L280 0Z" fill="#52665D"/><rect x="30" y="50" width="50" height="50" rx="4" fill="#4DBBC8" opacity=".6"/><rect x="180" y="50" width="50" height="50" rx="4" fill="#4DBBC8" opacity=".6"/><rect x="105" y="80" width="50" height="90" rx="4" fill="#91A49A"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3000 1000" width="3000" height="1000">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient></defs>
<rect width="3000" height="1000" fill="url(#s)"/>
<circle cx="${400 + idx * 500}" cy="200" r="80" fill="#ffffff" opacity=".9"/>
<path d="M0 620 C 400 520 800 660 1200 590 S 2000 520 2400 600 S 2800 640 3000 590 V1000 H0Z" fill="#91A49A" opacity=".55"/>
${houses}${trees}
<path d="M0 700 C 600 660 1200 740 1800 690 S 2600 660 3000 700 V1000 H0Z" fill="#7d9488"/>
<rect x="0" y="860" width="3000" height="140" fill="#52665D" opacity=".35"/>
<text x="1500" y="940" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#ffffff">${esc(label)} · Panorámica de referencia</text>
</svg>`;
}

function writePlaceholder(slug, svg) {
  if (!D.EPHEMERAL) { // en Vercel el disco es de solo lectura; los SVG ya están versionados en public/placeholders
    fs.mkdirSync(PH_DIR, { recursive: true });
    fs.writeFileSync(path.join(PH_DIR, slug + '.svg'), svg);
  }
  return '/placeholders/' + slug + '.svg';
}

function randomPassword() {
  return crypto.randomBytes(9).toString('base64url') + 'a7!';
}

function seed() {
  const already = D.db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (already > 0) return false;

  const t = D.now();
  const media = [];
  const ph = (slug, label, iconName, idx, category) => {
    const url = writePlaceholder(slug, photoPlaceholder(label, iconName, idx));
    media.push({ url, name: label + ' (referencia)', category, kind: 'image', mime: 'image/svg+xml', w: 1200, h: 800 });
    return url;
  };
  const pano = (slug, label, idx) => {
    const url = writePlaceholder(slug, panoramaPlaceholder(label, idx));
    media.push({ url, name: label + ' panorámica (referencia)', category: 'Recorrido virtual', kind: 'image', mime: 'image/svg+xml', w: 3000, h: 1000 });
    return url;
  };

  // ---- Usuarios iniciales ----
  const creds = [
    { name: 'Administración Seniors', email: 'admin@seniors.local', role: 'admin' },
    { name: 'Editor de contenidos', email: 'editor@seniors.local', role: 'editor' },
    { name: 'Gestor de solicitudes', email: 'solicitudes@seniors.local', role: 'gestor' }
  ].map((u) => ({ ...u, password: process.env.SEED_ADMIN_PASSWORD && u.role === 'admin' ? process.env.SEED_ADMIN_PASSWORD : randomPassword() }));
  const insUser = D.db.prepare('INSERT INTO users (name, email, password_hash, role, active, must_change, created_at) VALUES (?, ?, ?, ?, 1, 0, ?)');
  for (const u of creds) insUser.run(u.name, u.email, hashPassword(u.password), u.role, t);
  const credFile = path.join(D.DATA_DIR, 'credenciales-iniciales.txt');
  fs.writeFileSync(credFile,
    'CREDENCIALES INICIALES DEL PANEL (/admin)\n' +
    'Cámbielas desde «Usuarios y permisos» y elimine este archivo después de entregarlas.\n\n' +
    creds.map((u) => `${u.role.padEnd(8)} ${u.email}  →  ${u.password}`).join('\n') + '\n');

  // ---- Marca ----
  const brand = {
    logo_main: '/brand/logo-claro.png', logo_light: '/brand/logo-claro.png', logo_dark: '/brand/logo-oscuro.png',
    favicon: '/brand/favicon-192.png', isotype: '/brand/isotipo.png', institutional_image: '/brand/isotipo.png'
  };
  media.push(
    { url: '/brand/logo-claro.png', name: 'Logotipo para fondos claros', category: 'Logotipos', kind: 'image', mime: 'image/png', w: 900, h: 300 },
    { url: '/brand/logo-oscuro.png', name: 'Logotipo para fondos oscuros', category: 'Logotipos', kind: 'image', mime: 'image/png', w: 900, h: 300 },
    { url: '/brand/favicon-192.png', name: 'Favicon', category: 'Logotipos', kind: 'image', mime: 'image/png', w: 192, h: 192 },
    { url: '/brand/isotipo.png', name: 'Isotipo Seniors', category: 'Logotipos', kind: 'image', mime: 'image/png', w: 512, h: 512 }
  );

  const heroImg = ph('hero', 'Fotografía principal de Seniors', 'sun', 0, 'Hero');

  const C = {
    settings: {
      name: 'Seniors Hogar y Entretenimiento Gold', short_name: 'Seniors',
      address: 'Carrera 115A # 16-115, Cali, Valle del Cauca, Colombia',
      phones: '+57 313 544 9717\n+57 317 854 2033\n+57 602 395 8956',
      whatsapp: '573135449717',
      whatsapp_message: 'Hola, quiero más información sobre Seniors.',
      email: 'seniorscali@gmail.com',
      hours: 'Pasadía: lunes a domingo, 9:00 a. m. – 5:00 p. m.\nVisitas a las instalaciones: con cita previa',
      maps_url: 'https://www.google.com/maps/search/?api=1&query=Carrera+115A+%2316-115+Cali+Colombia',
      chat_name: 'Seniors',
      chat_welcome: '¡Hola! Soy el asistente de Seniors. Puedo ayudarte con información sobre nuestros servicios, visitas y horarios. Elige una pregunta o escríbenos.'
    },
    seo: {
      title: 'Seniors · Hogar y Entretenimiento Gold para adultos mayores en Cali',
      description: 'Hogar y centro de entretenimiento para adultos mayores en Cali: estadía, pasadía y talleres con atención personalizada, acompañamiento y bienestar integral.',
      og_image: heroImg, site_url: 'https://www.seniorscali.co'
    },
    brand,
    layout: { hidden: [] },
    home: { cta_title: '¿Quieres conocernos?', cta_text: 'Agenda una visita y recorre nuestras instalaciones. Será un gusto recibirte a ti y a tu familia.' },
    hero: {
      eyebrow: 'Hogar y entretenimiento gold · Cali',
      title: 'Un lugar para disfrutar cada etapa de la vida',
      description: 'Un espacio donde el cuidado, la compañía y el bienestar se convierten en parte de cada día.',
      image: heroImg, image_alt: 'Residentes de Seniors compartiendo en las zonas verdes',
      highlights: '3.500 m² | de zonas de esparcimiento\n16 | huéspedes con atención personalizada\nLun – Dom | servicio de pasadía'
    },
    benefits: {
      eyebrow: 'Nosotros', title: '¿Por qué elegir Seniors?',
      intro: '<p>Somos un hogar y centro de entretenimiento <strong>gold</strong> para adultos mayores, donde atendemos a cada persona como en su propio hogar, con amor y dedicación.</p>'
    },
    services: {
      eyebrow: 'Servicios', title: 'Nuestros planes',
      intro: 'Con un concepto renovado, producto de una inspiración familiar, ofrecemos a las familias caleñas un espacio de alta calidad, con dotación y personal especializado.',
      complementary_title: 'Instalaciones y servicios complementarios',
      complementary_intro: 'Servicios incluidos y adicionales para hacer la estadía más placentera y entretenida.'
    },
    facilities: {
      eyebrow: 'Instalaciones', title: 'Espacios pensados para el bienestar',
      intro: 'Conoce los espacios que tenemos disponibles para hacer la estadía más cómoda, tranquila y entretenida.',
      tour_button: 'Conoce nuestras instalaciones'
    },
    tour: { title: 'Recorrido virtual', intro: 'Explora nuestros espacios. Arrastra la imagen o usa las flechas para mirar alrededor.' },
    experiences: {
      eyebrow: 'Experiencias', title: 'La vida en la comunidad Seniors',
      intro: 'Celebraciones, talleres, juegos y encuentros familiares que hacen parte de nuestro día a día.'
    },
    testimonials: {
      eyebrow: 'Testimonios', title: 'Lo que dicen las familias',
      intro: 'La confianza de las familias es nuestro mayor compromiso.'
    },
    faq: { eyebrow: 'Preguntas frecuentes', title: 'Resolvemos tus dudas', intro: 'Aclaremos juntos las dudas más comunes sobre nuestros servicios.' },
    booking: {
      eyebrow: 'Agenda tu visita', title: 'Ven a conocernos',
      intro: 'Déjanos tus datos y la fecha que prefieres. Nuestro equipo verificará la disponibilidad y se comunicará contigo para confirmar la visita.',
      time_slots: '9:00 a. m. – 10:00 a. m.\n10:00 a. m. – 11:00 a. m.\n11:00 a. m. – 12:00 m.\n2:00 p. m. – 3:00 p. m.\n3:00 p. m. – 4:00 p. m.\n4:00 p. m. – 5:00 p. m.',
      consent_text: '<p>Autorizo a Seniors a tratar mis datos personales para gestionar esta solicitud, conforme a la <a href="/tratamiento-de-datos">Política de tratamiento de datos personales</a>.</p>',
      success_message: '¡Gracias! Recibimos tu solicitud. Nuestro equipo verificará la disponibilidad y te contactará para confirmar la fecha y hora de tu visita.'
    },
    footer: {
      description: 'Hogar y centro de entretenimiento gold para adultos mayores en Cali. Cuidamos a cada persona para que se sienta en familia.',
      nav_title: 'Navegación', contact_title: 'Contacto', social_title: 'Síguenos',
      copyright: '© {año} Seniors Hogar y Entretenimiento Gold. Todos los derechos reservados.'
    },
    policies: {
      privacy: '<p><strong>Texto de referencia: debe ser revisado y aprobado por Seniors antes de su publicación definitiva.</strong></p><p>Seniors Hogar y Entretenimiento Gold respeta la privacidad de las personas que visitan este sitio. La información que se recoge a través de los formularios se utiliza exclusivamente para responder solicitudes, agendar visitas y brindar información sobre nuestros servicios.</p><ul><li>No vendemos ni cedemos información personal a terceros.</li><li>El sitio puede utilizar cookies técnicas necesarias para su funcionamiento.</li><li>Puedes solicitar la consulta, actualización o eliminación de tus datos escribiendo a seniorscali@gmail.com.</li></ul>',
      data: '<p><strong>Texto de referencia: debe ser revisado y aprobado por Seniors antes de su publicación definitiva.</strong></p><p>En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013, Seniors Hogar y Entretenimiento Gold, como responsable del tratamiento, informa que los datos personales suministrados (nombre, teléfono, correo electrónico y la información de la solicitud) serán tratados con la finalidad de gestionar solicitudes de visita, contactar al titular y enviar información sobre los servicios.</p><p>El titular tiene derecho a conocer, actualizar, rectificar y suprimir sus datos, así como a revocar la autorización otorgada, mediante solicitud enviada a seniorscali@gmail.com.</p>'
    }
  };

  D.tx(() => {
    for (const [k, v] of Object.entries(C)) D.setContent(k, v, 'Sistema');

    const add = (col, list) => list.forEach((d) => {
      const { _status, ...data } = d;
      D.createItem(col, data, _status || 'publicado', 'Sistema');
    });

    add('benefits', [
      { icon: 'user-check', title: 'Atención personalizada', description: 'Acompañamos el diario vivir de cada huésped según sus necesidades, gustos y ritmo.' },
      { icon: 'hand-heart', title: 'Acompañamiento', description: 'Un equipo cálido y cercano que brinda tranquilidad a los residentes y a sus familias.' },
      { icon: 'palette', title: 'Actividades recreativas', description: 'Programación variada de juegos, arte, música y celebraciones durante toda la semana.' },
      { icon: 'sofa', title: 'Espacios cómodos', description: 'Habitaciones 100 % dotadas, zonas comunes amplias y más de 3.500 m² de áreas de esparcimiento.' },
      { icon: 'heart', title: 'Bienestar integral', description: 'Enfermería, fisioterapia y alimentación balanceada para cuidar la salud física y emocional.' },
      { icon: 'users', title: 'Convivencia y socialización', description: 'Un ambiente familiar donde se construyen amistades y se comparten momentos especiales.' }
    ]);

    add('services', [
      { image: ph('servicio-estadia', 'Estadía', 'bed', 0, 'Servicios'), image_alt: 'Habitación de estadía en Seniors', title: 'Estadía', description: 'Ofrecemos acomodación en habitaciones 100 % dotadas, compartidas o individuales.', details: '<p>Acomodación permanente con atención personalizada en el diario vivir. Contamos con capacidad para <strong>16 huéspedes</strong>.</p><ul><li>Habitaciones amobladas, compartidas o individuales</li><li>Alimentación balanceada avalada por nutricionista</li><li>Enfermería, fisioterapia y terapia ocupacional</li><li>Lavandería y actividades recreativas</li></ul>', button_text: 'Conocer más', link: '' },
      { image: ph('servicio-pasadia', 'Pasadía', 'sun', 1, 'Servicios'), image_alt: 'Actividades del servicio de pasadía', title: 'Pasadía', description: 'Servicio de centro día para adultos mayores con toda nuestra programación especial. De lunes a domingo, de 9:00 a. m. a 5:00 p. m.', details: '<p>Un día lleno de actividades, compañía y cuidado, mientras la familia continúa con su rutina.</p><ul><li>Lunes a domingo, de 9:00 a. m. a 5:00 p. m.</li><li>Programación recreativa, artística y física</li><li>Alimentación durante la jornada</li></ul>', button_text: 'Conocer más', link: '' },
      { image: ph('servicio-talleres', 'Talleres especiales', 'brush', 2, 'Servicios'), image_alt: 'Taller artístico con adultos mayores', title: 'Talleres especiales', description: 'Programación especial de talleres por temporadas para adultos mayores.', details: '<p>Talleres temáticos por temporadas: arte, manualidades, música, memoria y actividades especiales.</p>', button_text: 'Conocer más', link: '' }
    ]);

    const comp = [
      ['stethoscope', 'Enfermería', 'Atención y seguimiento de enfermería.', 'Incluido'],
      ['activity', 'Fisioterapia y terapia ocupacional', 'Sesiones para mantener la movilidad y la autonomía.', 'Incluido'],
      ['bed', 'Habitaciones amobladas', 'Habitaciones dotadas, compartidas o individuales.', 'Incluido'],
      ['utensils', 'Alimentación', 'Restaurante con dieta balanceada avalada por nutricionista.', 'Incluido'],
      ['shirt', 'Lavandería', 'Cuidado de prendas y ropa de cama.', 'Incluido'],
      ['puzzle', 'Actividades de entretenimiento', 'Salón de juegos y programación recreativa.', 'Incluido'],
      ['palette', 'Actividades artísticas', 'Talleres de arte, música y manualidades.', 'Incluido'],
      ['bath', 'Baños adaptados', 'Espacios seguros y accesibles.', 'Incluido'],
      ['car', 'Traslados y acompañamiento a citas', 'Chofer y acompañamiento a citas médicas.', 'Adicional'],
      ['scissors', 'Peluquería', 'Cuidado personal y arreglo.', 'Adicional'],
      ['music', 'Serenatas', 'Para celebrar fechas especiales.', 'Adicional'],
      ['gift', 'Desayunos sorpresa y floristería', 'Detalles para sorprender a tus seres queridos.', 'Adicional']
    ];
    add('complementary', comp.map(([i, ti, de, inc]) => ({ icon: i, title: ti, description: de, included: inc, validated: true })));

    const facCats = ['Habitaciones', 'Zonas verdes', 'Espacios comunes', 'Comedor', 'Zonas de entretenimiento', 'Áreas de actividades'];
    add('facility_categories', facCats.map((name) => ({ name })));
    const facIcons = ['bed', 'leaf', 'sofa', 'utensils', 'puzzle', 'palette'];
    const fac = [];
    facCats.forEach((cat, ci) => {
      for (let k = 1; k <= 2; k++) {
        const slug = 'instalacion-' + ci + '-' + k;
        fac.push({ image: ph(slug, cat + ' ' + k, facIcons[ci], ci + k, 'Instalaciones'), title: cat + (k === 1 ? '' : ' — vista ' + k), description: 'Fotografía de referencia de ' + cat.toLowerCase() + '. Reemplázala por una fotografía real desde el panel.', category: cat });
      }
    });
    add('facilities', fac);

    add('tour', [
      ['Recepción y acceso', 'Nuestro punto de bienvenida para residentes, familias y visitantes.'],
      ['Zonas verdes', 'Más de 3.500 m² de áreas de esparcimiento al aire libre.'],
      ['Sala común', 'Espacio para compartir, conversar y disfrutar de actividades grupales.'],
      ['Comedor', 'Donde se sirve una alimentación balanceada en un ambiente familiar.'],
      ['Habitaciones', 'Habitaciones 100 % dotadas, compartidas o individuales.']
    ].map(([title, description], i) => ({ image: pano('panorama-' + (i + 1), title, i), title, description })));

    const expCats = ['Celebraciones y cumpleaños', 'Actividades artísticas', 'Juegos y dinámicas grupales', 'Actividades físicas', 'Encuentros familiares', 'Talleres y eventos especiales'];
    add('experience_categories', expCats.map((name) => ({ name })));
    const expIcons = ['cake', 'palette', 'puzzle', 'dumbbell', 'users', 'sparkles'];
    const expTitles = ['Celebración de cumpleaños del mes', 'Taller de pintura', 'Tarde de juegos de mesa', 'Gimnasia suave al aire libre', 'Encuentro de familias', 'Taller de temporada'];
    add('experiences', expCats.map((cat, i) => ({
      media: ph('experiencia-' + (i + 1), expTitles[i], expIcons[i], i + 2, 'Experiencias'),
      poster: '', title: expTitles[i],
      description: 'Publicación de referencia. Reemplaza la fotografía y el texto por una experiencia real de la comunidad Seniors.',
      category: cat, date: new Date(Date.now() - (i + 1) * 9 * 864e5).toISOString().slice(0, 10)
    })));

    add('testimonials', [
      { name: 'Familia de ejemplo', relation: 'Hija de residente', photo: '', comment: 'Este es un testimonio de ejemplo para mostrar el diseño del carrusel. Reemplázalo por un testimonio real autorizado por la familia.', date: '', example: true },
      { name: 'Familiar de ejemplo', relation: 'Nieto de usuaria de pasadía', photo: '', comment: 'Texto ilustrativo. Los testimonios publicados deben corresponder a experiencias reales y contar con autorización.', date: '', example: true },
      { name: 'Testimonio de ejemplo', relation: 'Esposa de residente', photo: '', comment: 'Ejemplo de comentario. Desde el panel puedes agregar la fotografía (opcional), la relación con el residente y la fecha.', date: '', example: true }
    ]);

    add('faqs', [
      { question: '¿Qué servicios ofrece Seniors?', answer: '<p>Ofrecemos tres planes principales: <strong>Estadía</strong> (acomodación permanente), <strong>Pasadía</strong> (centro día de lunes a domingo) y <strong>Talleres especiales</strong> por temporadas. Además, contamos con enfermería, fisioterapia, alimentación, lavandería y actividades de entretenimiento.</p>', validated: true },
      { question: '¿Qué incluye el servicio de estadía?', answer: '<p>Acomodación en habitaciones 100 % dotadas, compartidas o individuales, con atención personalizada, alimentación, enfermería, fisioterapia y terapia ocupacional, lavandería y programación recreativa.</p>', validated: true },
      { question: '¿Cómo funciona el servicio de pasadía?', answer: '<p>Es un servicio de centro día para adultos mayores con toda nuestra programación especial, disponible de lunes a domingo de 9:00 a. m. a 5:00 p. m.</p>', validated: true },
      { question: '¿Qué requisitos se necesitan para ingresar?', answer: '<p>Es necesario contar con EPS y algún servicio de emergencia médica. Si no los tienen, en Seniors ayudamos a tramitarlos. Al ingresar se firma un contrato con acuerdos y compromisos de ambas partes; no hay un tiempo mínimo de permanencia.</p>', validated: true },
      { question: '¿Qué tipo de alimentación reciben los residentes?', answer: '<p>Una dieta balanceada avalada por nutricionista y por el médico que acompaña a la institución. Se respetan las necesidades especiales de cada residente.</p>', validated: true },
      { question: '¿Cómo se manejan las necesidades médicas?', answer: '<p>Contamos con servicio de enfermería y fisioterapia. Las necesidades médicas se coordinan con la EPS y el servicio de emergencia de cada residente. También es posible contar con cuidadora personal siguiendo los protocolos de la institución.</p>', validated: false },
      { question: '¿Las familias pueden visitar a los residentes?', answer: '<p>Sí. Nuestra mayor alegría es preservar los vínculos familiares: las familias pueden visitar a los residentes y estos pueden salir con sus familiares a paseos, visitas y festividades. Las visitas se coordinan previamente.</p>', validated: true },
      { question: '¿Cómo puedo agendar una visita?', answer: '<p>Completa el formulario de <a href="/contacto#agendar">agendamiento</a> en la página de Contacto o escríbenos por WhatsApp. Nuestro equipo verificará la disponibilidad y te contactará para confirmar.</p>', validated: true },
      { question: '¿Cuáles son los costos?', answer: '<p>Los costos dependen del plan y de las necesidades de cada persona. Comunícate con nosotros por teléfono o WhatsApp para recibir una cotización personalizada.</p>', validated: false },
      { question: '¿Dónde se encuentra ubicado Seniors?', answer: '<p>Estamos en la Carrera 115A # 16-115, Cali, Valle del Cauca, Colombia.</p>', validated: true }
    ]);

    add('links', [
      { key: 'header_cta', label: 'Botón «Agendar una visita» del encabezado', text: 'Agendar una visita', url: '/contacto#agendar', type: 'interno', group: 'Encabezado' },
      { key: 'menu_inicio', label: 'Menú: Inicio', text: 'Inicio', url: '/', type: 'interno', group: 'Menú' },
      { key: 'menu_nosotros', label: 'Menú: Nosotros', text: 'Nosotros', url: '/nosotros', type: 'interno', group: 'Menú' },
      { key: 'menu_servicios', label: 'Menú: Servicios', text: 'Servicios', url: '/servicios', type: 'interno', group: 'Menú' },
      { key: 'menu_instalaciones', label: 'Menú: Instalaciones', text: 'Instalaciones', url: '/instalaciones', type: 'interno', group: 'Menú' },
      { key: 'menu_experiencias', label: 'Menú: Experiencias', text: 'Experiencias', url: '/experiencias', type: 'interno', group: 'Menú' },
      { key: 'menu_testimonios', label: 'Menú: Testimonios', text: 'Testimonios', url: '/testimonios', type: 'interno', group: 'Menú' },
      { key: 'menu_contacto', label: 'Menú: Contacto', text: 'Contacto', url: '/contacto', type: 'interno', group: 'Menú' },
      { key: 'hero_primary', label: 'Botón principal del Hero', text: 'Conoce nuestros servicios', url: '/servicios', type: 'interno', group: 'Presentación principal' },
      { key: 'hero_secondary', label: 'Botón secundario del Hero', text: 'Agenda una visita', url: '/contacto#agendar', type: 'interno', group: 'Presentación principal' },
      { key: 'social_facebook', label: 'Facebook', text: 'Facebook', url: 'https://www.facebook.com/seniorscali', type: 'red', group: 'Redes sociales', icon: 'facebook', new_tab: true },
      { key: 'social_instagram', label: 'Instagram', text: 'Instagram', url: 'https://www.instagram.com/seniorscali/', type: 'red', group: 'Redes sociales', icon: 'instagram', new_tab: true },
      { key: 'footer_privacy', label: 'Pie: Política de privacidad', text: 'Política de privacidad', url: '/politica-de-privacidad', type: 'interno', group: 'Pie de página' },
      { key: 'footer_data', label: 'Pie: Tratamiento de datos personales', text: 'Política de tratamiento de datos personales', url: '/tratamiento-de-datos', type: 'interno', group: 'Pie de página' }
    ]);

    const insMedia = D.db.prepare('INSERT OR IGNORE INTO media (url, thumb_url, name, original_name, kind, mime, size, width, height, category, created_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const m of media) {
      let size = 0;
      try { size = fs.statSync(path.join(PUBLIC, m.url)).size; } catch (e) { /* noop */ }
      insMedia.run(m.url, m.url, m.name, path.basename(m.url), m.kind, m.mime, size, m.w, m.h, m.category, t, 'Sistema');
    }
  });

  D.publish('Sistema', 'Publicación inicial');
  D.logActivity(null, 'sitio', 'Contenido inicial', 'Se creó y publicó el contenido inicial', 'publicado');
  console.log('\n  Base de datos inicializada. Credenciales iniciales en: ' + credFile + '\n');
  return true;
}

module.exports = { seed };

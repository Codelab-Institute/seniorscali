/*
 * Renderizado en el servidor del sitio público a partir de una instantánea de contenido.
 * El sitio tiene páginas independientes: Inicio (resumen) y una página por cada opción del menú.
 * Se usa para el sitio publicado (última publicación) y para la vista previa (copia de trabajo).
 */
const { icon } = require('../shared/icons');

const ASSET_VERSION = Date.now().toString(36);

// ---------------- Páginas ----------------
// section: clave de la sección cuyo contenido muestra la página (y que puede desactivarse desde el panel)
const PAGES = {
  inicio: { path: '/', label: 'Inicio', section: null },
  nosotros: { path: '/nosotros', label: 'Nosotros', section: 'benefits' },
  servicios: { path: '/servicios', label: 'Servicios', section: 'services' },
  instalaciones: { path: '/instalaciones', label: 'Instalaciones', section: 'facilities' },
  experiencias: { path: '/experiencias', label: 'Experiencias', section: 'experiences' },
  testimonios: { path: '/testimonios', label: 'Testimonios', section: 'testimonials' },
  preguntas: { path: '/preguntas-frecuentes', label: 'Preguntas frecuentes', section: 'faq' },
  contacto: { path: '/contacto', label: 'Contacto', section: 'booking' }
};
const PAGE_BY_PATH = Object.fromEntries(Object.entries(PAGES).map(([k, p]) => [p.path, k]));
const LEGAL = { '/politica-de-privacidad': 'privacy', '/tratamiento-de-datos': 'data' };
// Enlaces antiguos de una sola página (#seccion) → página correspondiente
const LEGACY = {
  '#inicio': '/', '#top': '/', '#nosotros': '/nosotros', '#servicios': '/servicios', '#instalaciones': '/instalaciones',
  '#experiencias': '/experiencias', '#testimonios': '/testimonios', '#preguntas': '/preguntas-frecuentes',
  '#contacto': '/contacto', '#agendar': '/contacto#agendar'
};

function e(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
const stripTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const isVideo = (u) => /\.(mp4|webm)$/i.test(u || '');

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Resuelve direcciones internas: convierte #secciones antiguas y, en vista previa, mantiene la navegación dentro de /preview. */
function makeHref(opts) {
  return (u) => {
    const x = LEGACY[String(u || '').trim()] || String(u || '');
    if (!opts.preview) return x;
    const m = x.match(/^(\/[\w-]*)(#[\w-]+)?$/);
    if (!m) return x;
    const ov = opts.overlay ? '&o=' + encodeURIComponent(opts.overlay) : '';
    if (PAGE_BY_PATH[m[1]]) return `/preview?page=${PAGE_BY_PATH[m[1]]}${ov}${m[2] || ''}`;
    if (LEGAL[m[1]]) return `/preview?page=${LEGAL[m[1]]}${ov}`;
    return x;
  };
}

function view(snapshot, opts) {
  const content = snapshot.content || {};
  const items = snapshot.items || {};
  const pub = (col) => (items[col] || []).filter((i) => i.status === 'publicado').sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const links = {};
  for (const l of pub('links')) if (l.key) links[l.key] = l;
  const hidden = new Set(((content.layout || {}).hidden) || []);
  const href = makeHref(opts || {});
  // Reescribe los enlaces internos dentro del texto enriquecido
  const rich = (html) => String(html || '').replace(/href="([^"]*)"/g, (all, u) => `href="${e(href(u.replace(/&amp;/g, '&')))}"`);
  const pageOn = (key) => !PAGES[key] || !PAGES[key].section || !hidden.has(PAGES[key].section);
  return { c: content, pub, links, hidden, href, rich, pageOn, S: content.settings || {}, B: content.brand || {}, opts: opts || {} };
}

function linkAttrs(v, l) {
  if (!l) return '';
  const url = v.href(l.url);
  const ext = l.new_tab || /^https?:/i.test(url);
  return `href="${e(url)}"` + (ext ? ' target="_blank" rel="noopener noreferrer"' : '');
}

// Página a la que apunta un enlace (para marcar el menú activo y ocultar páginas desactivadas)
function pageOfUrl(u) {
  const x = (LEGACY[String(u || '').trim()] || String(u || '')).split('#')[0];
  return PAGE_BY_PATH[x] || null;
}

function waUrl(S) {
  const n = String(S.whatsapp || '').replace(/\D/g, '');
  if (!n) return '';
  return `https://wa.me/${n}` + (S.whatsapp_message ? `?text=${encodeURIComponent(S.whatsapp_message)}` : '');
}

function img(url, alt, opts) {
  const o = opts || {};
  if (!url) return '';
  return `<img src="${e(url)}" alt="${e(alt || '')}"${o.cls ? ` class="${o.cls}"` : ''} ${o.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${o.w ? ` width="${o.w}" height="${o.h}"` : ''}>`;
}

function introHtml(v, intro, cls) {
  if (!intro) return '';
  return /<\w/.test(intro) ? `<div class="${cls} rich">${v.rich(intro)}</div>` : `<p class="${cls}">${e(intro)}</p>`;
}

function sectionHead(v, sec, id) {
  if (!sec) return '';
  return `<header class="section-head reveal">
    ${sec.eyebrow ? `<p class="eyebrow">${e(sec.eyebrow)}</p>` : ''}
    <h2 id="${id}-title">${e(sec.title)}</h2>
    ${introHtml(v, sec.intro, 'lead')}
  </header>`;
}

function moreLink(v, pageKey, text) {
  if (!v.pageOn(pageKey)) return '';
  return `<div class="section-foot reveal"><a class="btn btn-outline" href="${e(v.href(PAGES[pageKey].path))}">${e(text)}${icon('arrow-right', { size: 18 })}</a></div>`;
}

// ---------------- Encabezado ----------------
function menuLinks(v) {
  return v.pub('links').filter((l) => l.group === 'Menú').filter((l) => { const p = pageOfUrl(l.url); return !p || v.pageOn(p); });
}

function renderHeader(v, current) {
  const menu = menuLinks(v);
  const cta = v.links.header_cta;
  return `<header class="site-header" id="top">
  <div class="container header-inner">
    <a class="brand" href="${e(v.href('/'))}" aria-label="${e(v.S.short_name || 'Seniors')} — ir al inicio">
      ${img(v.B.logo_main || v.B.logo_light, v.S.name || 'Seniors', { eager: true, cls: 'brand-logo', w: 900, h: 300 })}
    </a>
    <nav class="main-nav" id="main-nav" aria-label="Navegación principal">
      <ul>
        ${menu.map((l) => {
          const active = pageOfUrl(l.url) === current;
          return `<li><a ${linkAttrs(v, l)}${active ? ' class="is-active" aria-current="page"' : ''}>${e(l.text || l.label)}</a></li>`;
        }).join('')}
      </ul>
      ${cta ? `<a class="btn btn-primary nav-cta-mobile" ${linkAttrs(v, cta)}>${e(cta.text)}</a>` : ''}
    </nav>
    <div class="header-actions">
      ${cta ? `<a class="btn btn-primary header-cta" ${linkAttrs(v, cta)}>${icon('calendar', { size: 18 })}<span>${e(cta.text)}</span></a>` : ''}
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Abrir menú">
        <span class="mt-open">${icon('menu')}</span><span class="mt-close">${icon('x')}</span>
      </button>
    </div>
  </div>
</header>`;
}

// Cabecera de las páginas internas: ruta, título e introducción de la sección
function pageBanner(v, pageKey, sec) {
  const s = sec || {};
  const menuLink = menuLinks(v).find((l) => pageOfUrl(l.url) === pageKey);
  const name = (menuLink && (menuLink.text || menuLink.label)) || PAGES[pageKey].label;
  return `<section class="page-hero" aria-labelledby="page-title">
  <div class="container">
    <nav class="breadcrumb" aria-label="Ruta de navegación"><a href="${e(v.href('/'))}">Inicio</a><span aria-hidden="true">${icon('chevron-right', { size: 14 })}</span><span aria-current="page">${e(name)}</span></nav>
    ${s.eyebrow ? `<p class="eyebrow">${e(s.eyebrow)}</p>` : ''}
    <h1 id="page-title">${e(s.title || name)}</h1>
    ${introHtml(v, s.intro, 'lead')}
  </div>
</section>`;
}

// ---------------- Bloques de contenido ----------------
function renderHero(v) {
  const h = v.c.hero || {};
  const p = v.links.hero_primary, s = v.links.hero_secondary;
  const hl = lines(h.highlights).map((l) => l.split('|').map((x) => x.trim()));
  return `<section class="hero" id="inicio" aria-labelledby="hero-title">
  <div class="container hero-grid">
    <div class="hero-text">
      ${h.eyebrow ? `<p class="eyebrow">${e(h.eyebrow)}</p>` : ''}
      <h1 id="hero-title">${e(h.title)}</h1>
      <p class="hero-desc">${e(h.description)}</p>
      <div class="hero-actions">
        ${p ? `<a class="btn btn-primary btn-lg" ${linkAttrs(v, p)}>${e(p.text)}${icon('arrow-right', { size: 18 })}</a>` : ''}
        ${s ? `<a class="btn btn-outline btn-lg" ${linkAttrs(v, s)}>${icon('calendar', { size: 18 })}${e(s.text)}</a>` : ''}
      </div>
      ${hl.length ? `<dl class="hero-highlights">${hl.map(([a, b]) => `<div><dt>${e(a)}</dt><dd>${e(b || '')}</dd></div>`).join('')}</dl>` : ''}
    </div>
    <div class="hero-media">
      <div class="hero-shape" aria-hidden="true"></div>
      <figure class="hero-figure">${img(h.image, h.image_alt, { eager: true, w: 1200, h: 800 })}</figure>
      <div class="hero-badge" aria-hidden="true">${icon('heart', { size: 22 })}<span>Cuidado con amor</span></div>
    </div>
  </div>
</section>`;
}

function benefitCards(v, list) {
  return `<div class="grid grid-3">
      ${list.map((b, i) => `<article class="card benefit-card reveal" style="--d:${i * 60}ms">
        <span class="icon-badge">${icon(b.icon)}</span>
        <h3>${e(b.title)}</h3>
        <p>${e(b.description)}</p>
      </article>`).join('')}
    </div>`;
}

function serviceCards(v, list, compact) {
  return `<div class="grid grid-3">
      ${list.map((x, i) => `<article class="card service-card reveal" style="--d:${i * 80}ms">
        <div class="card-media">${img(x.image, x.image_alt || x.title, { w: 1200, h: 800 })}</div>
        <div class="card-body">
          <h3>${e(x.title)}</h3>
          <p>${e(x.description)}</p>
          ${compact
            ? `<a class="btn btn-soft" href="${e(v.href('/servicios'))}">${e(x.button_text || 'Conocer más')}${icon('arrow-right', { size: 16 })}</a>`
            : x.link
              ? `<a class="btn btn-soft" ${linkAttrs(v, { url: x.link })}>${e(x.button_text || 'Conocer más')}${icon('arrow-right', { size: 16 })}</a>`
              : `<button class="btn btn-soft" type="button" data-service="${x.id}">${e(x.button_text || 'Conocer más')}${icon('arrow-right', { size: 16 })}</button>`}
        </div>
        ${compact ? '' : `<template id="service-${x.id}"><h3>${e(x.title)}</h3><div class="rich">${v.rich(x.details) || `<p>${e(x.description)}</p>`}</div></template>`}
      </article>`).join('')}
    </div>`;
}

function complementaryBlock(v) {
  const s = v.c.services || {};
  const comp = v.pub('complementary');
  if (!comp.length) return '';
  return `<div class="complementary reveal">
      <div class="complementary-head">
        <h2>${e(s.complementary_title || 'Servicios complementarios')}</h2>
        ${s.complementary_intro ? `<p>${e(s.complementary_intro)}</p>` : ''}
      </div>
      <ul class="comp-grid">
        ${comp.map((x) => `<li class="comp-item">
          <span class="icon-badge icon-sm">${icon(x.icon, { size: 20 })}</span>
          <div><h3>${e(x.title)} <span class="tag ${x.included === 'Adicional' ? 'tag-extra' : 'tag-incl'}">${e(x.included)}</span></h3>
          ${x.description ? `<p>${e(x.description)}</p>` : ''}</div>
        </li>`).join('')}
      </ul>
    </div>`;
}

function filterChips(name, cats, label) {
  if (cats.length < 2) return '';
  return `<div class="chips" role="toolbar" aria-label="${e(label)}" data-filter-group="${name}">
    <button type="button" class="chip is-active" data-filter="*" aria-pressed="true">Todas</button>
    ${cats.map((c) => `<button type="button" class="chip" data-filter="${e(c)}" aria-pressed="false">${e(c)}</button>`).join('')}
  </div>`;
}

function galleryGrid(list) {
  return `<ul class="gallery" data-filter-target="facilities">
      ${list.map((f, i) => `<li class="gallery-item reveal" data-cat="${e(f.category)}" style="--d:${(i % 6) * 50}ms">
        <button type="button" class="gallery-btn" data-lightbox="facilities" data-index="${i}" aria-label="Ampliar: ${e(f.title)}">
          ${img(f.image, f.title, { w: 1200, h: 800 })}
          <span class="gallery-caption"><strong>${e(f.title)}</strong><small>${e(f.category)}</small></span>
          <span class="gallery-zoom" aria-hidden="true">${icon('expand', { size: 18 })}</span>
        </button>
      </li>`).join('')}
    </ul>`;
}

function tourButton(v) {
  const s = v.c.facilities || {};
  const tourOn = !v.hidden.has('tour') && v.pub('tour').length > 0;
  return tourOn ? `<div class="center reveal"><button type="button" class="btn btn-primary btn-lg" data-open-tour>${icon('compass', { size: 20 })}${e(s.tour_button || 'Conoce nuestras instalaciones')}</button></div>` : '';
}

function sortedExperiences(v) {
  return v.pub('experiences').slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a.sort_order - b.sort_order);
}

function experienceCards(list) {
  return `<div class="grid grid-3" data-filter-target="experiences">
      ${list.map((x, i) => {
        const vid = isVideo(x.media);
        return `<article class="card exp-card reveal" data-cat="${e(x.category)}" style="--d:${(i % 6) * 60}ms">
        <button type="button" class="card-media exp-media" data-lightbox="experiences" data-index="${i}" aria-label="${vid ? 'Reproducir video' : 'Ampliar fotografía'}: ${e(x.title)}">
          ${vid
            ? (x.poster ? img(x.poster, x.title) : `<video src="${e(x.media)}#t=0.5" preload="metadata" muted playsinline aria-hidden="true"></video>`) + `<span class="play-badge">${icon('play', { size: 26 })}</span>`
            : img(x.media, x.title, { w: 1200, h: 800 })}
        </button>
        <div class="card-body">
          <p class="meta"><span class="tag tag-cat">${e(x.category)}</span>${x.date ? `<time datetime="${e(x.date)}">${e(fmtDate(x.date))}</time>` : ''}</p>
          <h3>${e(x.title)}</h3>
          ${x.description ? `<p>${e(x.description)}</p>` : ''}
        </div>
      </article>`;
      }).join('')}
    </div>`;
}

function testimonialCard(t) {
  return `<figure class="card testimonial">
      ${t.example ? '<span class="tag tag-example">Ejemplo ilustrativo</span>' : ''}
      <span class="quote-mark" aria-hidden="true">${icon('quote', { size: 28 })}</span>
      <blockquote><p>${e(t.comment)}</p></blockquote>
      <figcaption>
        ${t.photo ? img(t.photo, t.name, { cls: 'avatar' }) : `<span class="avatar avatar-initials" aria-hidden="true">${e((t.name || '?').trim().charAt(0))}</span>`}
        <span><strong>${e(t.name)}</strong><small>${e(t.relation)}${t.date ? ' · ' + e(fmtDate(t.date)) : ''}</small></span>
      </figcaption>
    </figure>`;
}

function testimonialCarousel(list) {
  return `<div class="carousel reveal" data-carousel aria-roledescription="carrusel" aria-label="Testimonios">
      <div class="carousel-viewport">
        <ul class="carousel-track">
          ${list.map((t, i) => `<li class="carousel-slide" aria-roledescription="testimonio" aria-label="${i + 1} de ${list.length}">${testimonialCard(t)}</li>`).join('')}
        </ul>
      </div>
      <div class="carousel-controls">
        <button type="button" class="icon-btn" data-prev aria-label="Testimonio anterior">${icon('chevron-left')}</button>
        <div class="carousel-dots" role="tablist" aria-label="Seleccionar testimonio"></div>
        <button type="button" class="icon-btn" data-next aria-label="Testimonio siguiente">${icon('chevron-right')}</button>
      </div>
    </div>`;
}

function faqAccordion(v, list) {
  return `<div class="accordion reveal">
      ${list.map((f, i) => `<div class="acc-item">
        <h2><button type="button" class="acc-btn" aria-expanded="false" aria-controls="faq-${i}" id="faq-btn-${i}">
          <span>${e(f.question)}</span><span class="acc-icon" aria-hidden="true">${icon('chevron-down', { size: 20 })}</span>
        </button></h2>
        <div class="acc-panel" id="faq-${i}" role="region" aria-labelledby="faq-btn-${i}" hidden><div class="rich">${v.rich(f.answer)}</div></div>
      </div>`).join('')}
    </div>`;
}

function contactList(v) {
  const S = v.S;
  return `<ul class="contact-list">
        ${S.address ? `<li>${icon('map-pin', { size: 20 })}<span>${S.maps_url ? `<a href="${e(S.maps_url)}" target="_blank" rel="noopener noreferrer">${e(S.address)}</a>` : e(S.address)}</span></li>` : ''}
        ${lines(S.phones).length ? `<li>${icon('phone', { size: 20 })}<span>${lines(S.phones).map((p) => `<a href="tel:${e(p.replace(/[^\d+]/g, ''))}">${e(p)}</a>`).join('<br>')}</span></li>` : ''}
        ${S.email ? `<li>${icon('mail', { size: 20 })}<span><a href="mailto:${e(S.email)}">${e(S.email)}</a></span></li>` : ''}
        ${lines(S.hours).length ? `<li>${icon('clock', { size: 20 })}<span>${lines(S.hours).map(e).join('<br>')}</span></li>` : ''}
      </ul>`;
}

function bookingForm(v) {
  const b = v.c.booking || {};
  const services = v.pub('services').map((x) => x.title);
  const slots = lines(b.time_slots);
  const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); // Hora de Colombia (UTC-5)
  return `<form class="card booking-form reveal" id="booking-form" novalidate aria-label="Formulario de agendamiento de visitas">
      <h2 class="form-title">Solicita tu visita</h2>
      <div class="form-grid">
        <div class="field span-2">
          <label for="bf-name">Nombre completo <span aria-hidden="true">*</span></label>
          <input id="bf-name" name="name" type="text" autocomplete="name" required maxlength="120">
          <p class="field-error" id="bf-name-err" aria-live="polite"></p>
        </div>
        <div class="field">
          <label for="bf-phone">Número de teléfono <span aria-hidden="true">*</span></label>
          <input id="bf-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30">
          <p class="field-error" id="bf-phone-err" aria-live="polite"></p>
        </div>
        <div class="field">
          <label for="bf-email">Correo electrónico <span aria-hidden="true">*</span></label>
          <input id="bf-email" name="email" type="email" autocomplete="email" required maxlength="160">
          <p class="field-error" id="bf-email-err" aria-live="polite"></p>
        </div>
        <div class="field span-2">
          <label for="bf-service">Servicio de interés <span aria-hidden="true">*</span></label>
          <select id="bf-service" name="service" required>
            <option value="">Selecciona un servicio</option>
            ${services.map((x) => `<option>${e(x)}</option>`).join('')}
            <option>Otro / Quiero más información</option>
          </select>
          <p class="field-error" id="bf-service-err" aria-live="polite"></p>
        </div>
        <div class="field">
          <label for="bf-date">Fecha preferida <span aria-hidden="true">*</span></label>
          <input id="bf-date" name="date" type="date" min="${today}" required>
          <p class="field-error" id="bf-date-err" aria-live="polite"></p>
        </div>
        <div class="field">
          <label for="bf-time">Horario preferido <span aria-hidden="true">*</span></label>
          <select id="bf-time" name="time" required>
            <option value="">Selecciona un horario</option>
            ${slots.map((x) => `<option>${e(x)}</option>`).join('')}
          </select>
          <p class="field-error" id="bf-time-err" aria-live="polite"></p>
        </div>
        <div class="field span-2">
          <label for="bf-message">Mensaje adicional <small>(opcional)</small></label>
          <textarea id="bf-message" name="message" rows="4" maxlength="1000"></textarea>
        </div>
        <div class="field field-hp" aria-hidden="true">
          <label for="bf-website">No llenar este campo</label>
          <input id="bf-website" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>
        <div class="field span-2">
          <label class="check">
            <input type="checkbox" name="consent" id="bf-consent" required>
            <span class="rich">${v.rich(b.consent_text)}</span>
          </label>
          <p class="field-error" id="bf-consent-err" aria-live="polite"></p>
        </div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('send', { size: 18 })}<span>Solicitar visita</span></button>
      <p class="form-note">La visita queda sujeta a verificación de disponibilidad. Te contactaremos para confirmarla.</p>
      <div class="form-status" role="status" aria-live="polite"></div>
    </form>`;
}

// ---------------- Páginas ----------------
function pageInicio(v) {
  const out = [renderHero(v)];
  const home = v.c.home || {};
  if (v.pageOn('nosotros')) {
    const list = v.pub('benefits').slice(0, 3);
    if (list.length) out.push(`<section class="section" aria-labelledby="nosotros-title"><div class="container">${sectionHead(v, { ...v.c.benefits, intro: '' }, 'nosotros')}${benefitCards(v, list)}${moreLink(v, 'nosotros', 'Conoce más sobre nosotros')}</div></section>`);
  }
  if (v.pageOn('servicios')) {
    const s = v.c.services || {};
    const list = v.pub('services');
    if (list.length) out.push(`<section class="section section-alt" aria-labelledby="servicios-title"><div class="container">${sectionHead(v, s, 'servicios')}${serviceCards(v, list, true)}${moreLink(v, 'servicios', 'Ver todos los servicios')}</div></section>`);
  }
  if (v.pageOn('instalaciones')) {
    const list = v.pub('facilities').slice(0, 4);
    if (list.length) out.push(`<section class="section" aria-labelledby="instalaciones-title"><div class="container">${sectionHead(v, v.c.facilities, 'instalaciones')}${galleryGrid(list)}${moreLink(v, 'instalaciones', 'Ver todas las instalaciones')}</div></section>`);
  }
  if (v.pageOn('experiencias')) {
    const list = sortedExperiences(v).slice(0, 3);
    if (list.length) out.push(`<section class="section section-alt" aria-labelledby="experiencias-title"><div class="container">${sectionHead(v, v.c.experiences, 'experiencias')}${experienceCards(list)}${moreLink(v, 'experiencias', 'Ver todas las experiencias')}</div></section>`);
  }
  if (v.pageOn('testimonios')) {
    const list = v.pub('testimonials').slice(0, 2);
    if (list.length) out.push(`<section class="section" aria-labelledby="testimonios-title"><div class="container">${sectionHead(v, v.c.testimonials, 'testimonios')}<div class="grid grid-2">${list.map((t) => `<div class="reveal">${testimonialCard(t)}</div>`).join('')}</div>${moreLink(v, 'testimonios', 'Ver todos los testimonios')}</div></section>`);
  }
  const cta = v.links.header_cta;
  if (v.pageOn('contacto') || v.pageOn('preguntas')) {
    out.push(`<section class="cta-band" aria-labelledby="cta-title"><div class="container cta-inner reveal">
      <div><h2 id="cta-title">${e(home.cta_title || '¿Quieres conocernos?')}</h2>${home.cta_text ? `<p>${e(home.cta_text)}</p>` : ''}</div>
      <div class="cta-actions">
        ${v.pageOn('contacto') && cta ? `<a class="btn btn-light btn-lg" ${linkAttrs(v, cta)}>${icon('calendar', { size: 18 })}${e(cta.text)}</a>` : ''}
        ${v.pageOn('preguntas') ? `<a class="btn btn-ghost-light btn-lg" href="${e(v.href('/preguntas-frecuentes'))}">${icon('help-circle', { size: 18 })}Preguntas frecuentes</a>` : ''}
      </div>
    </div></section>`);
  }
  return out.join('\n');
}

function pageNosotros(v) {
  return `${pageBanner(v, 'nosotros', v.c.benefits)}
<section class="section"><div class="container">${benefitCards(v, v.pub('benefits'))}</div></section>`;
}

function pageServicios(v) {
  return `${pageBanner(v, 'servicios', v.c.services)}
<section class="section"><div class="container">${serviceCards(v, v.pub('services'), false)}${complementaryBlock(v)}</div></section>`;
}

function pageInstalaciones(v) {
  const list = v.pub('facilities');
  const cats = v.pub('facility_categories').map((c) => c.name).filter((c) => list.some((f) => f.category === c));
  return `${pageBanner(v, 'instalaciones', v.c.facilities)}
<section class="section"><div class="container">${filterChips('facilities', cats, 'Filtrar instalaciones por categoría')}${galleryGrid(list)}${tourButton(v)}</div></section>`;
}

function pageExperiencias(v) {
  const list = sortedExperiences(v);
  const cats = v.pub('experience_categories').map((c) => c.name).filter((c) => list.some((x) => x.category === c));
  return `${pageBanner(v, 'experiencias', v.c.experiences)}
<section class="section"><div class="container">${filterChips('experiences', cats, 'Filtrar experiencias por categoría')}${experienceCards(list)}</div></section>`;
}

function pageTestimonios(v) {
  const list = v.pub('testimonials');
  return `${pageBanner(v, 'testimonios', v.c.testimonials)}
<section class="section"><div class="container">${list.length ? testimonialCarousel(list) : '<p class="center lead">Pronto compartiremos las experiencias de nuestras familias.</p>'}</div></section>`;
}

function pagePreguntas(v) {
  return `${pageBanner(v, 'preguntas', v.c.faq)}
<section class="section"><div class="container narrow">${faqAccordion(v, v.pub('faqs'))}
${v.pageOn('contacto') ? `<p class="center faq-more">¿No encontraste tu respuesta? <a href="${e(v.href('/contacto'))}">Contáctanos</a>.</p>` : ''}</div></section>`;
}

function pageContacto(v) {
  return `${pageBanner(v, 'contacto', v.c.booking)}
<section class="section booking" id="agendar" aria-label="Agendamiento de visitas">
  <div class="container booking-grid">
    <div class="booking-info reveal">
      <h2>Información de contacto</h2>
      ${contactList(v)}
      ${v.pageOn('preguntas') ? `<p class="booking-faq">${icon('help-circle', { size: 18 })}<span>¿Tienes dudas? Revisa nuestras <a href="${e(v.href('/preguntas-frecuentes'))}">preguntas frecuentes</a>.</span></p>` : ''}
    </div>
    ${bookingForm(v)}
  </div>
</section>`;
}

const PAGE_RENDER = {
  inicio: pageInicio, nosotros: pageNosotros, servicios: pageServicios, instalaciones: pageInstalaciones,
  experiencias: pageExperiencias, testimonios: pageTestimonios, preguntas: pagePreguntas, contacto: pageContacto
};

// ---------------- Pie de página y elementos flotantes ----------------
function renderFooter(v) {
  const f = v.c.footer || {};
  const S = v.S;
  const menu = menuLinks(v);
  const social = v.pub('links').filter((l) => l.group === 'Redes sociales');
  const wa = waUrl(S);
  const legal = [v.links.footer_privacy, v.links.footer_data].filter(Boolean);
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-col">
      <a href="${e(v.href('/'))}" class="footer-brand" aria-label="Ir al inicio">${img(v.B.logo_dark, S.name || 'Seniors', { w: 900, h: 300 })}</a>
      <p>${e(f.description)}</p>
    </div>
    <nav class="footer-col" aria-label="Navegación del pie de página">
      <h2>${e(f.nav_title || 'Navegación')}</h2>
      <ul>
        ${menu.map((l) => `<li><a ${linkAttrs(v, l)}>${e(l.text || l.label)}</a></li>`).join('')}
        ${v.pageOn('preguntas') ? `<li><a href="${e(v.href('/preguntas-frecuentes'))}">Preguntas frecuentes</a></li>` : ''}
      </ul>
    </nav>
    <div class="footer-col">
      <h2>${e(f.contact_title || 'Contacto')}</h2>
      <ul class="footer-contact">
        ${S.address ? `<li>${icon('map-pin', { size: 18 })}${S.maps_url ? `<a href="${e(S.maps_url)}" target="_blank" rel="noopener noreferrer">${e(S.address)}</a>` : `<span>${e(S.address)}</span>`}</li>` : ''}
        ${lines(S.phones).map((p) => `<li>${icon('phone', { size: 18 })}<a href="tel:${e(p.replace(/[^\d+]/g, ''))}">${e(p)}</a></li>`).join('')}
        ${S.email ? `<li>${icon('mail', { size: 18 })}<a href="mailto:${e(S.email)}">${e(S.email)}</a></li>` : ''}
        ${lines(S.hours).length ? `<li>${icon('clock', { size: 18 })}<span>${lines(S.hours).map(e).join('<br>')}</span></li>` : ''}
      </ul>
    </div>
    <div class="footer-col">
      <h2>${e(f.social_title || 'Síguenos')}</h2>
      <ul class="social">
        ${social.map((l) => `<li><a ${linkAttrs(v, l)} aria-label="${e(l.text || l.label)}">${icon(l.icon || 'globe', { size: 20 })}<span>${e(l.text || l.label)}</span></a></li>`).join('')}
        ${wa ? `<li><a href="${e(wa)}" target="_blank" rel="noopener noreferrer">${icon('whatsapp', { size: 20 })}<span>WhatsApp</span></a></li>` : ''}
      </ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>${e(String(f.copyright || '').replace('{año}', year))}</p>
    <ul>${legal.map((l) => `<li><a ${linkAttrs(v, l)}>${e(l.text)}</a></li>`).join('')}</ul>
  </div>
</footer>`;
}

function renderWidgets(v, pageKey) {
  const S = v.S;
  const wa = waUrl(S);
  const usesServices = pageKey === 'servicios';
  const usesTour = pageKey === 'instalaciones' && !v.hidden.has('tour');
  const usesLightbox = ['inicio', 'instalaciones', 'experiencias'].includes(pageKey);
  return `
${wa ? `<a class="wa-float" href="${e(wa)}" target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">${icon('whatsapp', { size: 28, stroke: 1.9 })}</a>` : ''}
<button class="chat-launcher" type="button" aria-expanded="false" aria-controls="chat-panel" aria-label="Abrir chat de atención">${icon('message', { size: 26 })}</button>
<section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
  <header class="chat-head">
    <span class="chat-avatar">${img(v.B.isotype || v.B.favicon, '', {})}</span>
    <div><h2 id="chat-title">${e(S.chat_name || 'Seniors')}</h2><p><span class="dot"></span>Chat de atención · demostración</p></div>
    <button type="button" class="icon-btn chat-close" aria-label="Cerrar chat">${icon('x', { size: 20 })}</button>
  </header>
  <div class="chat-body" aria-live="polite"></div>
  <div class="chat-quick" aria-label="Preguntas sugeridas"></div>
  <form class="chat-form" autocomplete="off">
    <label class="sr-only" for="chat-input">Escribe tu mensaje</label>
    <input id="chat-input" type="text" placeholder="Escribe tu mensaje…" maxlength="300">
    <button type="submit" class="icon-btn send" aria-label="Enviar mensaje">${icon('send', { size: 20 })}</button>
  </form>
</section>

${usesLightbox ? `<div class="lightbox" role="dialog" aria-modal="true" aria-label="Visor de imágenes" hidden>
  <button type="button" class="icon-btn lb-close" aria-label="Cerrar">${icon('x')}</button>
  <button type="button" class="icon-btn lb-prev" aria-label="Anterior">${icon('chevron-left')}</button>
  <figure class="lb-figure"><div class="lb-media"></div><figcaption class="lb-caption"></figcaption></figure>
  <button type="button" class="icon-btn lb-next" aria-label="Siguiente">${icon('chevron-right')}</button>
  <p class="lb-counter" aria-live="polite"></p>
</div>` : ''}

${usesServices ? `<div class="modal" id="service-modal" role="dialog" aria-modal="true" aria-labelledby="service-modal-title" hidden>
  <div class="modal-card">
    <button type="button" class="icon-btn modal-close" aria-label="Cerrar">${icon('x')}</button>
    <div class="modal-content" id="service-modal-title"></div>
    ${v.pageOn('contacto') ? `<a class="btn btn-primary" href="${e(v.href('/contacto#agendar'))}">${icon('calendar', { size: 18 })}Agenda una visita</a>` : ''}
  </div>
</div>` : ''}

${usesTour ? `<div class="tour" id="recorrido" role="dialog" aria-modal="true" aria-labelledby="tour-title" hidden>
  <div class="tour-card">
    <header class="tour-head">
      <div><p class="eyebrow">${icon('compass', { size: 16 })} ${e((v.c.tour || {}).title || 'Recorrido virtual')}</p><h2 id="tour-title"></h2></div>
      <button type="button" class="icon-btn tour-close" aria-label="Cerrar recorrido">${icon('x')}</button>
    </header>
    <div class="tour-stage" tabindex="0" aria-label="Vista panorámica. Usa las flechas izquierda y derecha para girar.">
      <div class="tour-pano"></div>
      <div class="tour-hint">${icon('arrows', { size: 16 })} Arrastra para mirar alrededor</div>
      <div class="tour-controls">
        <button type="button" class="icon-btn" data-pan="-1" aria-label="Girar a la izquierda">${icon('chevron-left')}</button>
        <button type="button" class="icon-btn" data-autoplay aria-label="Girar automáticamente" aria-pressed="false">${icon('refresh', { size: 20 })}</button>
        <button type="button" class="icon-btn" data-pan="1" aria-label="Girar a la derecha">${icon('chevron-right')}</button>
      </div>
    </div>
    <p class="tour-desc"></p>
    <div class="tour-nav">
      <button type="button" class="btn btn-soft btn-sm" data-tour-prev>${icon('chevron-left', { size: 16 })}Anterior</button>
      <ul class="tour-spaces" role="tablist" aria-label="Espacios"></ul>
      <button type="button" class="btn btn-soft btn-sm" data-tour-next>Siguiente${icon('chevron-right', { size: 16 })}</button>
    </div>
  </div>
</div>` : ''}`;
}

function siteData(v, pageKey) {
  const contactUrl = v.pageOn('contacto') ? v.href('/contacto#agendar') : '';
  const data = {
    chat: { name: v.S.chat_name || 'Seniors', welcome: v.S.chat_welcome || '', whatsapp: waUrl(v.S), phone: lines(v.S.phones)[0] || '', contactUrl },
    faqs: v.pub('faqs').map((f) => ({ q: f.question, a: stripTags(f.answer) })),
    booking: { success: (v.c.booking || {}).success_message || '' },
    galleries: {}
  };
  if (pageKey === 'inicio' || pageKey === 'instalaciones') {
    const list = pageKey === 'inicio' ? v.pub('facilities').slice(0, 4) : v.pub('facilities');
    data.galleries.facilities = list.map((f) => ({ src: f.image, title: f.title, text: f.description, cat: f.category }));
  }
  if (pageKey === 'inicio' || pageKey === 'experiencias') {
    const list = pageKey === 'inicio' ? sortedExperiences(v).slice(0, 3) : sortedExperiences(v);
    data.galleries.experiences = list.map((x) => ({ src: x.media, poster: x.poster, video: isVideo(x.media), title: x.title, text: x.description, cat: x.category, date: fmtDate(x.date) }));
  }
  if (pageKey === 'instalaciones' && !v.hidden.has('tour')) data.tour = v.pub('tour').map((t) => ({ image: t.image, title: t.title, description: t.description }));
  return data;
}

function head(v, o) {
  const seo = v.c.seo || {};
  const title = o.title ? `${o.title} · ${v.S.short_name || 'Seniors'}` : seo.title || v.S.name;
  const desc = o.description || seo.description || '';
  const siteUrl = String(seo.site_url || '').replace(/\/$/, '');
  const ogImg = seo.og_image ? (siteUrl ? siteUrl + seo.og_image : seo.og_image) : '';
  const ld = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: v.S.name, description: seo.description,
    address: v.S.address, telephone: lines(v.S.phones)[0], email: v.S.email, url: siteUrl || undefined, image: ogImg || undefined
  };
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
${o.preview ? '<meta name="robots" content="noindex, nofollow">' : ''}
${siteUrl ? `<link rel="canonical" href="${e(siteUrl + (o.path || '/'))}">` : ''}
<meta name="theme-color" content="#52665D">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_CO">
<meta property="og:site_name" content="${e(v.S.name || 'Seniors')}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
${ogImg ? `<meta property="og:image" content="${e(ogImg)}">` : ''}
${siteUrl ? `<meta property="og:url" content="${e(siteUrl + (o.path || '/'))}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="${e(v.B.favicon || '/brand/favicon-192.png')}">
<link rel="apple-touch-icon" href="${e(v.B.favicon || '/brand/favicon-180.png')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Lora:ital,wght@0,500;0,600;0,700;1,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/site.css?v=${ASSET_VERSION}">
${!o.title ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>`;
}

function previewBar(o) {
  if (!o.preview) return '';
  return `<div class="preview-bar" role="status">${icon('eye', { size: 16 })}<span><strong>Vista previa.</strong> ${e(o.previewLabel || 'Estos cambios aún no están publicados.')}</span></div>`;
}

function layout(v, o, pageKey, mainHtml) {
  return `${head(v, o)}
<body class="page-${pageKey}${o.preview ? ' is-preview' : ''}">
<a class="skip-link" href="#contenido">Saltar al contenido</a>
${previewBar(o)}
${renderHeader(v, pageKey)}
<main id="contenido">
${mainHtml}
</main>
${renderFooter(v)}
${renderWidgets(v, pageKey)}
<script type="application/json" id="site-data">${JSON.stringify(siteData(v, pageKey)).replace(/</g, '\\u003c')}</script>
<script src="/js/site.js?v=${ASSET_VERSION}" defer></script>
</body>
</html>`;
}

/** Devuelve el HTML de una página, o null si la página no existe o está desactivada. */
function renderPage(snapshot, pageKey, opts) {
  const o = opts || {};
  const page = PAGES[pageKey];
  if (!page) return null;
  const v = view(snapshot, o);
  if (!v.pageOn(pageKey)) return null;
  const sec = page.section ? v.c[page.section] || {} : null;
  const intro = sec && sec.intro ? stripTags(sec.intro).slice(0, 160) : '';
  return layout(v, { ...o, path: page.path, title: pageKey === 'inicio' ? null : (sec && sec.title) || page.label, description: intro || undefined }, pageKey, PAGE_RENDER[pageKey](v));
}

// Compatibilidad: renderSite = página de inicio
function renderSite(snapshot, opts) { return renderPage(snapshot, 'inicio', opts); }

function renderPolicy(snapshot, kind, opts) {
  const o = opts || {};
  const v = view(snapshot, o);
  const pol = v.c.policies || {};
  const title = kind === 'privacy' ? 'Política de privacidad' : 'Política de tratamiento de datos personales';
  const html = kind === 'privacy' ? pol.privacy : pol.data;
  const oo = { ...o, title, path: kind === 'privacy' ? '/politica-de-privacidad' : '/tratamiento-de-datos' };
  return layout(v, oo, 'legal', `<section class="section">
  <article class="container narrow legal">
    <nav class="breadcrumb" aria-label="Ruta de navegación"><a href="${e(v.href('/'))}">Inicio</a><span aria-hidden="true">${icon('chevron-right', { size: 14 })}</span><span aria-current="page">${e(title)}</span></nav>
    <h1>${e(title)}</h1>
    <div class="rich">${v.rich(html)}</div>
  </article>
</section>`);
}

function renderSitemap(snapshot) {
  const seo = (snapshot.content || {}).seo || {};
  const base = String(seo.site_url || 'https://www.seniorscali.co').replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const v = view(snapshot, {});
  const urls = Object.keys(PAGES).filter((k) => v.pageOn(k)).map((k) => PAGES[k].path).concat(Object.keys(LEGAL));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${e(base + u)}</loc><lastmod>${today}</lastmod><changefreq>${LEGAL[u] ? 'yearly' : 'weekly'}</changefreq></url>`).join('\n')}
</urlset>`;
}

module.exports = { renderSite, renderPage, renderPolicy, renderSitemap, waUrl, PAGES, PAGE_BY_PATH, LEGACY };

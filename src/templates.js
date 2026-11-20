/*
 * Plantillas HTML del sitio estático. Cada página se genera en español e inglés.
 */
const C = require('./content');
const { icon } = require('./lib/icons');

const LANGS = ['es', 'en'];
const BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');

// ---------------- Utilidades ----------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isI18n = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('es' in v || 'en' in v);
const tr = (v, lang) => (isI18n(v) ? (v[lang] != null ? v[lang] : v.es) : v);
// *texto* → <em>texto</em> (cursiva destacada en títulos)
const rich = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');
const plain = (s) => String(s || '').replace(/\*/g, '');
const stripTags = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const isVideo = (u) => /\.(mp4|webm)$/i.test(u || '');
const ic = (n, size, extra) => icon(n, Object.assign({ size: size || 20 }, extra || {}));

function makeCtx(lang, pageKey, assets) {
  const t = (v) => tr(v, lang);
  const ui = (k) => tr(C.ui.t[k], lang);
  const url = (key, hash) => BASE + C.ui.pages[key][lang] + (hash ? '#' + hash : '');
  const asset = (p) => BASE + assets.file(p);
  // Reemplaza {pagina} por la dirección de esa página en el idioma actual (en textos con HTML)
  const links = (html) => String(html || '').replace(/\{(\w+)\}/g, (m, k) => (C.ui.pages[k] ? url(k) : m));
  function img(src, alt, o) {
    const opts = o || {};
    if (!src) return '';
    const m = assets.image(src);
    const attrs = [
      `src="${esc(BASE + m.src)}"`,
      m.srcset ? `srcset="${esc(m.srcset.split(', ').map((s) => BASE + s).join(', '))}" sizes="${esc(opts.sizes || '(max-width: 768px) 100vw, 50vw')}"` : '',
      `alt="${esc(alt || '')}"`,
      m.width ? `width="${m.width}" height="${m.height}"` : '',
      opts.eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"',
      opts.cls ? `class="${opts.cls}"` : ''
    ].filter(Boolean).join(' ');
    return `<img ${attrs}>`;
  }
  const imgUrl = (src) => BASE + assets.image(src).src;
  return { lang, pageKey, t, ui, url, asset, img, imgUrl, links, other: lang === 'es' ? 'en' : 'es' };
}

const waUrl = (msg) => `https://wa.me/${C.settings.whatsapp}` + (msg ? `?text=${encodeURIComponent(msg)}` : '');
const tel = (p) => 'tel:' + p.replace(/[^\d+]/g, '');

function fmtDate(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Motivo gráfico de la marca: rayos de sol del logotipo
const RAYS = `<svg class="rays" viewBox="0 0 120 70" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><path d="M10 52 30 58"/><path d="M22 22 38 38"/><path d="M52 6 56 28"/><path d="M90 8 82 30"/><path d="M112 34 96 44"/></g></svg>`;

// ---------------- Componentes ----------------
function eyebrow(c, text) { return text ? `<p class="eyebrow">${esc(c.t(text))}</p>` : ''; }

function sectionHead(c, o) {
  const id = o.id ? ` id="${o.id}"` : '';
  return `<div class="section-head${o.center ? ' is-center' : ''} reveal">
    <div>
      ${eyebrow(c, o.eyebrow)}
      <h2${id}>${rich(c.t(o.title))}</h2>
      ${o.intro ? `<p class="lead">${esc(c.t(o.intro))}</p>` : ''}
    </div>
    ${o.link ? `<a class="link-arrow" href="${esc(o.href)}">${esc(c.t(o.link))}${ic('arrow-right', 18)}</a>` : ''}
  </div>`;
}

function pageHero(c, data, extra) {
  const pageName = c.t(C.ui.pages[c.pageKey].menu);
  return `<section class="page-hero" aria-labelledby="page-title">
  <div class="page-hero-bg" aria-hidden="true"><span class="ph-arch"></span>${RAYS}</div>
  <div class="container">
    <nav class="breadcrumb" aria-label="${esc(c.ui('breadcrumb'))}"><a href="${esc(c.url('home'))}">${esc(c.ui('home'))}</a>${ic('chevron-right', 14)}<span aria-current="page">${esc(pageName)}</span></nav>
    ${eyebrow(c, data.eyebrow)}
    <h1 id="page-title">${rich(c.t(data.title))}</h1>
    ${data.intro ? `<p class="lead">${esc(c.t(data.intro))}</p>` : ''}
    ${extra || ''}
  </div>
</section>`;
}

function ctaBand(c) {
  const h = C.home.cta;
  return `<section class="cta-band" aria-labelledby="cta-title">
  <div class="container cta-inner reveal">
    ${RAYS}
    <div class="cta-copy"><h2 id="cta-title">${rich(c.t(h.title))}</h2><p>${esc(c.t(h.text))}</p></div>
    <div class="cta-actions">
      <a class="btn btn-light btn-lg" href="${esc(c.url('contact', 'agendar'))}">${ic('calendar', 18)}<span>${esc(c.ui('bookVisit'))}</span></a>
      ${c.pageKey !== 'faq' ? `<a class="btn btn-ghost-light btn-lg" href="${esc(c.url('faq'))}">${ic('help-circle', 18)}<span>${esc(c.t(h.faq))}</span></a>` : ''}
    </div>
  </div>
</section>`;
}

function benefitCard(c, b, i) {
  return `<article class="benefit reveal" style="--d:${i * 70}ms">
    <span class="benefit-icon">${ic(b.icon, 26)}</span>
    <h3>${esc(c.t(b.title))}</h3>
    <p>${esc(c.t(b.text))}</p>
  </article>`;
}

function serviceCard(c, s, i) {
  return `<article class="service-card reveal" style="--d:${i * 90}ms">
    <a class="service-link" href="${esc(c.url('services', s.id))}">
      <div class="service-media">${c.img(s.image, c.t(s.imageAlt), { sizes: '(max-width: 768px) 100vw, 33vw' })}<span class="service-num">${String(i + 1).padStart(2, '0')}</span></div>
      <div class="service-body">
        <h3>${esc(c.t(s.title))}</h3>
        <p>${esc(c.t(s.text))}</p>
        <span class="link-arrow">${esc(c.ui('learnMore'))}${ic('arrow-right', 18)}</span>
      </div>
    </a>
  </article>`;
}

function galleryItem(c, p, i, cls) {
  const title = c.t(p.title);
  const cat = c.t(C.facilities.categories[p.category]);
  return `<li class="gallery-item reveal${cls ? ' ' + cls : ''}" data-cat="${esc(p.category)}" style="--d:${(i % 6) * 60}ms">
    <button type="button" class="gallery-btn" data-lightbox="facilities" data-index="${i}" aria-label="${esc(c.ui('enlarge'))}: ${esc(title)}">
      ${c.img(p.image, title, { sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw' })}
      <span class="gallery-caption"><strong>${esc(title)}</strong><small>${esc(cat)}</small></span>
      <span class="gallery-zoom" aria-hidden="true">${ic('expand', 18)}</span>
    </button>
  </li>`;
}

function sortedExperiences() {
  return C.experiences.items.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function experienceCard(c, x, i) {
  const vid = isVideo(x.media);
  const title = c.t(x.title);
  return `<article class="exp-card reveal" data-cat="${esc(x.category)}" style="--d:${(i % 6) * 70}ms">
    <button type="button" class="exp-media" data-lightbox="experiences" data-index="${i}" aria-label="${esc(vid ? c.ui('playVideo') : c.ui('enlarge'))}: ${esc(title)}">
      ${vid ? (x.poster ? c.img(x.poster, title) : `<video src="${esc(c.asset(x.media))}#t=0.5" preload="metadata" muted playsinline aria-hidden="true"></video>`) + `<span class="play-badge">${ic('play', 26)}</span>` : c.img(x.media, title, { sizes: '(max-width: 768px) 100vw, 33vw' })}
      ${x.example ? `<span class="tag tag-example">${esc(c.ui('example'))}</span>` : ''}
    </button>
    <div class="exp-body">
      <p class="meta"><span class="tag">${esc(c.t(C.experiences.categories[x.category]))}</span>${x.date ? `<time datetime="${esc(x.date)}">${esc(fmtDate(x.date, c.lang))}</time>` : ''}</p>
      <h3>${esc(title)}</h3>
      ${x.text ? `<p>${esc(c.t(x.text))}</p>` : ''}
    </div>
  </article>`;
}

function testimonialCard(c, x) {
  const name = c.t(x.name);
  return `<figure class="testimonial">
    <span class="quote-mark" aria-hidden="true">“</span>
    ${x.example ? `<span class="tag tag-example">${esc(c.ui('example'))}</span>` : ''}
    <blockquote><p>${esc(c.t(x.text))}</p></blockquote>
    <figcaption>
      ${x.photo ? c.img(x.photo, name, { cls: 'avatar' }) : `<span class="avatar avatar-initials" aria-hidden="true">${esc(String(name).trim().charAt(0))}</span>`}
      <span><strong>${esc(name)}</strong><small>${esc(c.t(x.relation))}${x.date ? ' · ' + esc(fmtDate(x.date, c.lang)) : ''}</small></span>
    </figcaption>
  </figure>`;
}

function testimonialCarousel(c) {
  const list = C.testimonials.items;
  if (!list.length) return `<p class="lead center">${esc(c.ui('noTestimonials'))}</p>`;
  return `<div class="carousel reveal" data-carousel aria-roledescription="carousel" aria-label="${esc(c.t(C.testimonials.eyebrow))}">
    <div class="carousel-viewport"><ul class="carousel-track">
      ${list.map((x, i) => `<li class="carousel-slide" aria-label="${i + 1} / ${list.length}">${testimonialCard(c, x)}</li>`).join('')}
    </ul></div>
    <div class="carousel-controls">
      <button type="button" class="icon-btn" data-prev aria-label="${esc(c.ui('prevTestimonial'))}">${ic('chevron-left')}</button>
      <div class="carousel-dots" role="tablist" aria-label="${esc(c.ui('goToTestimonial'))}" data-label="${esc(c.ui('goToTestimonial'))}"></div>
      <button type="button" class="icon-btn" data-next aria-label="${esc(c.ui('nextTestimonial'))}">${ic('chevron-right')}</button>
    </div>
  </div>`;
}

function chips(c, name, cats, used) {
  const keys = Object.keys(cats).filter((k) => used.includes(k));
  if (keys.length < 2) return '';
  return `<div class="chips reveal" role="toolbar" aria-label="${esc(c.ui('filterBy'))}" data-filter-group="${name}">
    <button type="button" class="chip is-active" data-filter="*" aria-pressed="true">${esc(c.ui('all'))}</button>
    ${keys.map((k) => `<button type="button" class="chip" data-filter="${esc(k)}" aria-pressed="false">${esc(c.t(cats[k]))}</button>`).join('')}
  </div>`;
}

function contactList(c) {
  const S = C.settings;
  return `<ul class="contact-list">
    <li><span class="ci">${ic('map-pin', 20)}</span><div><small>${esc(c.ui('address'))}</small><a href="${esc(S.mapsUrl)}" target="_blank" rel="noopener noreferrer">${esc(S.address)}</a></div></li>
    <li><span class="ci">${ic('phone', 20)}</span><div><small>${esc(c.ui('phones'))}</small>${S.phones.map((p) => `<a href="${esc(tel(p))}">${esc(p)}</a>`).join('')}</div></li>
    <li><span class="ci">${ic('mail', 20)}</span><div><small>${esc(c.ui('email'))}</small><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></div></li>
    <li><span class="ci">${ic('clock', 20)}</span><div><small>${esc(c.ui('hours'))}</small>${c.t(S.hours).map((h) => `<span>${esc(h)}</span>`).join('')}</div></li>
  </ul>`;
}

// ---------------- Encabezado y pie ----------------
function header(c) {
  const menu = Object.entries(C.ui.pages).filter(([, p]) => !p.hideInMenu);
  const langSwitch = LANGS.map((l) => {
    const active = l === c.lang;
    const href = BASE + C.ui.pages[c.pageKey === '404' ? 'home' : c.pageKey][l];
    return `<a href="${esc(href)}" hreflang="${l}" lang="${l}"${active ? ' class="is-active" aria-current="true"' : ''} title="${esc(C.ui.languages[l].label)}">${C.ui.languages[l].short}</a>`;
  }).join('');
  return `<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="${esc(c.url('home'))}" aria-label="${esc(C.settings.shortName)} — ${esc(c.ui('goHome'))}">
      ${c.img(C.settings.brand.logoLight, C.settings.name, { eager: true, cls: 'brand-logo', sizes: '200px' })}
    </a>
    <nav class="main-nav" id="main-nav" aria-label="${esc(c.ui('mainNav'))}">
      <ul>
        ${menu.map(([k, p]) => `<li><a href="${esc(c.url(k))}"${k === c.pageKey ? ' class="is-active" aria-current="page"' : ''}>${esc(c.t(p.menu))}</a></li>`).join('')}
      </ul>
      <div class="nav-mobile-extra">
        <div class="lang-switch" role="group" aria-label="${esc(c.ui('language'))}">${langSwitch}</div>
        <a class="btn btn-primary btn-block" href="${esc(c.url('contact', 'agendar'))}">${ic('calendar', 18)}<span>${esc(c.ui('bookVisit'))}</span></a>
      </div>
    </nav>
    <div class="header-actions">
      <div class="lang-switch lang-desktop" role="group" aria-label="${esc(c.ui('language'))}">${langSwitch}</div>
      <a class="btn btn-primary header-cta" href="${esc(c.url('contact', 'agendar'))}">${ic('calendar', 18)}<span>${esc(c.ui('bookVisit'))}</span></a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="${esc(c.ui('menuOpen'))}" data-open="${esc(c.ui('menuOpen'))}" data-close="${esc(c.ui('menuClose'))}">
        <span class="bar"></span><span class="bar"></span><span class="bar"></span>
      </button>
    </div>
  </div>
</header>`;
}

function footer(c) {
  const S = C.settings;
  const menu = Object.entries(C.ui.pages).filter(([k]) => !['privacy', 'data'].includes(k));
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <a href="${esc(c.url('home'))}" aria-label="${esc(c.ui('goHome'))}">${c.img(S.brand.logoDark, S.name, { sizes: '240px' })}</a>
      <p>${esc(c.t(C.home.about.intro))}</p>
      <a class="btn btn-whatsapp" href="${esc(waUrl(c.t(S.whatsappMessage)))}" target="_blank" rel="noopener noreferrer">${ic('whatsapp', 18)}<span>WhatsApp</span></a>
    </div>
    <nav class="footer-col" aria-label="${esc(c.ui('navigation'))}">
      <h2>${esc(c.ui('navigation'))}</h2>
      <ul>${menu.map(([k, p]) => `<li><a href="${esc(c.url(k))}">${esc(c.t(p.menu))}</a></li>`).join('')}</ul>
    </nav>
    <div class="footer-col">
      <h2>${esc(c.ui('contactInfo'))}</h2>
      <ul class="footer-contact">
        <li>${ic('map-pin', 18)}<a href="${esc(S.mapsUrl)}" target="_blank" rel="noopener noreferrer">${esc(S.address)}</a></li>
        ${S.phones.map((p) => `<li>${ic('phone', 18)}<a href="${esc(tel(p))}">${esc(p)}</a></li>`).join('')}
        <li>${ic('mail', 18)}<a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>
        <li>${ic('clock', 18)}<span>${c.t(S.hours).map(esc).join('<br>')}</span></li>
      </ul>
    </div>
    <div class="footer-col">
      <h2>${esc(c.ui('followUs'))}</h2>
      <ul class="social">${S.social.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${ic(s.icon, 20)}<span>${esc(s.name)}</span></a></li>`).join('')}</ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>© ${year} ${esc(S.name)}. ${esc(c.ui('rights'))}</p>
    <ul>
      <li><a href="${esc(c.url('privacy'))}">${esc(c.t(C.ui.pages.privacy.menu))}</a></li>
      <li><a href="${esc(c.url('data'))}">${esc(c.t(C.ui.pages.data.menu))}</a></li>
    </ul>
  </div>
</footer>`;
}

function widgets(c) {
  const S = C.settings;
  const lb = ['home', 'facilities', 'experiences'].includes(c.pageKey);
  return `<a class="wa-float" href="${esc(waUrl(c.t(S.whatsappMessage)))}" target="_blank" rel="noopener noreferrer" aria-label="${esc(c.ui('whatsappLabel'))}">${ic('whatsapp', 28, { stroke: 1.9 })}</a>
<button class="chat-launcher" type="button" aria-expanded="false" aria-controls="chat-panel" aria-label="${esc(c.ui('chatOpen'))}">${ic('message', 26)}</button>
<section class="chat-panel" id="chat-panel" role="dialog" aria-modal="false" aria-labelledby="chat-title" hidden>
  <header class="chat-head">
    <img src="${esc(c.asset('brand/favicon-64.png'))}" alt="" width="40" height="40" loading="lazy">
    <div><h2 id="chat-title">${esc(S.shortName)}</h2><p><span class="dot"></span>${esc(c.ui('chatSubtitle'))}</p></div>
    <button type="button" class="icon-btn chat-close" aria-label="${esc(c.ui('chatClose'))}">${ic('x', 20)}</button>
  </header>
  <div class="chat-body" aria-live="polite"></div>
  <div class="chat-quick" aria-label="${esc(c.ui('chatSuggested'))}"></div>
  <form class="chat-form" autocomplete="off">
    <label class="sr-only" for="chat-input">${esc(c.ui('chatPlaceholder'))}</label>
    <input id="chat-input" type="text" placeholder="${esc(c.ui('chatPlaceholder'))}" maxlength="300">
    <button type="submit" class="icon-btn send" aria-label="${esc(c.ui('chatSend'))}">${ic('send', 20)}</button>
  </form>
</section>
${lb ? `<div class="lightbox" role="dialog" aria-modal="true" aria-label="${esc(c.ui('imageViewer'))}" hidden>
  <button type="button" class="icon-btn lb-close" aria-label="${esc(c.ui('close'))}">${ic('x')}</button>
  <button type="button" class="icon-btn lb-prev" aria-label="${esc(c.ui('previous'))}">${ic('chevron-left')}</button>
  <figure class="lb-figure"><div class="lb-media"></div><figcaption class="lb-caption"></figcaption></figure>
  <button type="button" class="icon-btn lb-next" aria-label="${esc(c.ui('next'))}">${ic('chevron-right')}</button>
  <p class="lb-counter" aria-live="polite"></p>
</div>` : ''}`;
}

// Datos que necesita el JavaScript de la página
function pageData(c) {
  const d = {
    lang: c.lang,
    whatsapp: C.settings.whatsapp,
    phone: C.settings.phones[0],
    contactUrl: c.url('contact', 'agendar'),
    formEndpoint: C.settings.form.endpoint || '',
    i18n: {},
    faqs: C.faq.items.map((f) => ({ q: c.t(f.q), a: stripTags(c.links(c.t(f.a))) })),
    galleries: {}
  };
  ['fSending', 'fSubmit', 'eName', 'ePhone', 'eEmail', 'eService', 'eDate', 'eDatePast', 'eTime', 'eConsent', 'eSend', 'okWhatsapp', 'waGreeting',
    'fName', 'fPhone', 'fEmail', 'fService', 'fDate', 'fTime', 'fMessage',
    'chatHello', 'chatThanks', 'chatBook', 'chatBookLink', 'chatFallback', 'chatOr', 'menuOpen', 'menuClose'].forEach((k) => { d.i18n[k] = c.ui(k); });
  d.i18n.success = c.t(C.contact.success);
  const photoData = (list) => list.map((p) => ({ src: c.imgUrl(p.image), title: c.t(p.title), cat: c.t(C.facilities.categories[p.category]) }));
  const expData = (list) => list.map((x) => ({ src: isVideo(x.media) ? c.asset(x.media) : c.imgUrl(x.media), poster: x.poster ? c.imgUrl(x.poster) : '', video: isVideo(x.media), title: c.t(x.title), text: c.t(x.text), cat: c.t(C.experiences.categories[x.category]), date: fmtDate(x.date, c.lang) }));
  if (c.pageKey === 'home') { d.galleries.facilities = photoData(C.facilities.photos.slice(0, 5)); d.galleries.experiences = expData(sortedExperiences().slice(0, 3)); }
  if (c.pageKey === 'facilities') {
    d.galleries.facilities = photoData(C.facilities.photos);
    d.tour = C.facilities.tour.spaces.map((s) => ({ image: c.imgUrl(s.image), title: c.t(s.title), text: c.t(s.text) }));
  }
  if (c.pageKey === 'experiences') d.galleries.experiences = expData(sortedExperiences());
  return d;
}

// ---------------- Páginas ----------------
const PAGES = {
  home(c) {
    const H = C.home.hero;
    const T = C.home.teasers;
    return {
      seo: C.home.seo,
      main: `<section class="hero" aria-labelledby="hero-title">
  <div class="hero-bg" aria-hidden="true"></div>
  <div class="container hero-grid">
    <div class="hero-copy">
      <p class="chip-eyebrow"><span class="dot"></span>${esc(c.t(H.eyebrow))}</p>
      <h1 id="hero-title">${rich(c.t(H.title))}</h1>
      <p class="hero-lead">${esc(c.t(H.description))}</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="${esc(c.url('services'))}"><span>${esc(c.t(H.primary))}</span>${ic('arrow-right', 18)}</a>
        <a class="btn btn-outline btn-lg" href="${esc(c.url('contact', 'agendar'))}">${ic('calendar', 18)}<span>${esc(c.t(H.secondary))}</span></a>
      </div>
    </div>
    <div class="hero-visual">
      ${RAYS}
      <figure class="hero-arch">${c.img(H.image, c.t(H.imageAlt), { eager: true, sizes: '(max-width: 900px) 90vw, 45vw' })}</figure>
      <div class="float-card fc-top"><span class="fc-icon">${ic('heart', 20)}</span><strong>${esc(c.t(H.badge))}</strong></div>
      <a class="float-card fc-bottom" href="${esc(c.url('contact', 'agendar'))}"><span class="fc-icon">${ic('calendar', 20)}</span><span><strong>${esc(c.t(H.visitNote.title))}</strong><small>${esc(c.t(H.visitNote.text))}</small></span></a>
    </div>
  </div>
  <div class="container">
    <dl class="stats-strip">
      ${H.highlights.map((h) => `<div><dt>${esc(c.t(h.value))}</dt><dd>${esc(c.t(h.label))}</dd></div>`).join('')}
    </dl>
  </div>
</section>

<section class="section" aria-labelledby="about-title">
  <div class="container split">
    <div class="split-copy reveal">
      ${eyebrow(c, T.about.eyebrow)}
      <h2 id="about-title">${rich(c.t(T.about.title))}</h2>
      <p class="lead">${esc(c.t(C.home.about.intro))}</p>
      <a class="link-arrow" href="${esc(c.url('about'))}">${esc(c.t(T.about.link))}${ic('arrow-right', 18)}</a>
    </div>
    <div class="benefit-grid compact">${C.home.about.benefits.slice(0, 4).map((b, i) => benefitCard(c, b, i)).join('')}</div>
  </div>
</section>

<section class="section section-tint" aria-labelledby="services-title">
  <div class="container">
    ${sectionHead(c, { id: 'services-title', eyebrow: T.services.eyebrow, title: T.services.title, link: T.services.link, href: c.url('services') })}
    <div class="service-grid">${C.services.main.map((s, i) => serviceCard(c, s, i)).join('')}</div>
  </div>
</section>

<section class="section" aria-labelledby="facilities-title">
  <div class="container">
    ${sectionHead(c, { id: 'facilities-title', eyebrow: T.facilities.eyebrow, title: T.facilities.title, link: T.facilities.link, href: c.url('facilities') })}
    <ul class="gallery bento">${C.facilities.photos.slice(0, 5).map((p, i) => galleryItem(c, p, i, i === 0 ? 'is-large' : '')).join('')}</ul>
  </div>
</section>

<section class="section section-tint" aria-labelledby="experiences-title">
  <div class="container">
    ${sectionHead(c, { id: 'experiences-title', eyebrow: T.experiences.eyebrow, title: T.experiences.title, link: T.experiences.link, href: c.url('experiences') })}
    <div class="exp-grid">${sortedExperiences().slice(0, 3).map((x, i) => experienceCard(c, x, i)).join('')}</div>
  </div>
</section>

<section class="section" aria-labelledby="testimonials-title">
  <div class="container">
    ${sectionHead(c, { id: 'testimonials-title', eyebrow: T.testimonials.eyebrow, title: T.testimonials.title, link: T.testimonials.link, href: c.url('testimonials') })}
    ${testimonialCarousel(c)}
  </div>
</section>
${ctaBand(c)}`
    };
  },

  about(c) {
    const A = C.home.about;
    return {
      seo: A.seo,
      main: `${pageHero(c, A)}
<section class="section">
  <div class="container split split-media">
    <figure class="media-arch reveal">${c.img('images/nosotros.svg', '', { sizes: '(max-width: 900px) 100vw, 45vw' })}</figure>
    <div class="split-copy reveal">
      <h2>${rich(c.t(A.story.title))}</h2>
      ${c.t(A.story.paragraphs).map((p) => `<p>${esc(p)}</p>`).join('')}
      <dl class="stats-inline">${C.home.hero.highlights.map((h) => `<div><dt>${esc(c.t(h.value))}</dt><dd>${esc(c.t(h.label))}</dd></div>`).join('')}</dl>
    </div>
  </div>
</section>
<section class="section section-tint" aria-labelledby="benefits-title">
  <div class="container">
    ${sectionHead(c, { id: 'benefits-title', title: A.benefitsTitle, center: true })}
    <div class="benefit-grid">${A.benefits.map((b, i) => benefitCard(c, b, i)).join('')}</div>
  </div>
</section>
${ctaBand(c)}`
    };
  },

  services(c) {
    const S = C.services;
    const incl = S.complementary.filter((x) => x.included);
    const extra = S.complementary.filter((x) => !x.included);
    const compList = (list) => `<ul class="comp-list">${list.map((x) => `<li><span class="comp-icon">${ic(x.icon, 20)}</span><div><h4>${esc(c.t(x.title))}</h4><p>${esc(c.t(x.text))}</p></div></li>`).join('')}</ul>`;
    return {
      seo: S.seo,
      main: `${pageHero(c, S)}
<section class="section">
  <div class="container features">
    ${S.main.map((s, i) => `<article class="feature${i % 2 ? ' is-reverse' : ''}" id="${esc(s.id)}">
      <figure class="feature-media reveal">${c.img(s.image, c.t(s.imageAlt), { sizes: '(max-width: 900px) 100vw, 50vw' })}<span class="service-num">${String(i + 1).padStart(2, '0')}</span></figure>
      <div class="feature-copy reveal">
        <h2>${esc(c.t(s.title))}</h2>
        <p class="lead">${esc(c.t(s.text))}</p>
        <ul class="check-list">${c.t(s.points).map((p) => `<li>${ic('check', 18)}<span>${esc(p)}</span></li>`).join('')}</ul>
        <a class="btn btn-primary" href="${esc(c.url('contact', 'agendar'))}">${ic('calendar', 18)}<span>${esc(c.ui('bookVisit'))}</span></a>
      </div>
    </article>`).join('')}
  </div>
</section>
<section class="section section-tint" aria-labelledby="comp-title">
  <div class="container">
    ${sectionHead(c, { id: 'comp-title', title: S.complementaryTitle, intro: S.complementaryIntro, center: true })}
    <div class="comp-columns">
      <div class="comp-panel reveal"><h3><span class="tag tag-incl">${esc(c.ui('included'))}</span></h3>${compList(incl)}</div>
      <div class="comp-panel reveal"><h3><span class="tag tag-extra">${esc(c.ui('additional'))}</span></h3>${compList(extra)}</div>
    </div>
  </div>
</section>
${ctaBand(c)}`
    };
  },

  facilities(c) {
    const F = C.facilities;
    const used = [...new Set(F.photos.map((p) => p.category))];
    const tour = F.tour;
    return {
      seo: F.seo,
      main: `${pageHero(c, F, `<a class="btn btn-outline" href="#recorrido">${ic('compass', 18)}<span>${esc(c.t(tour.eyebrow))}</span></a>`)}
<section class="section">
  <div class="container">
    ${chips(c, 'facilities', F.categories, used)}
    <ul class="gallery" data-filter-target="facilities">${F.photos.map((p, i) => galleryItem(c, p, i)).join('')}</ul>
  </div>
</section>
${tour.spaces.length ? `<section class="section section-tint tour-section" id="recorrido" aria-labelledby="tour-title">
  <div class="container">
    ${sectionHead(c, { id: 'tour-title', eyebrow: tour.eyebrow, title: tour.title, intro: tour.intro, center: true })}
    <div class="tour reveal" data-tour>
      <div class="tour-stage" tabindex="0" aria-label="${esc(c.ui('tourStage'))}">
        <div class="tour-pano" role="img" aria-label=""></div>
        <div class="tour-hint">${ic('arrows', 16)} ${esc(c.ui('tourDrag'))}</div>
        <div class="tour-controls">
          <button type="button" class="icon-btn" data-pan="-1" aria-label="${esc(c.ui('tourLeft'))}">${ic('chevron-left')}</button>
          <button type="button" class="icon-btn" data-autoplay aria-label="${esc(c.ui('tourAuto'))}" aria-pressed="false">${ic('refresh', 20)}</button>
          <button type="button" class="icon-btn" data-pan="1" aria-label="${esc(c.ui('tourRight'))}">${ic('chevron-right')}</button>
        </div>
      </div>
      <div class="tour-info"><h3 class="tour-name"></h3><p class="tour-desc"></p></div>
      <ul class="tour-spaces" role="tablist" aria-label="${esc(c.ui('tourSpaces'))}">
        ${tour.spaces.map((s, i) => `<li><button type="button" role="tab" aria-selected="${i === 0}" data-space="${i}"><span class="thumb">${c.img(s.image, '', { sizes: '160px' })}</span><span>${esc(c.t(s.title))}</span></button></li>`).join('')}
      </ul>
    </div>
  </div>
</section>` : ''}
${ctaBand(c)}`
    };
  },

  experiences(c) {
    const E = C.experiences;
    const list = sortedExperiences();
    const used = [...new Set(list.map((x) => x.category))];
    return {
      seo: E.seo,
      main: `${pageHero(c, E)}
<section class="section">
  <div class="container">
    ${chips(c, 'experiences', E.categories, used)}
    <div class="exp-grid" data-filter-target="experiences">${list.map((x, i) => experienceCard(c, x, i)).join('')}</div>
  </div>
</section>
${ctaBand(c)}`
    };
  },

  testimonials(c) {
    return {
      seo: C.testimonials.seo,
      main: `${pageHero(c, C.testimonials)}
<section class="section"><div class="container">${testimonialCarousel(c)}</div></section>
${ctaBand(c)}`
    };
  },

  faq(c) {
    const F = C.faq;
    return {
      seo: F.seo,
      main: `${pageHero(c, F)}
<section class="section">
  <div class="container faq-layout">
    <div class="accordion">
      ${F.items.map((f, i) => `<div class="acc-item reveal" style="--d:${i * 40}ms">
        <h2><button type="button" class="acc-btn" aria-expanded="false" aria-controls="faq-${i}" id="faq-btn-${i}"><span>${esc(c.t(f.q))}</span><span class="acc-icon" aria-hidden="true">${ic('plus', 20)}</span></button></h2>
        <div class="acc-panel" id="faq-${i}" role="region" aria-labelledby="faq-btn-${i}" hidden><div class="rich">${c.links(c.t(f.a))}</div></div>
      </div>`).join('')}
    </div>
    <aside class="help-card reveal">
      <span class="help-icon">${ic('message', 26)}</span>
      <h2>${esc(c.ui('faqMore'))}</h2>
      ${contactList(c)}
      <a class="btn btn-primary btn-block" href="${esc(c.url('contact', 'agendar'))}">${ic('calendar', 18)}<span>${esc(c.ui('bookVisit'))}</span></a>
      <a class="btn btn-whatsapp btn-block" href="${esc(waUrl(c.t(C.settings.whatsappMessage)))}" target="_blank" rel="noopener noreferrer">${ic('whatsapp', 18)}<span>WhatsApp</span></a>
    </aside>
  </div>
</section>`
    };
  },

  contact(c) {
    const K = C.contact;
    const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
    const consent = c.t(K.consent).replace('{data}', esc(c.url('data')));
    const field = (id, label, input, cls) => `<div class="field${cls ? ' ' + cls : ''}"><label for="bf-${id}">${label}</label>${input}<p class="field-error" id="bf-${id}-err" aria-live="polite"></p></div>`;
    const req = ' <span class="req" aria-hidden="true">*</span>';
    return {
      seo: K.seo,
      main: `${pageHero(c, K)}
<section class="section contact-section" id="agendar">
  <div class="container contact-grid">
    <aside class="contact-card reveal">
      <h2>${esc(c.ui('contactInfo'))}</h2>
      ${contactList(c)}
      <div class="contact-actions">
        <a class="btn btn-whatsapp" href="${esc(waUrl(c.t(C.settings.whatsappMessage)))}" target="_blank" rel="noopener noreferrer">${ic('whatsapp', 18)}<span>WhatsApp</span></a>
        <a class="btn btn-outline-light" href="${esc(C.settings.mapsUrl)}" target="_blank" rel="noopener noreferrer">${ic('map-pin', 18)}<span>${esc(c.ui('openMap'))}</span></a>
      </div>
      <p class="contact-faq">${ic('help-circle', 18)}<a href="${esc(c.url('faq'))}">${esc(c.t(C.ui.pages.faq.menu))}</a></p>
    </aside>
    <form class="booking-form reveal" id="booking-form" novalidate aria-labelledby="form-title">
      <h2 id="form-title">${esc(c.ui('formTitle'))}</h2>
      <div class="form-grid">
        ${field('name', esc(c.ui('fName')) + req, '<input id="bf-name" name="name" type="text" autocomplete="name" required maxlength="120">', 'span-2')}
        ${field('phone', esc(c.ui('fPhone')) + req, '<input id="bf-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30">')}
        ${field('email', esc(c.ui('fEmail')) + req, '<input id="bf-email" name="email" type="email" autocomplete="email" required maxlength="160">')}
        ${field('service', esc(c.ui('fService')) + req, `<select id="bf-service" name="service" required><option value="">${esc(c.ui('fServicePick'))}</option>${C.services.main.map((s) => `<option>${esc(c.t(s.title))}</option>`).join('')}<option>${esc(c.ui('fServiceOther'))}</option></select>`, 'span-2')}
        ${field('date', esc(c.ui('fDate')) + req, `<input id="bf-date" name="date" type="date" min="${today}" required>`)}
        ${field('time', esc(c.ui('fTime')) + req, `<select id="bf-time" name="time" required><option value="">${esc(c.ui('fTimePick'))}</option>${c.t(K.timeSlots).map((s) => `<option>${esc(s)}</option>`).join('')}</select>`)}
        <div class="field span-2"><label for="bf-message">${esc(c.ui('fMessage'))} <small>(${esc(c.ui('optional'))})</small></label><textarea id="bf-message" name="message" rows="4" maxlength="1000"></textarea></div>
        <div class="field field-hp" aria-hidden="true"><label for="bf-website">${esc(c.ui('fHoneypot'))}</label><input id="bf-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <div class="field span-2">
          <label class="check"><input type="checkbox" name="consent" id="bf-consent" required><span>${consent}</span></label>
          <p class="field-error" id="bf-consent-err" aria-live="polite"></p>
        </div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${ic(C.settings.form.endpoint ? 'send' : 'whatsapp', 18)}<span>${esc(c.ui('fSubmit'))}</span></button>
      <p class="form-note">${esc(c.ui(C.settings.form.endpoint ? 'fNote' : 'fNoteWhatsapp'))}</p>
      <div class="form-status" role="status" aria-live="polite"></div>
    </form>
  </div>
</section>`
    };
  },

  privacy(c) { return legalPage(c, C.legal.privacy); },
  data(c) { return legalPage(c, C.legal.data); }
};

function legalPage(c, L) {
  return {
    seo: { title: L.title, description: { es: '', en: '' } },
    main: `${pageHero(c, { title: L.title })}
<section class="section"><article class="container narrow legal rich">${c.t(L.html)}</article></section>`
  };
}

function notFound(c) {
  return {
    seo: { title: C.ui.t.notFoundTitle, description: C.ui.t.notFoundText },
    main: `<section class="section not-found"><div class="container narrow center">
  ${RAYS}
  <p class="eyebrow">404</p>
  <h1>${esc(c.ui('notFoundTitle'))}</h1>
  <p class="lead">${esc(c.ui('notFoundText'))}</p>
  <a class="btn btn-primary btn-lg" href="${esc(c.url('home'))}">${ic('home', 18)}<span>${esc(c.ui('home'))}</span></a>
</div></section>`
  };
}

// ---------------- Documento ----------------
function documentHtml(c, page, assets, opts) {
  const S = C.settings;
  const seo = page.seo || {};
  const isHome = c.pageKey === 'home';
  const titleTxt = plain(c.t(seo.title));
  const title = isHome ? titleTxt : `${titleTxt} · ${S.shortName}`;
  const desc = c.t(seo.description) || c.t(C.home.seo.description);
  const site = S.siteUrl.replace(/\/$/, '');
  const canonical = c.pageKey === '404' ? '' : site + BASE + C.ui.pages[c.pageKey][c.lang];
  const alternates = c.pageKey === '404' ? '' : LANGS.map((l) => `<link rel="alternate" hreflang="${C.ui.languages[l].htmlLang}" href="${esc(site + BASE + C.ui.pages[c.pageKey][l])}">`).join('\n') +
    `\n<link rel="alternate" hreflang="x-default" href="${esc(site + BASE + C.ui.pages[c.pageKey].es)}">`;
  const shareImg = site + BASE + assets.image(S.shareImage).src;
  const ld = isHome ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: S.name, description: desc, url: site + BASE + C.ui.pages.home[c.lang],
    telephone: S.phones[0], email: S.email, image: shareImg, sameAs: S.social.map((s) => s.url),
    address: { '@type': 'PostalAddress', streetAddress: 'Carrera 115A # 16-115', addressLocality: 'Cali', addressRegion: 'Valle del Cauca', addressCountry: 'CO' }
  }).replace(/</g, '\\u003c')}</script>` : '';
  const heroPreload = isHome ? `<link rel="preload" as="image" href="${esc(c.imgUrl(C.home.hero.image))}"${assets.image(C.home.hero.image).srcset ? ` imagesrcset="${esc(assets.image(C.home.hero.image).srcset.split(', ').map((s) => BASE + s).join(', '))}" imagesizes="(max-width: 900px) 90vw, 45vw"` : ''}>` : '';
  return `<!doctype html>
<html lang="${C.ui.languages[c.lang].htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>document.documentElement.className+=' js'</script>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '<meta name="robots" content="noindex">'}
${alternates}
<meta name="theme-color" content="#52665D">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.name)}">
<meta property="og:locale" content="${C.ui.languages[c.lang].locale}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(shareImg)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="${esc(c.asset(S.brand.favicon32))}">
<link rel="icon" type="image/png" sizes="192x192" href="${esc(c.asset(S.brand.favicon))}">
<link rel="apple-touch-icon" href="${esc(c.asset(S.brand.appleIcon))}">
<link rel="manifest" href="${BASE}/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Lora:ital,wght@0,500;0,600;1,500;1,600&display=swap">
${heroPreload}
<link rel="stylesheet" href="${esc(opts.css)}">
${ld}
</head>
<body class="page-${c.pageKey}">
<a class="skip-link" href="#contenido">${esc(c.ui('skip'))}</a>
${header(c)}
<main id="contenido">
${page.main}
</main>
${footer(c)}
${widgets(c)}
<script type="application/json" id="page-data">${JSON.stringify(pageData(c)).replace(/</g, '\\u003c')}</script>
<script src="${esc(opts.js)}" defer></script>
</body>
</html>`;
}

/** Devuelve [{ path, html }] con todas las páginas en ambos idiomas. */
function renderAll(assets, opts) {
  const out = [];
  for (const lang of LANGS) {
    for (const key of Object.keys(C.ui.pages)) {
      const c = makeCtx(lang, key, assets);
      out.push({ path: C.ui.pages[key][lang], html: documentHtml(c, PAGES[key](c), assets, opts) });
    }
  }
  // Página 404 (en español con enlace al inglés en el selector)
  const c404 = makeCtx('es', '404', assets);
  out.push({ path: '/404.html', html: documentHtml(c404, notFound(c404), assets, opts) });
  return out;
}

function sitemap() {
  const site = C.settings.siteUrl.replace(/\/$/, '') + BASE;
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  for (const key of Object.keys(C.ui.pages)) {
    for (const lang of LANGS) {
      const alts = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${C.ui.languages[l].htmlLang}" href="${esc(site + C.ui.pages[key][l])}"/>`).join('');
      urls.push(`<url><loc>${esc(site + C.ui.pages[key][lang])}</loc><lastmod>${today}</lastmod>${alts}</url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

module.exports = { renderAll, sitemap, BASE };

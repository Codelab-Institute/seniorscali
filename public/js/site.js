/* Seniors · interacciones del sitio público */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let DATA = {};
  try { DATA = JSON.parse(($('#site-data') || {}).textContent || '{}'); } catch (e) { DATA = {}; }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Bloqueo de desplazamiento y foco para ventanas ----------
  let lastFocus = null;
  function openLayer(el, focusSel) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    const f = focusSel ? $(focusSel, el) : el.querySelector('button, a, [tabindex]');
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeLayer(el) {
    el.hidden = true;
    if (!$$('.lightbox:not([hidden]), .modal:not([hidden]), .tour:not([hidden])').length) document.documentElement.style.overflow = '';
    $$('video', el).forEach((v) => v.pause());
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function trapFocus(el, e) {
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]), a[href], input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])', el).filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- Encabezado ----------
  const header = $('.site-header');
  const nav = $('#main-nav');
  const toggle = $('.menu-toggle');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  if (toggle) toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  if (nav) nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });
  document.addEventListener('click', (e) => { if (nav && nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1024) setMenu(false); });

  // Enlace activo según la sección visible
  const navLinks = $$('[data-nav]');
  const targets = navLinks.map((a) => { const h = a.getAttribute('href'); return h && h.startsWith('#') ? document.getElementById(h.slice(1)) : null; });
  if ('IntersectionObserver' in window && targets.some(Boolean)) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a, i) => a.classList.toggle('is-active', targets[i] === en.target));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.filter(Boolean).forEach((t) => io.observe(t));
  }

  // Al abrir con #seccion, reajustar la posición cuando terminan de cargar las imágenes
  if (location.hash.length > 1) {
    window.addEventListener('load', () => {
      const t = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView({ behavior: 'auto' });
    });
  }

  // ---------- Animaciones de entrada ----------
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const ro = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); ro.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((r) => ro.observe(r));
  } else reveals.forEach((r) => r.classList.add('is-visible'));

  // ---------- Filtros por categoría ----------
  $$('[data-filter-group]').forEach((group) => {
    const target = $(`[data-filter-target="${group.dataset.filterGroup}"]`);
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      $$('.chip', group).forEach((c) => { c.classList.toggle('is-active', c === btn); c.setAttribute('aria-pressed', String(c === btn)); });
      const f = btn.dataset.filter;
      $$('[data-cat]', target).forEach((el) => {
        const show = f === '*' || el.dataset.cat === f;
        el.classList.toggle('is-hidden', !show);
        if (show) el.classList.add('is-visible');
      });
    });
  });

  // ---------- Visor de imágenes y videos ----------
  const lb = $('.lightbox');
  let lbList = [], lbIdx = 0;
  function visibleIndexes(group) {
    const btns = $$(`[data-lightbox="${group}"]`);
    return btns.filter((b) => !b.closest('.is-hidden')).map((b) => Number(b.dataset.index));
  }
  let lbOrder = [];
  function lbRender() {
    const item = lbList[lbOrder[lbIdx]];
    if (!item) return;
    const media = $('.lb-media', lb);
    media.innerHTML = item.video
      ? `<video src="${esc(item.src)}" controls playsinline autoplay ${item.poster ? `poster="${esc(item.poster)}"` : ''}></video>`
      : `<img src="${esc(item.src)}" alt="${esc(item.title)}">`;
    $('.lb-caption', lb).innerHTML = `<strong>${esc(item.title)}</strong><span>${esc([item.cat, item.date].filter(Boolean).join(' · '))}</span>${item.text ? `<span style="display:block;margin-top:6px">${esc(item.text)}</span>` : ''}`;
    $('.lb-counter', lb).textContent = `${lbIdx + 1} / ${lbOrder.length}`;
    const multi = lbOrder.length > 1;
    $('.lb-prev', lb).hidden = !multi; $('.lb-next', lb).hidden = !multi;
  }
  function lbOpen(group, index) {
    lbList = (DATA.galleries || {})[group] || [];
    lbOrder = visibleIndexes(group);
    lbIdx = Math.max(0, lbOrder.indexOf(index));
    lbRender();
    openLayer(lb, '.lb-close');
  }
  function lbStep(d) { $$('video', lb).forEach((v) => v.pause()); lbIdx = (lbIdx + d + lbOrder.length) % lbOrder.length; lbRender(); }
  if (lb) {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lightbox]');
      if (b) lbOpen(b.dataset.lightbox, Number(b.dataset.index));
    });
    $('.lb-close', lb).addEventListener('click', () => closeLayer(lb));
    $('.lb-prev', lb).addEventListener('click', () => lbStep(-1));
    $('.lb-next', lb).addEventListener('click', () => lbStep(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLayer(lb); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeLayer(lb);
      else if (e.key === 'ArrowLeft') lbStep(-1);
      else if (e.key === 'ArrowRight') lbStep(1);
      trapFocus(lb, e);
    });
    swipe($('.lb-figure', lb), (dir) => lbStep(dir));
  }

  function swipe(el, cb) {
    if (!el) return;
    let x0 = null, y0 = null;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) cb(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  // ---------- Ventana de servicio («Conocer más») ----------
  const modal = $('#service-modal');
  if (modal) {
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-service]');
      if (!b) return;
      const tpl = document.getElementById('service-' + b.dataset.service);
      $('.modal-content', modal).innerHTML = '';
      if (tpl) $('.modal-content', modal).appendChild(tpl.content.cloneNode(true));
      openLayer(modal, '.modal-close');
    });
    $('.modal-close', modal).addEventListener('click', () => closeLayer(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close-modal]')) closeLayer(modal); });
    modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLayer(modal); trapFocus(modal, e); });
  }

  // ---------- Carrusel de testimonios ----------
  $$('[data-carousel]').forEach((car) => {
    const track = $('.carousel-track', car);
    const slides = $$('.carousel-slide', car);
    const dotsWrap = $('.carousel-dots', car);
    let idx = 0, timer = null;
    const perView = () => (window.innerWidth > 860 ? 2 : 1);
    const pages = () => Math.max(1, slides.length - perView() + 1);
    function go(i) {
      const n = pages();
      idx = (i + n) % n;
      track.style.transform = `translateX(-${(100 / perView()) * idx}%)`;
      slides.forEach((s, k) => {
        const vis = k >= idx && k < idx + perView();
        s.setAttribute('aria-hidden', String(!vis));
        $$('a, button', s).forEach((x) => (x.tabIndex = vis ? 0 : -1));
      });
      $$('button', dotsWrap).forEach((d, k) => d.setAttribute('aria-selected', String(k === idx)));
    }
    function buildDots() {
      dotsWrap.innerHTML = '';
      for (let k = 0; k < pages(); k++) {
        const d = document.createElement('button');
        d.type = 'button'; d.setAttribute('role', 'tab'); d.setAttribute('aria-label', 'Ir al testimonio ' + (k + 1));
        d.addEventListener('click', () => { go(k); stop(); });
        dotsWrap.appendChild(d);
      }
      const hide = pages() <= 1;
      $('.carousel-controls', car).style.display = hide ? 'none' : '';
      go(Math.min(idx, pages() - 1));
    }
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { if (!reduced && pages() > 1) { stop(); timer = setInterval(() => go(idx + 1), 7000); } };
    $('[data-prev]', car).addEventListener('click', () => { go(idx - 1); stop(); });
    $('[data-next]', car).addEventListener('click', () => { go(idx + 1); stop(); });
    car.addEventListener('mouseenter', stop);
    car.addEventListener('focusin', stop);
    swipe($('.carousel-viewport', car), (d) => { go(idx + d); stop(); });
    let lastPV = perView();
    window.addEventListener('resize', () => { if (perView() !== lastPV) { lastPV = perView(); buildDots(); } });
    buildDots();
    start();
  });

  // ---------- Preguntas frecuentes (acordeón) ----------
  $$('.acc-btn').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const item = btn.closest('.acc-item');
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      item.classList.toggle('is-open', !open);
      if (reduced) { panel.hidden = open; return; }
      panel.classList.add('is-anim');
      if (!open) {
        panel.hidden = false;
        const h = panel.scrollHeight;
        panel.style.height = '0px';
        requestAnimationFrame(() => { panel.style.height = h + 'px'; });
      } else {
        panel.style.height = panel.scrollHeight + 'px';
        requestAnimationFrame(() => { panel.style.height = '0px'; });
      }
      panel.addEventListener('transitionend', function te() {
        panel.removeEventListener('transitionend', te);
        if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true;
        panel.style.height = '';
        panel.classList.remove('is-anim');
      });
    });
  });

  // ---------- Formulario de agendamiento ----------
  const form = $('#booking-form');
  if (form) {
    const status = $('.form-status', form);
    const showErr = (name, msg) => {
      const input = form.elements[name];
      const p = $(`#bf-${name}-err`, form);
      if (p) p.textContent = msg || '';
      if (input && input.closest) {
        input.closest('.field').classList.toggle('has-error', !!msg);
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (p) input.setAttribute('aria-describedby', p.id);
      }
    };
    const today = () => {
      const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 10);
    };
    function validate() {
      const f = form.elements;
      const errs = {};
      if (f.name.value.trim().length < 3) errs.name = 'Ingresa tu nombre completo.';
      const ph = f.phone.value.trim();
      if (!/^\+?[\d\s()-]{7,20}$/.test(ph) || ph.replace(/\D/g, '').length < 7) errs.phone = 'Ingresa un número de teléfono válido.';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(f.email.value.trim())) errs.email = 'Ingresa un correo electrónico válido.';
      if (!f.service.value) errs.service = 'Selecciona un servicio.';
      if (!f.date.value) errs.date = 'Selecciona una fecha.';
      else if (f.date.value < (f.date.min || today())) errs.date = 'La fecha no puede ser anterior a hoy.';
      if (!f.time.value) errs.time = 'Selecciona un horario.';
      if (!f.consent.checked) errs.consent = 'Debes aceptar la política de tratamiento de datos.';
      ['name', 'phone', 'email', 'service', 'date', 'time', 'consent'].forEach((n) => showErr(n, errs[n]));
      return errs;
    }
    $$('input, select, textarea', form).forEach((el) => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur', () => {
      if (form.dataset.tried) validate();
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      form.dataset.tried = '1';
      status.className = 'form-status'; status.textContent = '';
      const errs = validate();
      const first = Object.keys(errs)[0];
      if (first) { form.elements[first].focus(); return; }
      const btn = $('button[type="submit"]', form);
      btn.disabled = true; $('span', btn).textContent = 'Enviando…';
      const f = form.elements;
      const payload = { name: f.name.value, phone: f.phone.value, email: f.email.value, service: f.service.value, date: f.date.value, time: f.time.value, message: f.message.value, consent: f.consent.checked, website: f.website.value };
      try {
        const res = await fetch('/api/visitas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (json.errors) Object.entries(json.errors).forEach(([k, v]) => showErr(k, v));
          throw new Error(json.error || 'No se pudo enviar la solicitud.');
        }
        form.reset();
        delete form.dataset.tried;
        status.className = 'form-status ok';
        status.textContent = (DATA.booking && DATA.booking.success) || '¡Gracias! Recibimos tu solicitud. Te contactaremos para confirmar la disponibilidad.';
        status.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      } catch (err) {
        status.className = 'form-status err';
        status.textContent = err.message + ' Inténtalo nuevamente.';
      } finally {
        btn.disabled = false; $('span', btn).textContent = 'Solicitar visita';
      }
    });
  }

  // ---------- Chat de atención (demostración) ----------
  const launcher = $('.chat-launcher');
  const panel = $('#chat-panel');
  if (launcher && panel) {
    const body = $('.chat-body', panel);
    const quick = $('.chat-quick', panel);
    const input = $('#chat-input', panel);
    const chat = DATA.chat || {};
    const faqs = DATA.faqs || [];
    let started = false;
    const add = (html, who) => {
      const m = document.createElement('div');
      m.className = 'msg ' + (who === 'user' ? 'msg-user' : 'msg-bot');
      m.innerHTML = html;
      body.appendChild(m);
      body.scrollTop = body.scrollHeight;
      return m;
    };
    const botSay = (html) => {
      const t = add('<span class="msg-typing" aria-label="Escribiendo"><span></span><span></span><span></span></span>', 'bot');
      setTimeout(() => { t.innerHTML = html; body.scrollTop = body.scrollHeight; }, reduced ? 0 : 650);
    };
    const contactLine = () => {
      const parts = [];
      if (chat.whatsapp) parts.push(`<a href="${esc(chat.whatsapp)}" target="_blank" rel="noopener noreferrer">escríbenos por WhatsApp</a>`);
      if (chat.phone) parts.push(`llámanos al <a href="tel:${esc(chat.phone.replace(/[^\d+]/g, ''))}">${esc(chat.phone)}</a>`);
      return parts.length ? ' Si prefieres, ' + parts.join(' o ') + '.' : '';
    };
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ');
    const STOP = new Set(['que', 'como', 'cual', 'cuales', 'los', 'las', 'del', 'para', 'por', 'con', 'una', 'uno', 'unos', 'hay', 'son', 'puedo', 'se', 'de', 'la', 'el', 'en', 'y', 'a', 'es', 'mi', 'me', 'su', 'sus']);
    function answer(text) {
      const q = norm(text);
      if (/^(hola|buenas|buenos)/.test(q.trim())) return '¡Hola! ¿En qué podemos ayudarte? Puedes elegir una de las preguntas sugeridas.';
      if (/gracias/.test(q)) return '¡Con gusto! Estamos para acompañarte.' + contactLine();
      if (/(agendar|visita|cita|conocer)/.test(q)) return (chat.contactUrl ? `Puedes solicitar una visita en el <a href="${esc(chat.contactUrl)}" data-chat-nav>formulario de agendamiento</a>.` : 'Puedes solicitar una visita escribiéndonos.') + ' Nuestro equipo verificará la disponibilidad y te contactará para confirmarla.' + contactLine();
      const words = q.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
      let best = null, score = 0;
      faqs.forEach((f) => {
        const hay = norm(f.q + ' ' + f.a);
        const s = words.reduce((acc, w) => acc + (hay.includes(w) ? (norm(f.q).includes(w) ? 2 : 1) : 0), 0);
        if (s > score) { score = s; best = f; }
      });
      if (best && score >= 2) return esc(best.a);
      return 'Gracias por tu mensaje. Este chat es una demostración y aún no responde preguntas abiertas.' + contactLine();
    }
    function ask(text) {
      add(esc(text), 'user');
      botSay(answer(text));
    }
    function start() {
      if (started) return;
      started = true;
      botSay(esc(chat.welcome || '¡Hola! ¿En qué podemos ayudarte?'));
      faqs.slice(0, 6).forEach((f) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = f.q;
        b.addEventListener('click', () => ask(f.q));
        quick.appendChild(b);
      });
    }
    function setChat(open) {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      launcher.setAttribute('aria-label', open ? 'Cerrar chat de atención' : 'Abrir chat de atención');
      if (open) { start(); setTimeout(() => input.focus(), 50); }
    }
    launcher.addEventListener('click', () => setChat(panel.hidden));
    $('.chat-close', panel).addEventListener('click', () => { setChat(false); launcher.focus(); });
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setChat(false); launcher.focus(); } });
    body.addEventListener('click', (e) => { if (e.target.closest('[data-chat-nav]') && window.innerWidth < 640) setChat(false); });
    $('.chat-form', panel).addEventListener('submit', (e) => {
      e.preventDefault();
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      ask(t);
    });
  }

  // ---------- Recorrido virtual ----------
  const tour = $('#recorrido');
  const spaces = DATA.tour || [];
  if (tour && spaces.length) {
    const pano = $('.tour-pano', tour);
    const stage = $('.tour-stage', tour);
    const list = $('.tour-spaces', tour);
    const hint = $('.tour-hint', tour);
    const autoBtn = $('[data-autoplay]', tour);
    let cur = 0, pos = 0, imgW = 0, raf = null, auto = false;
    const imgSize = {};
    spaces.forEach((s, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button" role="tab" aria-selected="false"><span class="thumb" style="background-image:url('${encodeURI(s.image)}')"></span>${esc(s.title)}</button>`;
      $('button', li).addEventListener('click', () => show(i));
      list.appendChild(li);
    });
    function measure() {
      const s = spaces[cur];
      const r = imgSize[s.image];
      imgW = r ? stage.clientHeight * r : stage.clientWidth * 3;
    }
    function apply() { pano.style.backgroundPosition = `${-pos}px 0`; }
    function show(i) {
      cur = (i + spaces.length) % spaces.length;
      const s = spaces[cur];
      $('#tour-title', tour).textContent = s.title;
      $('.tour-desc', tour).textContent = s.description || '';
      pano.style.backgroundImage = `url('${encodeURI(s.image)}')`;
      $$('button', list).forEach((b, k) => b.setAttribute('aria-selected', String(k === cur)));
      const btn = $$('button', list)[cur];
      if (btn) btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
      pos = 0; apply();
      if (!imgSize[s.image]) {
        const im = new Image();
        im.onload = () => { imgSize[s.image] = im.naturalWidth / im.naturalHeight || 3; measure(); };
        im.src = s.image;
      } else measure();
    }
    function pan(dx) { pos += dx; if (imgW) pos = ((pos % imgW) + imgW) % imgW; apply(); }
    function loop() { pan(0.6); raf = requestAnimationFrame(loop); }
    function setAuto(on) {
      auto = on; autoBtn.setAttribute('aria-pressed', String(on));
      cancelAnimationFrame(raf);
      if (on) raf = requestAnimationFrame(loop);
    }
    let dragX = null;
    stage.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dragX = e.clientX; stage.classList.add('is-dragging'); stage.setPointerCapture(e.pointerId); setAuto(false); hint.style.opacity = '0'; });
    stage.addEventListener('pointermove', (e) => { if (dragX === null) return; pan(dragX - e.clientX); dragX = e.clientX; });
    const end = () => { dragX = null; stage.classList.remove('is-dragging'); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { pan(-60); e.preventDefault(); }
      if (e.key === 'ArrowRight') { pan(60); e.preventDefault(); }
    });
    $$('[data-pan]', tour).forEach((b) => b.addEventListener('click', () => { setAuto(false); pan(Number(b.dataset.pan) * stage.clientWidth * 0.35); }));
    autoBtn.addEventListener('click', () => setAuto(!auto));
    $('[data-tour-prev]', tour).addEventListener('click', () => show(cur - 1));
    $('[data-tour-next]', tour).addEventListener('click', () => show(cur + 1));
    window.addEventListener('resize', measure);
    const close = () => { setAuto(false); closeLayer(tour); };
    $('.tour-close', tour).addEventListener('click', close);
    tour.addEventListener('click', (e) => { if (e.target === tour) close(); });
    tour.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); trapFocus(tour, e); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-open-tour]')) return;
      openLayer(tour, '.tour-close');
      show(cur);
      hint.style.opacity = '1';
      if (!reduced) setAuto(true);
    });
  } else {
    $$('[data-open-tour]').forEach((b) => b.closest('.center') && b.closest('.center').remove());
  }
})();

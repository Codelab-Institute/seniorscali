/* Seniors · interacciones del sitio (sin dependencias) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var D = {};
  try { D = JSON.parse(($('#page-data') || {}).textContent || '{}'); } catch (e) { D = {}; }
  var T = D.i18n || {};
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ---------- Capas (visor) ----------
  var lastFocus = null;
  function openLayer(el, focusSel) {
    lastFocus = document.activeElement;
    el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var f = focusSel ? $(focusSel, el) : null;
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeLayer(el) {
    el.hidden = true;
    document.documentElement.style.overflow = '';
    $$('video', el).forEach(function (v) { v.pause(); });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function trapFocus(el, e) {
    if (e.key !== 'Tab') return;
    var f = $$('button:not([disabled]), a[href], input:not([tabindex="-1"]), select, textarea, video[controls]', el).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  function swipe(el, cb) {
    if (!el) return;
    var x0 = null, y0 = null;
    el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) cb(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  // ---------- Encabezado y menú ----------
  var header = $('.site-header');
  var nav = $('#main-nav');
  var toggle = $('.menu-toggle');
  var onScroll = function () { if (header) header.classList.toggle('is-scrolled', window.scrollY > 10); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? toggle.dataset.close : toggle.dataset.open);
    document.body.style.overflow = open && window.innerWidth <= 1180 ? 'hidden' : '';
  }
  if (toggle) toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); } });
  document.addEventListener('click', function (e) { if (nav && nav.classList.contains('is-open') && !e.target.closest('.site-header')) setMenu(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 1180 && nav && nav.classList.contains('is-open')) setMenu(false); });

  // ---------- Animaciones de entrada ----------
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (r) { io.observe(r); });
  } else reveals.forEach(function (r) { r.classList.add('is-visible'); });

  // ---------- Filtros por categoría ----------
  $$('[data-filter-group]').forEach(function (group) {
    var target = $('[data-filter-target="' + group.dataset.filterGroup + '"]');
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn) return;
      $$('.chip', group).forEach(function (c) { c.classList.toggle('is-active', c === btn); c.setAttribute('aria-pressed', String(c === btn)); });
      var f = btn.dataset.filter;
      $$('[data-cat]', target).forEach(function (el) {
        var show = f === '*' || el.dataset.cat === f;
        el.classList.toggle('is-hidden', !show);
        if (show) el.classList.add('is-visible');
      });
    });
  });

  // ---------- Visor de imágenes y videos ----------
  var lb = $('.lightbox');
  if (lb) {
    var list = [], order = [], idx = 0;
    var render = function () {
      var it = list[order[idx]];
      if (!it) return;
      $('.lb-media', lb).innerHTML = it.video
        ? '<video src="' + esc(it.src) + '" controls playsinline autoplay' + (it.poster ? ' poster="' + esc(it.poster) + '"' : '') + '></video>'
        : '<img src="' + esc(it.src) + '" alt="' + esc(it.title) + '">';
      $('.lb-caption', lb).innerHTML = '<strong>' + esc(it.title) + '</strong><span>' + esc([it.cat, it.date].filter(Boolean).join(' · ')) + '</span>';
      $('.lb-counter', lb).textContent = (idx + 1) + ' / ' + order.length;
      $('.lb-prev', lb).hidden = $('.lb-next', lb).hidden = order.length < 2;
    };
    var step = function (d) { $$('video', lb).forEach(function (v) { v.pause(); }); idx = (idx + d + order.length) % order.length; render(); };
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lightbox]');
      if (!b) return;
      var g = b.dataset.lightbox;
      list = (D.galleries || {})[g] || [];
      order = $$('[data-lightbox="' + g + '"]').filter(function (x) { return !x.closest('.is-hidden'); }).map(function (x) { return Number(x.dataset.index); });
      idx = Math.max(0, order.indexOf(Number(b.dataset.index)));
      render();
      openLayer(lb, '.lb-close');
    });
    $('.lb-close', lb).addEventListener('click', function () { closeLayer(lb); });
    $('.lb-prev', lb).addEventListener('click', function () { step(-1); });
    $('.lb-next', lb).addEventListener('click', function () { step(1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLayer(lb); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLayer(lb);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      trapFocus(lb, e);
    });
    swipe($('.lb-figure', lb), step);
  }

  // ---------- Carrusel de testimonios ----------
  $$('[data-carousel]').forEach(function (car) {
    var track = $('.carousel-track', car);
    var slides = $$('.carousel-slide', car);
    var dots = $('.carousel-dots', car);
    var i = 0, timer = null;
    var perView = function () { return window.innerWidth > 900 ? 2 : 1; };
    var pages = function () { return Math.max(1, slides.length - perView() + 1); };
    function go(n) {
      i = (n + pages()) % pages();
      track.style.transform = 'translateX(-' + (100 / perView()) * i + '%)';
      slides.forEach(function (s, k) {
        var vis = k >= i && k < i + perView();
        s.setAttribute('aria-hidden', String(!vis));
        $$('a, button', s).forEach(function (x) { x.tabIndex = vis ? 0 : -1; });
      });
      $$('button', dots).forEach(function (d, k) { d.setAttribute('aria-selected', String(k === i)); });
    }
    function build() {
      dots.innerHTML = '';
      for (var k = 0; k < pages(); k++) {
        (function (k) {
          var d = document.createElement('button');
          d.type = 'button'; d.setAttribute('role', 'tab'); d.setAttribute('aria-label', (dots.dataset.label || '') + ' ' + (k + 1));
          d.addEventListener('click', function () { go(k); stop(); });
          dots.appendChild(d);
        })(k);
      }
      $('.carousel-controls', car).style.display = pages() <= 1 ? 'none' : '';
      go(Math.min(i, pages() - 1));
    }
    var stop = function () { clearInterval(timer); timer = null; };
    $('[data-prev]', car).addEventListener('click', function () { go(i - 1); stop(); });
    $('[data-next]', car).addEventListener('click', function () { go(i + 1); stop(); });
    car.addEventListener('mouseenter', stop);
    car.addEventListener('focusin', stop);
    swipe($('.carousel-viewport', car), function (d) { go(i + d); stop(); });
    var pv = perView();
    window.addEventListener('resize', function () { if (perView() !== pv) { pv = perView(); build(); } });
    build();
    if (!reduced && pages() > 1) timer = setInterval(function () { go(i + 1); }, 7000);
  });

  // ---------- Acordeón ----------
  $$('.acc-btn').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    var item = btn.closest('.acc-item');
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      item.classList.toggle('is-open', !open);
      if (reduced) { panel.hidden = open; return; }
      panel.classList.add('is-anim');
      if (!open) {
        panel.hidden = false;
        var h = panel.scrollHeight;
        panel.style.height = '0px';
        requestAnimationFrame(function () { panel.style.height = h + 'px'; });
      } else {
        panel.style.height = panel.scrollHeight + 'px';
        requestAnimationFrame(function () { panel.style.height = '0px'; });
      }
      panel.addEventListener('transitionend', function te() {
        panel.removeEventListener('transitionend', te);
        if (btn.getAttribute('aria-expanded') === 'false') panel.hidden = true;
        panel.style.height = '';
        panel.classList.remove('is-anim');
      });
    });
  });

  // ---------- Ventanas (agendar visita y pagos) ----------
  var openModal = null;
  function showModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    if (openModal) hideModal(true);
    lastFocus = document.activeElement;
    m.hidden = false;
    openModal = m;
    document.documentElement.style.overflow = 'hidden';
    var f = $('input:not([type=hidden]):not([tabindex="-1"]), select, textarea', m);
    setTimeout(function () { (f || $('.modal-close', m)).focus(); }, 40);
  }
  function hideModal(silent) {
    if (!openModal) return;
    openModal.hidden = true;
    openModal = null;
    document.documentElement.style.overflow = '';
    if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
    if (/^#(agendar|pago)$/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  }
  $$('[data-modal-open]').forEach(function (b) { b.addEventListener('click', function () { showModal(b.dataset.modalOpen); }); });
  $$('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-modal-close]')) hideModal(); });
    m.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideModal(); trapFocus(m, e); });
  });
  // /contacto/#agendar y /contacto/#pago abren directamente el formulario
  function fromHash() {
    if (location.hash === '#agendar') showModal('booking-modal');
    if (location.hash === '#pago') showModal('payment-modal');
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);

  // Utilidades de formularios
  function fieldErrors(form, prefix) {
    return function (name, msg) {
      var input = form.elements[name], p = $('#' + prefix + '-' + name + '-err', form);
      if (p) p.textContent = msg || '';
      var box = input && (input.length && !input.tagName ? input[0] : input);
      if (box) {
        var field = box.closest('.field');
        if (field) field.classList.toggle('has-error', !!msg);
        if (input.tagName) { input.setAttribute('aria-invalid', msg ? 'true' : 'false'); if (p) input.setAttribute('aria-describedby', p.id); }
      }
    };
  }
  var isEmail = function (v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v); };
  var waLink = function (text) { return 'https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent(text); };

  // ---------- Formulario de agendamiento (se envía al correo administrativo) ----------
  var form = $('#booking-form');
  if (form) {
    var status = $('.form-status', form);
    var F = form.elements;
    var showErr = fieldErrors(form, 'bf');
    var today = function () { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
    if (F.date) F.date.min = today();
    var validate = function () {
      var e = {};
      if (F.name.value.trim().length < 3) e.name = T.eName;
      var ph = F.phone.value.trim();
      if (!/^\+?[\d\s()-]{7,20}$/.test(ph) || ph.replace(/\D/g, '').length < 7) e.phone = T.ePhone;
      if (!isEmail(F.email.value.trim())) e.email = T.eEmail;
      if (!F.service.value) e.service = T.eService;
      if (!F.date.value) e.date = T.eDate; else if (F.date.value < today()) e.date = T.eDatePast;
      if (!F.time.value) e.time = T.eTime;
      if (!F.consent.checked) e.consent = T.eConsent;
      ['name', 'phone', 'email', 'service', 'date', 'time', 'consent'].forEach(function (n) { showErr(n, e[n]); });
      return e;
    };
    $$('input, select, textarea', form).forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur', function () { if (form.dataset.tried) validate(); });
    });
    var fmtDate = function (iso) {
      var d = new Date(iso + 'T12:00:00');
      return isNaN(d) ? iso : d.toLocaleDateString(D.lang === 'en' ? 'en-US' : 'es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      form.dataset.tried = '1';
      status.className = 'form-status'; status.innerHTML = '';
      var errs = validate();
      var first = Object.keys(errs)[0];
      if (first) { F[first].focus(); return; }
      if (F.website.value) return; // trampa para bots
      var data = { name: F.name.value.trim(), phone: F.phone.value.trim(), email: F.email.value.trim(), service: F.service.value, date: F.date.value, time: F.time.value, message: F.message.value.trim() };
      var text = [T.waGreeting, '', T.fName + ': ' + data.name, T.fPhone + ': ' + data.phone, T.fEmail + ': ' + data.email,
        T.fService + ': ' + data.service, T.fDate + ': ' + fmtDate(data.date), T.fTime + ': ' + data.time]
        .concat(data.message ? [T.fMessage + ': ' + data.message] : []).join('\n');
      var showStatus = function (kind, msg, withWhatsapp) {
        status.className = 'form-status ' + kind;
        status.innerHTML = '';
        status.appendChild(document.createTextNode(msg));
        if (withWhatsapp) {
          var a = document.createElement('a');
          a.className = 'btn btn-whatsapp'; a.href = waLink(text); a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.textContent = T.sendWhatsapp;
          status.appendChild(a);
        }
        status.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
      };
      if (!D.formEndpoint) { showStatus('err', T.eNotConfigured, true); return; }
      var btn = $('button[type="submit"]', form);
      btn.disabled = true; $('span', btn).textContent = T.fSending;
      var payload = {
        _subject: (D.lang === 'en' ? 'Visit request · Seniors · ' : 'Solicitud de visita · Seniors · ') + data.name,
        _template: 'table', _captcha: 'false', _replyto: data.email
      };
      payload[T.fName] = data.name; payload[T.fPhone] = data.phone; payload[T.fEmail] = data.email; payload[T.fService] = data.service;
      payload[T.fDate] = fmtDate(data.date); payload[T.fTime] = data.time; payload[T.fMessage] = data.message || '—';
      payload[D.lang === 'en' ? 'Language' : 'Idioma'] = D.lang === 'en' ? 'English' : 'Español';
      fetch(D.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.success === false || j.success === 'false') throw new Error(); }); })
        .then(function () { form.reset(); delete form.dataset.tried; showStatus('ok', T.success); })
        .catch(function () { showStatus('err', T.eSend, true); })
        .then(function () { btn.disabled = false; $('span', btn).textContent = T.fSubmit; });
    });
  }

  // ---------- Formulario de pago (interfaz; la pasarela Wompi se conectará después) ----------
  var pay = $('#payment-form');
  if (pay && D.payment) {
    var P = pay.elements, PC = D.payment;
    var pErr = fieldErrors(pay, 'pf');
    var summary = $('#pay-summary');
    var locale = D.lang === 'en' ? 'en-US' : 'es-CO';
    var money = function (n) { return '$ ' + Number(n).toLocaleString(locale, { maximumFractionDigits: 0 }) + ' ' + PC.currency; };
    var digits = function (v) { return Number(String(v).replace(/\D/g, '')) || 0; };
    // Formato de miles mientras se escribe
    P.amount.addEventListener('input', function () {
      var n = digits(P.amount.value);
      P.amount.value = n ? n.toLocaleString(locale, { maximumFractionDigits: 0 }) : '';
    });
    var method = function () { var r = $('input[name="method"]:checked', pay); return r ? r : null; };
    // «Otro concepto» abre un campo para escribir el concepto
    var otherField = $('#pf-otherConcept-field', pay);
    var isOther = function () { return P.concept.value === '__other'; };
    P.concept.addEventListener('change', function () {
      otherField.hidden = !isOther();
      P.otherConcept.required = isOther();
      if (isOther()) P.otherConcept.focus();
      else { P.otherConcept.value = ''; pErr('otherConcept', ''); }
    });
    var conceptText = function () { return isOther() ? P.otherConcept.value.trim() : P.concept.value; };
    var pValidate = function () {
      var e = {};
      if (!P.concept.value) e.concept = T.ePConcept;
      else if (isOther() && P.otherConcept.value.trim().length < 3) e.otherConcept = T.ePOtherConcept;
      var n = digits(P.amount.value);
      if (!n || n < PC.min || n > PC.max) e.amount = T.ePAmount + ' (' + money(PC.min) + ' – ' + money(PC.max) + ').';
      if (P.name.value.trim().length < 3) e.name = T.eName;
      if (!isEmail(P.email.value.trim())) e.email = T.eEmail;
      if (!method()) e.method = T.ePMethod;
      if (!P.consent.checked) e.consent = T.eConsent;
      ['concept', 'otherConcept', 'amount', 'name', 'email', 'consent'].forEach(function (k) { pErr(k, e[k]); });
      $('#pf-method-err', pay).textContent = e.method || '';
      $('#pf-method-group', pay).classList.toggle('has-error', !!e.method);
      return e;
    };
    $$('input, select', pay).forEach(function (el) {
      el.addEventListener(el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' ? 'change' : 'blur', function () { if (pay.dataset.tried) pValidate(); });
    });
    pay.addEventListener('submit', function (ev) {
      ev.preventDefault();
      pay.dataset.tried = '1';
      var errs = pValidate();
      var first = Object.keys(errs)[0];
      if (first) { (first === 'method' ? $('input[name="method"]', pay) : P[first]).focus(); return; }
      var m = method();
      var rows = [
        [T.pConcept, conceptText()],
        [T.pAmount, money(digits(P.amount.value))],
        [T.pName, P.name.value.trim()],
        [T.pEmail, P.email.value.trim()],
        [T.pMethod, m.dataset.label]
      ];
      if (P.notes.value.trim()) rows.push([T.pNotes, P.notes.value.trim()]);
      var dl = $('.summary-list', summary);
      dl.innerHTML = '';
      rows.forEach(function (r) {
        var dt = document.createElement('dt'); dt.textContent = r[0];
        var dd = document.createElement('dd'); dd.textContent = r[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
      $('[data-pay-whatsapp]', summary).href = waLink([PC.intro, ''].concat(rows.map(function (r) { return r[0] + ': ' + r[1]; })).join('\n'));
      // Aquí se conectará Wompi (widget o checkout web) cuando esté configurado
      pay.hidden = true;
      summary.hidden = false;
      summary.focus();
    });
    $('[data-pay-edit]', summary).addEventListener('click', function () { summary.hidden = true; pay.hidden = false; P.concept.focus(); });
  }

  // ---------- Chat de atención (demostración) ----------
  var launcher = $('.chat-launcher'), panel = $('#chat-panel');
  if (launcher && panel) {
    var body = $('.chat-body', panel), quick = $('.chat-quick', panel), input = $('#chat-input', panel);
    var faqs = D.faqs || [];
    var started = false;
    var add = function (html, who) {
      var m = document.createElement('div');
      m.className = 'msg ' + (who === 'user' ? 'msg-user' : 'msg-bot');
      m.innerHTML = html;
      body.appendChild(m);
      body.scrollTop = body.scrollHeight;
      return m;
    };
    var say = function (html) {
      var t = add('<span class="msg-typing" aria-hidden="true"><span></span><span></span><span></span></span>', 'bot');
      setTimeout(function () { t.innerHTML = html; body.scrollTop = body.scrollHeight; }, reduced ? 0 : 650);
    };
    var contact = function () {
      return ' ' + esc(T.chatOr) + ' <a href="tel:' + esc((D.phone || '').replace(/[^\d+]/g, '')) + '">' + esc(D.phone) + '</a> · <a href="https://wa.me/' + esc(D.whatsapp) + '" target="_blank" rel="noopener noreferrer">WhatsApp</a>.';
    };
    var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' '); };
    var STOP = ['que', 'como', 'cual', 'cuales', 'los', 'las', 'del', 'para', 'por', 'con', 'una', 'hay', 'son', 'puedo', 'the', 'and', 'for', 'how', 'what', 'does', 'can', 'are', 'you', 'your', 'with'];
    function answer(text) {
      var q = norm(text);
      if (/^\s*(hola|buenas|buenos|hi|hello|hey)\b/.test(q)) return esc(T.chatHello);
      if (/(gracias|thank)/.test(q)) return esc(T.chatThanks);
      if (/(agendar|visita|cita|book|visit|appointment|tour)/.test(q)) return esc(T.chatBook) + ' <a href="' + esc(D.contactUrl) + '">' + esc(T.chatBookLink) + '</a>.';
      var words = q.split(/\s+/).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; });
      var best = null, score = 0;
      faqs.forEach(function (f) {
        var hay = norm(f.q + ' ' + f.a), hq = norm(f.q);
        var s = words.reduce(function (a, w) { return a + (hay.indexOf(w) >= 0 ? (hq.indexOf(w) >= 0 ? 2 : 1) : 0); }, 0);
        if (s > score) { score = s; best = f; }
      });
      if (best && score >= 2) return esc(best.a);
      return esc(T.chatFallback) + contact();
    }
    function ask(text) { add(esc(text), 'user'); say(answer(text)); }
    function setChat(open) {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      if (open) {
        if (!started) {
          started = true;
          say(esc(T.chatHello));
          faqs.slice(0, 6).forEach(function (f) {
            var b = document.createElement('button');
            b.type = 'button'; b.textContent = f.q;
            b.addEventListener('click', function () { ask(f.q); });
            quick.appendChild(b);
          });
        }
        setTimeout(function () { input.focus(); }, 50);
      }
    }
    launcher.addEventListener('click', function () { setChat(panel.hidden); });
    $('.chat-close', panel).addEventListener('click', function () { setChat(false); launcher.focus(); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setChat(false); launcher.focus(); } });
    $('.chat-form', panel).addEventListener('submit', function (e) {
      e.preventDefault();
      var t = input.value.trim();
      if (!t) return;
      input.value = '';
      ask(t);
    });
  }

  // ---------- Recorrido virtual ----------
  var tour = $('[data-tour]');
  var spaces = D.tour || [];
  if (tour && spaces.length) {
    var pano = $('.tour-pano', tour), stage = $('.tour-stage', tour), hint = $('.tour-hint', tour), autoBtn = $('[data-autoplay]', tour);
    var cur = 0, pos = 0, imgW = 0, raf = null, auto = false, ratio = {}, userStopped = false;
    var measure = function () { var r = ratio[spaces[cur].image]; imgW = r ? stage.clientHeight * r : stage.clientWidth * 3; };
    var apply = function () { pano.style.backgroundPosition = (-pos) + 'px 0'; };
    var pan = function (dx) { pos += dx; if (imgW) pos = ((pos % imgW) + imgW) % imgW; apply(); };
    function show(n) {
      cur = (n + spaces.length) % spaces.length;
      var s = spaces[cur];
      $('.tour-name', tour).textContent = s.title;
      $('.tour-desc', tour).textContent = s.text || '';
      pano.style.backgroundImage = "url('" + encodeURI(s.image) + "')";
      pano.setAttribute('aria-label', s.title);
      $$('[data-space]', tour).forEach(function (b, k) { b.setAttribute('aria-selected', String(k === cur)); });
      pos = 0; apply();
      if (!ratio[s.image]) {
        var im = new Image();
        im.onload = function () { ratio[s.image] = im.naturalWidth / im.naturalHeight || 3; measure(); };
        im.src = s.image;
      } else measure();
    }
    var loop = function () { pan(0.6); raf = requestAnimationFrame(loop); };
    var setAuto = function (on) { auto = on; autoBtn.setAttribute('aria-pressed', String(on)); cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(loop); };
    var dragX = null;
    stage.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; dragX = e.clientX; stage.classList.add('is-dragging'); stage.setPointerCapture(e.pointerId); userStopped = true; setAuto(false); hint.style.opacity = '0'; });
    stage.addEventListener('pointermove', function (e) { if (dragX === null) return; pan(dragX - e.clientX); dragX = e.clientX; });
    var end = function () { dragX = null; stage.classList.remove('is-dragging'); };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { pan(-60); e.preventDefault(); }
      if (e.key === 'ArrowRight') { pan(60); e.preventDefault(); }
    });
    $$('[data-pan]', tour).forEach(function (b) { b.addEventListener('click', function () { userStopped = true; setAuto(false); pan(Number(b.dataset.pan) * stage.clientWidth * 0.35); }); });
    autoBtn.addEventListener('click', function () { userStopped = auto; setAuto(!auto); });
    $$('[data-space]', tour).forEach(function (b) { b.addEventListener('click', function () { show(Number(b.dataset.space)); }); });
    window.addEventListener('resize', measure);
    show(0);
    // Giro automático solo mientras el recorrido está visible
    if (!reduced && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { if (en[0].isIntersecting) { if (!auto && !userStopped && dragX === null) setAuto(true); } else setAuto(false); }, { threshold: 0.4 }).observe(stage);
    }
  }
})();

/* Seniors · Panel administrativo — núcleo (API, interfaz, formularios, enrutador) */
(function () {
  'use strict';
  const SI = window.SeniorsIcons;
  const SS = window.SeniorsSchema;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ic = (n, size) => SI.icon(n, { size: size || 20 });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Constructor de elementos seguro: h('div', {class:'x', onclick: fn}, 'texto', otroNodo)
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v; // solo para contenido ya confiable (iconos o HTML saneado)
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const icEl = (n, size) => h('span', { html: ic(n, size), style: 'display:inline-flex' });

  const fmtDate = (iso, withTime) => {
    if (!iso) return '—';
    const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) + (withTime ? ' · ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '');
  };
  const relTime = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return fmtDate(iso);
  };
  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  // ---------------- Estado ----------------
  const state = { user: null, csrf: '', roles: {}, perms: [] };
  const can = (p) => state.perms.includes(p);

  // ---------------- API ----------------
  async function api(method, url, body, opts) {
    const o = opts || {};
    const init = { method, credentials: 'same-origin', headers: { 'X-CSRF-Token': state.csrf } };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    let res;
    try { res = await fetch('/api/admin' + url, init); } catch (e) { throw Object.assign(new Error('No hay conexión con el servidor. Inténtalo nuevamente.'), { network: true }); }
    if (res.status === 401) { location.href = '/admin/login?next=' + encodeURIComponent(location.pathname + location.hash); throw new Error('Sesión finalizada'); }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error || 'No se pudieron guardar los cambios. Inténtalo nuevamente.');
      Object.assign(err, { status: res.status, data: json });
      if (!o.silent && res.status !== 400 && res.status !== 409 && res.status !== 422) toast(err.message, 'err');
      throw err;
    }
    return json;
  }

  // ---------------- Avisos ----------------
  function toast(msg, type) {
    const t = h('div', { class: 'toast ' + (type || 'ok'), role: type === 'err' ? 'alert' : 'status' }, icEl(type === 'err' ? 'alert' : type === 'warn' ? 'alert' : 'check-circle', 18), h('span', {}, msg));
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, type === 'err' ? 6000 : 3500);
  }

  // ---------------- Diálogos ----------------
  let dialogStack = [];
  function dialog(opts) {
    const prevFocus = document.activeElement;
    const ov = h('div', { class: 'overlay' + (opts.drawer ? ' drawer-overlay' : '') });
    const box = h('div', { class: 'dialog' + (opts.drawer ? ' drawer' : '') + (opts.size ? ' ' + opts.size : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-title-' + dialogStack.length });
    const close = (val) => {
      if (opts.beforeClose && val === undefined && opts.beforeClose() === false) return;
      ov.remove();
      dialogStack = dialogStack.filter((d) => d !== api_);
      if (!dialogStack.length) document.documentElement.style.overflow = '';
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opts.onClose) opts.onClose(val);
    };
    const head = h('div', { class: 'dialog-head' }, h('h2', { id: 'dlg-title-' + dialogStack.length }, opts.title || ''), h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Cerrar', html: ic('x', 18), onclick: () => close() }));
    const body = h('div', { class: 'dialog-body' });
    if (opts.body) body.appendChild(opts.body);
    const foot = h('div', { class: 'dialog-foot' });
    (opts.actions || []).forEach((a) => foot.appendChild(a === 'spacer' ? h('span', { class: 'spacer' }) : a));
    box.append(head, body);
    if ((opts.actions || []).length) box.appendChild(foot);
    ov.appendChild(box);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && !opts.persistent) close(); });
    ov.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialogStack[dialogStack.length - 1] === api_) { e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        const f = $$('button:not([disabled]), a[href], input:not([type=hidden]), select, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])', box).filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    const api_ = { close, body, foot, box, el: ov };
    dialogStack.push(api_);
    setTimeout(() => { const f = body.querySelector('input:not([type=hidden]):not([readonly]), textarea, select, [contenteditable="true"]') || foot.querySelector('.btn') || head.querySelector('button'); if (f) f.focus(); }, 40);
    return api_;
  }

  function confirmDialog(message, o) {
    const opts = o || {};
    return new Promise((resolve) => {
      let done = false;
      const ok = h('button', { type: 'button', class: 'btn ' + (opts.danger ? 'btn-danger' : '') }, opts.okText || 'Confirmar');
      const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, opts.cancelText || 'Cancelar');
      const body = h('div', {}, h('p', { style: 'margin:0;font-size:1rem' }, message), opts.detail || null);
      const d = dialog({ title: opts.title || 'Confirmar acción', body, actions: [cancel, ok], onClose: () => { if (!done) resolve(false); } });
      ok.addEventListener('click', () => { done = true; d.close(true); resolve(true); });
      cancel.addEventListener('click', () => d.close());
      setTimeout(() => (opts.danger ? cancel : ok).focus(), 50);
    });
  }

  // ---------------- Vista previa ----------------
  const DEVICES = [
    { w: 320, label: 'Móvil pequeño', icon: 'smartphone' }, { w: 375, label: 'Móvil', icon: 'smartphone' }, { w: 430, label: 'Móvil grande', icon: 'smartphone' },
    { w: 768, label: 'Tableta', icon: 'tablet' }, { w: 1366, label: 'Portátil', icon: 'monitor' }, { w: 1440, label: 'Escritorio', icon: 'monitor' }, { w: 1920, label: 'Pantalla amplia', icon: 'monitor' }
  ];
  function openPreview(url, title) {
    const prevFocus = document.activeElement;
    let device = window.innerWidth < 760 ? 375 : 1366;
    const frame = h('iframe', { src: url, title: 'Vista previa del sitio' });
    const wrap = h('div', { class: 'preview-frame-wrap' }, frame);
    const stage = h('div', { class: 'preview-stage' }, wrap);
    const btns = h('div', { class: 'device-btns', role: 'group', 'aria-label': 'Tamaño de pantalla' });
    DEVICES.forEach((d) => btns.appendChild(h('button', { type: 'button', 'aria-pressed': String(d.w === device), title: d.label, onclick: (e) => { const b0 = e.currentTarget; device = d.w; fit(); $$('button', btns).forEach((b) => b.setAttribute('aria-pressed', String(b === b0))); } }, icEl(d.icon, 15), d.w + ' px')));
    const closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar vista previa', html: ic('x') });
    const reload = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Recargar', title: 'Recargar', html: ic('refresh', 18), onclick: () => frame.contentWindow.location.reload() });
    const ov = h('div', { class: 'preview-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Vista previa' },
      h('div', { class: 'preview-bar' }, h('h2', {}, title || 'Vista previa'), btns, reload, closeBtn), stage);
    function fit() {
      const avail = stage.clientWidth - 40;
      const scale = Math.min(1, avail / device);
      const hgt = Math.max(400, (stage.clientHeight - 40) / scale);
      frame.style.width = device + 'px'; frame.style.height = hgt + 'px';
      wrap.style.width = device + 'px'; wrap.style.height = hgt + 'px';
      wrap.style.transform = `scale(${scale})`;
      wrap.style.marginBottom = `${-(hgt * (1 - scale))}px`;
      wrap.style.marginLeft = wrap.style.marginRight = `${-(device * (1 - scale)) / 2}px`;
    }
    const close = () => { ov.remove(); window.removeEventListener('resize', fit); document.documentElement.style.overflow = ''; if (prevFocus) prevFocus.focus(); };
    closeBtn.addEventListener('click', close);
    ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    document.body.appendChild(ov);
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('resize', fit);
    fit();
    closeBtn.focus();
  }

  // ---------------- Estado de publicación ----------------
  async function refreshStatus() {
    if (!state.perms.some((p) => ['content', 'links', 'brand', 'settings'].includes(p))) return;
    try {
      const s = await api('GET', '/publish/status', undefined, { silent: true });
      const pill = $('#pub-pill');
      pill.hidden = false;
      pill.className = 'pub-pill ' + (s.pending ? 'pending' : 'synced');
      pill.textContent = s.pending ? `Cambios sin publicar (${s.changes.length})` : 'Sitio actualizado';
      pill.title = s.last ? `Última publicación: ${fmtDate(s.last.at, true)} por ${s.last.by || '—'}` : '';
      $('#tb-publish').disabled = !s.pending;
      return s;
    } catch (e) { return null; }
  }

  async function publishDialog() {
    const s = await api('GET', '/publish/status');
    if (!s.pending) return toast('No hay cambios pendientes por publicar.', 'ok');
    const list = h('ul', { class: 'activity', style: 'max-height:280px;overflow:auto;border:1px solid var(--line);border-radius:12px;margin:10px 0 14px' },
      s.changes.map((c) => h('li', {}, h('span', { class: 'a-ic', html: ic('edit', 16) }), h('div', { class: 'a-main' }, h('strong', {}, c.label), h('small', {}, `${c.type} · ${c.change}`)))));
    const note = h('input', { class: 'input', id: 'pub-note', maxlength: '200', placeholder: 'Ej.: Actualización de fotografías de instalaciones' });
    const problems = h('div');
    const body = h('div', {},
      h('p', {}, 'Se publicarán los siguientes cambios. El sitio público se actualizará de inmediato.'), list,
      h('div', { class: 'field' }, h('label', { for: 'pub-note' }, 'Nota de la versión (opcional)'), note), problems);
    const ok = h('button', { type: 'button', class: 'btn' }, icEl('rocket', 18), 'Publicar cambios');
    const prev = h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => openPreview('/preview', 'Vista previa de los cambios guardados') }, icEl('eye', 18), 'Vista previa');
    const d = dialog({ title: 'Publicar cambios', body, size: 'wide', actions: [prev, 'spacer', h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, 'Cancelar'), ok] });
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      problems.innerHTML = '';
      try {
        await api('POST', '/publish', { note: note.value });
        d.close(true);
        toast('Contenido publicado. El sitio público ya muestra los cambios.');
        refreshStatus();
        router.reload();
      } catch (e) {
        if (e.data && e.data.problems) {
          problems.appendChild(h('div', { class: 'notice danger' }, icEl('alert', 18), h('div', {}, h('p', {}, h('strong', {}, e.message)), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, e.data.problems.map((p) => h('li', {}, p))))));
        } else toast(e.message, 'err');
      } finally { ok.disabled = false; }
    });
  }

  // ---------------- Selector de la biblioteca multimedia ----------------
  function mediaPicker(kind, onPick) {
    let items = [];
    let filter = '';
    let selected = null;
    const grid = h('div', { class: 'media-grid' });
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre…', 'aria-label': 'Buscar archivos', oninput: (e) => { filter = e.target.value.toLowerCase(); render(); } });
    const catSel = h('select', { class: 'input', 'aria-label': 'Categoría', style: 'max-width:200px', onchange: render }, h('option', { value: '' }, 'Todas las categorías'), SS.MEDIA_CATEGORIES.map((c) => h('option', {}, c)));
    const choose = h('button', { type: 'button', class: 'btn', disabled: true }, 'Usar archivo seleccionado');
    const uploadBtn = can('media') || can('brand') ? h('label', { class: 'btn btn-ghost', style: 'cursor:pointer' }, icEl('upload', 18), 'Subir nuevo',
      h('input', { type: 'file', accept: kind === 'image' ? 'image/jpeg,image/png,image/webp,image/svg+xml,image/avif' : 'image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,video/webm', hidden: true, onchange: async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const fd = new FormData(); fd.append('files', f); fd.append('category', catSel.value || 'General');
        try {
          const r = await api('POST', '/media', fd);
          if (r.errors && r.errors.length) toast(r.errors[0], 'err');
          if (r.created && r.created[0]) { toast('Imagen cargada correctamente.'); await load(); selected = r.created[0]; render(); choose.disabled = false; }
        } catch (err) { toast(err.message, 'err'); }
        e.target.value = '';
      } })) : null;
    function render() {
      grid.innerHTML = '';
      const list = items.filter((m) => (kind === 'image' ? m.kind === 'image' : true) && (!filter || m.name.toLowerCase().includes(filter)) && (!catSel.value || m.category === catSel.value));
      if (!list.length) { grid.appendChild(h('p', { class: 'empty', style: 'grid-column:1/-1' }, 'No hay archivos que coincidan.')); return; }
      list.forEach((m) => {
        const card = h('div', { class: 'card media-card' + (selected && selected.id === m.id ? ' is-selected' : '') },
          h('button', { type: 'button', class: 'mc-thumb', style: m.kind === 'image' ? `background-image:url('${encodeURI(m.thumb_url || m.url)}')` : '', 'aria-label': 'Seleccionar ' + m.name, onclick: () => { selected = m; choose.disabled = false; render(); }, ondblclick: () => { onPick(m); d.close(true); } },
            m.kind === 'video' ? h('video', { src: m.url + '#t=0.5', preload: 'metadata', muted: true }) : null, h('span', { class: 'badge badge-neutral mc-kind' }, m.kind === 'video' ? 'Video' : 'Imagen')),
          h('div', { class: 'mc-body' }, h('strong', { title: m.name }, m.name), h('div', { class: 'mc-meta' }, h('span', {}, m.category), m.width ? h('span', {}, `${m.width}×${m.height}`) : null)));
        grid.appendChild(card);
      });
    }
    async function load() { items = await api('GET', '/media-picker'); render(); }
    const body = h('div', {}, h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icEl('search', 18), search), catSel, uploadBtn), grid);
    const d = dialog({ title: kind === 'image' ? 'Seleccionar imagen' : 'Seleccionar imagen o video', body, size: 'xwide', actions: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, 'Cancelar'), choose] });
    choose.addEventListener('click', () => { if (selected) { onPick(selected); d.close(true); } });
    load();
  }

  // ---------------- Editor de texto enriquecido ----------------
  function richEditor(id, value, placeholder) {
    const ed = h('div', { class: 'rich-editor', id, contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'data-placeholder': placeholder || 'Escribe aquí…' });
    ed.innerHTML = value || '';
    const cmd = (c, v) => { ed.focus(); document.execCommand(c, false, v); };
    const tb = h('div', { class: 'rich-toolbar', role: 'toolbar', 'aria-label': 'Formato de texto' },
      h('button', { type: 'button', title: 'Negrita', 'aria-label': 'Negrita', onclick: () => cmd('bold') }, 'B'),
      h('button', { type: 'button', title: 'Cursiva', 'aria-label': 'Cursiva', style: 'font-style:italic;font-family:serif', onclick: () => cmd('italic') }, 'I'),
      h('span', { class: 'sep' }),
      h('button', { type: 'button', title: 'Lista con viñetas', 'aria-label': 'Lista con viñetas', onclick: () => cmd('insertUnorderedList') }, '••'),
      h('button', { type: 'button', title: 'Lista numerada', 'aria-label': 'Lista numerada', onclick: () => cmd('insertOrderedList') }, '1.'),
      h('span', { class: 'sep' }),
      h('button', { type: 'button', title: 'Insertar enlace', 'aria-label': 'Insertar enlace', html: ic('link', 16), onclick: () => {
        const sel = window.getSelection();
        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        const url = prompt('Dirección del enlace (https://…, /servicios, /contacto#agendar, mailto: o tel:)', 'https://');
        if (!url) return;
        if (!SS.isValidUrl(url)) return toast('La dirección del enlace no es válida.', 'err');
        if (range) { sel.removeAllRanges(); sel.addRange(range); }
        if (sel.isCollapsed) { ed.focus(); document.execCommand('insertHTML', false, `<a href="${esc(url)}">${esc(url)}</a>`); } else cmd('createLink', url);
      } }),
      h('button', { type: 'button', title: 'Quitar formato', 'aria-label': 'Quitar formato', html: ic('x', 16), onclick: () => { cmd('removeFormat'); cmd('unlink'); } }));
    // Pegar siempre como texto plano: evita estilos o código externo.
    ed.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text);
    });
    ed.addEventListener('drop', (e) => e.preventDefault());
    const wrap = h('div', { class: 'rich-wrap' }, tb, ed);
    wrap.getValue = () => {
      const v = ed.innerHTML.trim();
      return v === '<br>' || v === '<p><br></p>' ? '' : v;
    };
    return wrap;
  }

  // ---------------- Generador de formularios ----------------
  /**
   * buildForm(fields, values, ctx) → { el, collect(), showErrors(errs), dirty() }
   * ctx: { options: {fuente: [..]}, links: {clave: item}, idPrefix }
   */
  function buildForm(fields, values, ctx) {
    const c = ctx || {};
    const vals = values || {};
    const form = h('div', { class: 'form' });
    const getters = {};
    const linkGetters = {};
    const pre = c.idPrefix || 'f';
    for (const f of fields) {
      const id = `${pre}-${f.name}`;
      const wide = ['textarea', 'rich', 'image', 'media', 'icon', 'lines', 'linkref', 'checkbox'].includes(f.type) || f.full;
      const field = h('div', { class: 'field' + (wide ? ' full' : ''), dataset: { name: f.name } });
      const label = f.type === 'checkbox' ? null : h(f.type === 'icon' || f.type === 'image' || f.type === 'media' || f.type === 'linkref' ? 'span' : 'label', { class: 'label', for: id }, f.label, f.required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null);
      if (label) field.appendChild(label);
      let v = vals[f.name];
      if (v == null) v = f.type === 'checkbox' ? false : '';
      switch (f.type) {
        case 'textarea':
        case 'lines': {
          const ta = h('textarea', { class: 'input', id, rows: f.type === 'lines' ? 4 : 3, maxlength: f.max || null, placeholder: f.placeholder || null });
          ta.value = v;
          field.appendChild(ta);
          if (f.max) { const cnt = h('div', { class: 'counter' }); const upd = () => (cnt.textContent = `${ta.value.length} / ${f.max}`); ta.addEventListener('input', upd); upd(); field.appendChild(cnt); }
          getters[f.name] = () => ta.value;
          break;
        }
        case 'rich': {
          const ed = richEditor(id, v, f.placeholder);
          field.appendChild(ed);
          getters[f.name] = () => ed.getValue();
          break;
        }
        case 'checkbox': {
          const cb = h('input', { type: 'checkbox', id });
          cb.checked = !!v;
          field.appendChild(h('label', { class: 'check-row', for: id }, cb, h('span', {}, f.label)));
          getters[f.name] = () => cb.checked;
          break;
        }
        case 'select': {
          const opts = f.options || (c.options && c.options[f.source]) || [];
          const sel = h('select', { class: 'input', id }, h('option', { value: '' }, 'Selecciona…'), opts.map((o) => h('option', { value: o }, (f.labels && f.labels[o]) || o)));
          sel.value = v;
          field.appendChild(sel);
          getters[f.name] = () => sel.value;
          break;
        }
        case 'icon': {
          const list = f.icons || SI.PICKABLE;
          let cur = v;
          const grid = h('div', { class: 'icon-grid', role: 'radiogroup', 'aria-label': f.label });
          list.forEach((n) => grid.appendChild(h('button', { type: 'button', title: n, 'aria-label': n, 'aria-pressed': String(n === cur), html: ic(n, 20), onclick: (e) => { cur = n; $$('button', grid).forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } })));
          field.appendChild(grid);
          getters[f.name] = () => cur;
          break;
        }
        case 'image':
        case 'media': {
          let cur = v;
          const prev = h('div', { class: 'mf-preview' });
          const name = h('div', { class: 'mf-name' });
          const render = () => {
            prev.innerHTML = ''; prev.style.backgroundImage = '';
            if (!cur) { prev.innerHTML = ic('image', 28); name.textContent = 'Sin archivo seleccionado'; }
            else if (/\.(mp4|webm)$/i.test(cur)) { prev.appendChild(h('video', { src: cur + '#t=0.5', muted: true, preload: 'metadata' })); name.textContent = cur.split('/').pop(); }
            else { prev.style.backgroundImage = `url('${encodeURI(cur)}')`; name.textContent = cur.split('/').pop(); }
            rm.hidden = !cur;
          };
          const pick = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id, onclick: () => mediaPicker(f.type, (m) => { cur = m.url; render(); field.dispatchEvent(new Event('input', { bubbles: true })); }) }, icEl('image', 16), cur ? 'Cambiar' : 'Elegir de la biblioteca');
          const rm = h('button', { type: 'button', class: 'btn btn-danger-ghost btn-sm', onclick: () => { cur = ''; render(); } }, 'Quitar');
          field.appendChild(h('div', { class: 'media-field' }, prev, h('div', { class: 'mf-info' }, name, h('div', { class: 'mf-btns' }, pick, rm))));
          render();
          getters[f.name] = () => cur;
          break;
        }
        case 'linkref': {
          const l = (c.links || {})[f.key];
          if (!l) { field.appendChild(h('p', { class: 'muted small' }, 'Enlace no disponible.')); break; }
          const t = h('input', { class: 'input', id: id + '-text', maxlength: 60 }); t.value = l.text || '';
          const u = h('input', { class: 'input', id: id + '-url' }); u.value = l.url || '';
          const warn = h('div', { class: 'warn-msg' });
          u.addEventListener('input', () => (warn.textContent = u.value && !SS.isValidUrl(u.value) ? 'Dirección no válida. Usa una página (/servicios, /contacto#agendar), https://…, mailto: o tel:.' : ''));
          field.appendChild(h('div', { class: 'linkref' }, h('div', {}, h('label', { for: id + '-text' }, 'Texto del botón'), t), h('div', {}, h('label', { for: id + '-url' }, 'Enlace del botón'), u)));
          field.appendChild(warn);
          if (l.status !== 'publicado') field.appendChild(h('p', { class: 'warn-msg' }, 'Este botón está desactivado en «Enlaces y botones».'));
          linkGetters[f.key] = () => ({ item: l, text: t.value, url: u.value });
          break;
        }
        default: {
          const inp = h('input', { class: 'input', id, type: f.type === 'date' ? 'date' : f.type === 'url' ? 'text' : 'text', maxlength: f.max || null, placeholder: f.placeholder || (f.type === 'url' ? '/servicios, /contacto#agendar o https://…' : null), readonly: f.readonly || null, inputmode: f.type === 'url' ? 'url' : null });
          inp.value = v;
          field.appendChild(inp);
          if (f.type === 'url') {
            const warn = h('div', { class: 'warn-msg' });
            const chk = () => (warn.textContent = inp.value && !SS.isValidUrl(inp.value) ? 'Advertencia: la dirección no tiene un destino válido.' : '');
            inp.addEventListener('input', chk); chk();
            field.appendChild(warn);
          }
          getters[f.name] = () => inp.value;
        }
      }
      if (f.help) field.appendChild(h('div', { class: 'help' }, f.help));
      field.appendChild(h('div', { class: 'err', role: 'alert' }));
      form.appendChild(field);
    }
    const collect = () => { const o = {}; for (const [k, g] of Object.entries(getters)) o[k] = g(); return o; };
    const initial = JSON.stringify(collect());
    return {
      el: form,
      collect,
      links: () => Object.values(linkGetters).map((g) => g()),
      dirty: () => JSON.stringify(collect()) !== initial,
      showErrors(errs) {
        $$('.field', form).forEach((fl) => { fl.classList.remove('has-error'); const e = $('.err', fl); if (e) e.textContent = ''; });
        let first = null;
        for (const [k, msg] of Object.entries(errs || {})) {
          const fl = form.querySelector(`.field[data-name="${k}"]`);
          if (!fl) continue;
          fl.classList.add('has-error');
          $('.err', fl).textContent = msg;
          if (!first) first = fl;
        }
        if (first) { first.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = first.querySelector('input, textarea, select, [contenteditable], button'); if (i) i.focus({ preventScroll: true }); }
      }
    };
  }

  // Guarda los botones vinculados (linkref) de un formulario.
  async function saveLinkRefs(form) {
    for (const { item, text, url } of form.links()) {
      if (item.text === text && item.url === url) continue;
      if (!SS.isValidUrl(url)) throw Object.assign(new Error(`El enlace de «${item.label}» no es válido.`), { status: 400 });
      const { id, collection, status, sort_order, created_at, updated_at, updated_by, ...data } = item;
      await api('PUT', `/items/links/${id}`, { data: { ...data, text, url }, status });
    }
  }

  // ---------------- Enrutador y estructura ----------------
  const routes = [];
  const NAV = [
    { group: 'General' },
    { path: 'inicio', label: 'Inicio', icon: 'dashboard' },
    { group: 'Contenido' },
    { path: 'pagina', label: 'Página principal', icon: 'layout', perm: 'content' },
    { path: 'textos', label: 'Textos y contenidos', icon: 'type', perm: 'content' },
    { path: 'multimedia', label: 'Imágenes y multimedia', icon: 'image', perm: 'media' },
    { path: 'servicios', label: 'Servicios', icon: 'heart', perm: 'content' },
    { path: 'instalaciones', label: 'Instalaciones', icon: 'building', perm: 'content' },
    { path: 'experiencias', label: 'Experiencias', icon: 'sparkles', perm: 'content' },
    { path: 'testimonios', label: 'Testimonios', icon: 'quote', perm: 'content' },
    { path: 'preguntas', label: 'Preguntas frecuentes', icon: 'help-circle', perm: 'content' },
    { path: 'enlaces', label: 'Enlaces y botones', icon: 'link', perm: 'links' },
    { path: 'identidad', label: 'Identidad visual', icon: 'palette', perm: 'brand' },
    { group: 'Gestión' },
    { path: 'solicitudes', label: 'Solicitudes de visita', icon: 'inbox', perm: 'requests', count: true },
    { path: 'historial', label: 'Historial de cambios', icon: 'history', perm: 'history' },
    { path: 'configuracion', label: 'Configuración', icon: 'settings', perm: 'settings' },
    { path: 'usuarios', label: 'Usuarios y permisos', icon: 'users', perm: 'users' }
  ];
  let leaveGuard = null; // función que devuelve true si hay cambios sin guardar
  const router = {
    add(pattern, opts) { routes.push({ pattern, ...opts }); },
    setGuard(fn) { leaveGuard = fn; },
    async go(hash) { location.hash = hash; },
    async reload() { await render(); },
    current: ''
  };
  async function render() {
    const hash = location.hash.replace(/^#\/?/, '').split('?')[0] || 'inicio';
    const [path, ...rest] = hash.split('/');
    const r = routes.find((x) => x.pattern === path);
    const view = $('#view');
    leaveGuard = null;
    // Cerrar diálogos abiertos del módulo anterior
    dialogStack.forEach((d) => d.el.remove());
    dialogStack = [];
    $$('.preview-overlay').forEach((o) => o.remove());
    document.documentElement.style.overflow = '';
    if (!r || (r.perm && !can(r.perm))) {
      view.innerHTML = '';
      view.appendChild(h('div', { class: 'card empty' }, icEl('lock', 32), h('h2', {}, r ? 'Acceso restringido' : 'Página no encontrada'), h('p', {}, r ? 'Tu rol no tiene permisos para este módulo.' : 'La sección solicitada no existe.'), h('a', { class: 'btn', href: '#/inicio' }, 'Ir al inicio')));
      return;
    }
    router.current = path;
    $$('.sb-link[data-path]').forEach((a) => {
      const active = a.dataset.path === (r.navParent || path);
      a.classList.toggle('is-active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('#page-title').textContent = r.title;
    document.title = r.title + ' · Panel Seniors';
    view.innerHTML = '';
    view.appendChild(h('div', { class: 'empty' }, 'Cargando…'));
    try {
      const node = await r.render(rest);
      view.innerHTML = '';
      if (node) view.appendChild(node);
    } catch (e) {
      view.innerHTML = '';
      view.appendChild(h('div', { class: 'notice danger' }, icEl('alert', 18), h('p', {}, e.message || 'No se pudo cargar el módulo.')));
    }
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
    if (window.innerWidth <= 1024) $('#app').classList.remove('is-expanded');
  }
  let lastHash = location.hash;
  window.addEventListener('hashchange', async () => {
    if (leaveGuard && leaveGuard()) {
      const ok = await confirmDialog('Tienes cambios sin guardar. ¿Deseas salir sin guardarlos?', { okText: 'Salir sin guardar', danger: true, title: 'Cambios sin guardar' });
      if (!ok) { history.replaceState(null, '', lastHash || '#/inicio'); return; }
    }
    lastHash = location.hash;
    render();
  });
  window.addEventListener('beforeunload', (e) => { if (leaveGuard && leaveGuard()) { e.preventDefault(); e.returnValue = ''; } });

  function buildNav() {
    const nav = $('#sb-nav');
    const ul = h('ul');
    let pendingGroup = null;
    for (const item of NAV) {
      if (item.group) { pendingGroup = item.group; continue; }
      if (item.perm && !can(item.perm)) continue;
      if (pendingGroup) { ul.appendChild(h('li', { class: 'sb-group', 'aria-hidden': 'true' }, pendingGroup)); pendingGroup = null; }
      ul.appendChild(h('li', {}, h('a', { class: 'sb-link', href: '#/' + item.path, dataset: { path: item.path }, title: item.label }, icEl(item.icon), h('span', { class: 'sb-label' }, item.label), item.count ? h('span', { class: 'sb-count', id: 'sb-count', hidden: true }) : null)));
    }
    nav.innerHTML = '';
    nav.appendChild(ul);
  }

  async function updateBell() {
    if (!can('requests')) return;
    try {
      const r = await api('GET', '/requests?status=pendiente', undefined, { silent: true });
      const n = r.counts.pendiente || 0;
      const bell = $('#tb-bell');
      bell.hidden = false;
      bell.querySelectorAll('.dot').forEach((d) => d.remove());
      if (n) bell.appendChild(h('span', { class: 'dot' }, n > 99 ? '99+' : n));
      bell.setAttribute('aria-label', `${n} solicitudes pendientes`);
      const c = $('#sb-count');
      if (c) { c.hidden = !n; c.textContent = n; }
    } catch (e) { /* noop */ }
  }

  function changePasswordDialog(forced) {
    const cur = h('input', { class: 'input', type: 'password', id: 'cp-cur', autocomplete: 'current-password' });
    const p1 = h('input', { class: 'input', type: 'password', id: 'cp-1', autocomplete: 'new-password' });
    const p2 = h('input', { class: 'input', type: 'password', id: 'cp-2', autocomplete: 'new-password' });
    const msg = h('div', { class: 'err', role: 'alert' });
    const body = h('div', {},
      forced ? h('div', { class: 'notice warn' }, icEl('lock', 18), h('p', {}, 'Por seguridad, cambia la contraseña temporal que te asignaron.')) : null,
      h('div', { class: 'field' }, h('label', { for: 'cp-cur' }, 'Contraseña actual'), cur),
      h('div', { class: 'field' }, h('label', { for: 'cp-1' }, 'Nueva contraseña'), p1, h('div', { class: 'help' }, 'Mínimo 10 caracteres, con letras y números.')),
      h('div', { class: 'field' }, h('label', { for: 'cp-2' }, 'Confirmar nueva contraseña'), p2), msg);
    const ok = h('button', { type: 'button', class: 'btn' }, 'Guardar contraseña');
    const d = dialog({ title: 'Cambiar contraseña', body, actions: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, forced ? 'Más tarde' : 'Cancelar'), ok] });
    ok.addEventListener('click', async () => {
      msg.textContent = '';
      if (p1.value !== p2.value) { msg.textContent = 'Las contraseñas no coinciden.'; return; }
      try { await api('POST', '/me/password', { current: cur.value, password: p1.value }); d.close(true); toast('Contraseña actualizada.'); }
      catch (e) { msg.textContent = e.message; }
    });
  }

  async function logout() {
    if (leaveGuard && leaveGuard()) {
      const ok = await confirmDialog('Tienes cambios sin guardar. ¿Cerrar sesión de todas formas?', { okText: 'Cerrar sesión', danger: true });
      if (!ok) return;
      leaveGuard = null;
    }
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    location.href = '/admin/login';
  }

  async function boot() {
    $$('[data-icon]').forEach((s) => { s.innerHTML = ic(s.dataset.icon, 20); s.style.display = 'inline-flex'; });
    const me = await api('GET', '/me');
    Object.assign(state, { user: me.user, csrf: me.csrf, roles: me.roles, perms: me.user.perms });
    const initials = me.user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    $('#u-avatar').textContent = initials;
    $('#u-name').textContent = me.user.name; $('#u-name2').textContent = me.user.name;
    $('#u-role').textContent = (me.roles[me.user.role] || {}).label || me.user.role;
    $('#u-email').textContent = me.user.email;
    buildNav();

    const app = $('#app');
    const sbToggle = $('#sb-toggle');
    let collapsed = false;
    try { collapsed = localStorage.getItem('seniors.sb') === '1'; } catch (e) { /* noop */ }
    app.classList.toggle('is-collapsed', collapsed);
    sbToggle.addEventListener('click', () => {
      if (window.innerWidth <= 1024) { app.classList.toggle('is-expanded'); sbToggle.setAttribute('aria-expanded', String(app.classList.contains('is-expanded'))); return; }
      collapsed = !collapsed;
      app.classList.toggle('is-collapsed', collapsed);
      sbToggle.setAttribute('aria-expanded', String(!collapsed));
      try { localStorage.setItem('seniors.sb', collapsed ? '1' : '0'); } catch (e) { /* noop */ }
    });
    $('#scrim').addEventListener('click', () => app.classList.remove('is-expanded'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') app.classList.remove('is-expanded'); });

    const ub = $('#user-btn'), um = $('#user-menu');
    ub.addEventListener('click', (e) => { e.stopPropagation(); um.hidden = !um.hidden; ub.setAttribute('aria-expanded', String(!um.hidden)); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) { um.hidden = true; ub.setAttribute('aria-expanded', 'false'); } });
    $('#pw-btn').addEventListener('click', () => { um.hidden = true; changePasswordDialog(false); });
    $('#logout-btn').addEventListener('click', logout);
    $('#logout-btn2').addEventListener('click', logout);

    if (state.perms.some((p) => ['content', 'links', 'brand', 'settings'].includes(p))) {
      $('#tb-preview').hidden = false;
      $('#tb-preview').addEventListener('click', () => openPreview('/preview', 'Vista previa de los cambios guardados'));
    }
    if (can('publish')) { $('#tb-publish').hidden = false; $('#tb-publish').addEventListener('click', publishDialog); }
    refreshStatus();
    updateBell();
    setInterval(updateBell, 60000);
    if (me.user.must_change) changePasswordDialog(true);
    await render();
  }

  window.A = { $, $$, h, ic, icEl, esc, api, toast, dialog, confirmDialog, openPreview, buildForm, saveLinkRefs, mediaPicker, richEditor, refreshStatus, updateBell, publishDialog, router, state, can, fmtDate, relTime, fmtSize, SS, SI };
  document.addEventListener('DOMContentLoaded', () => boot().catch((e) => { console.error(e); }));
})();

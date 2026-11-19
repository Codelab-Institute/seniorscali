/* Seniors · Panel administrativo — módulos */
(function () {
  'use strict';
  const { $, $$, h, ic, icEl, api, toast, dialog, confirmDialog, openPreview, buildForm, saveLinkRefs, mediaPicker, refreshStatus, updateBell, router, state, can, fmtDate, relTime, fmtSize, SS, SI } = window.A;

  const STATUS = SS.STATUS;
  const statusBadge = (s) => h('span', { class: 'badge badge-' + s }, STATUS[s] || s);
  const pageHead = (title, desc, ...actions) => h('div', { class: 'page-head' }, h('div', {}, h('h1', { class: 'sr-only' }, title), desc ? h('p', {}, desc) : null), actions.length ? h('div', { class: 'page-actions' }, actions) : null);
  const workflowNotice = () => h('div', { class: 'notice' }, icEl('rocket', 18), h('p', {}, 'Los cambios se guardan como borrador del sitio. Revisa con «Vista previa» y usa «Publicar cambios» para que aparezcan en la página pública.' + (can('publish') ? '' : ' Un administrador debe publicarlos.')));

  async function selectOptions() {
    const [fc, ec] = await Promise.all([api('GET', '/items/facility_categories'), api('GET', '/items/experience_categories')]);
    return { facility_categories: fc.map((c) => c.name), experience_categories: ec.map((c) => c.name) };
  }
  async function linksByKey() {
    if (!can('links') && !can('content')) return {};
    try {
      const list = await api('GET', '/items/links', undefined, { silent: true });
      const o = {}; list.forEach((l) => (o[l.key] = l)); return o;
    } catch (e) { return {}; }
  }
  function tabs(defs, initial) {
    const bar = h('div', { class: 'tabs', role: 'tablist' });
    const panel = h('div', { role: 'tabpanel' });
    let current = initial || defs[0].key;
    const show = async (key) => {
      current = key;
      $$('.tab', bar).forEach((t) => { const on = t.dataset.key === key; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', String(on)); });
      panel.innerHTML = '';
      panel.appendChild(h('div', { class: 'empty' }, 'Cargando…'));
      const node = await defs.find((d) => d.key === key).render();
      panel.innerHTML = '';
      panel.appendChild(node);
    };
    defs.forEach((d) => bar.appendChild(h('button', { type: 'button', class: 'tab', role: 'tab', dataset: { key: d.key }, onclick: () => show(d.key) }, d.label)));
    show(current);
    return h('div', {}, bar, panel);
  }

  // =====================================================================
  //  Gestor genérico de colecciones
  // =====================================================================
  function subtitleFor(col, it) {
    switch (col) {
      case 'experiences': return [it.category, it.date ? fmtDate(it.date) : 'Sin fecha', /\.(mp4|webm)$/i.test(it.media) ? 'Video' : 'Fotografía'].join(' · ');
      case 'facilities': return it.category + (it.description ? ' · ' + it.description : '');
      case 'testimonials': return [it.relation, it.example ? 'Ejemplo ilustrativo' : 'Testimonio real', it.date ? fmtDate(it.date) : ''].filter(Boolean).join(' · ');
      case 'complementary': return it.included + (it.description ? ' · ' + it.description : '');
      case 'links': return `${it.url}  ·  ${SS.LINK_TYPES[it.type] || it.type}`;
      case 'faqs': return (it.answer || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      default: return it.description || '';
    }
  }

  function collectionManager(col, o) {
    const opts = o || {};
    const def = SS.COLLECTIONS[col];
    let items = [];
    let options = {};
    let links = {};
    const q = { text: '', status: '', cat: '', sort: def.dateField ? 'date' : 'manual' };
    const root = h('div');
    const list = h('ul', { class: 'item-list' });
    const countEl = h('span', { class: 'muted small' });

    const search = h('input', { class: 'input', type: 'search', placeholder: `Buscar ${def.label.toLowerCase()}…`, 'aria-label': 'Buscar', oninput: (e) => { q.text = e.target.value.toLowerCase(); renderList(); } });
    const statusSel = h('select', { class: 'input', 'aria-label': 'Filtrar por estado', style: 'width:auto', onchange: (e) => { q.status = e.target.value; renderList(); } }, h('option', { value: '' }, 'Todos los estados'), Object.entries(STATUS).map(([k, v]) => h('option', { value: k }, v)));
    const catSel = def.filterField ? h('select', { class: 'input', 'aria-label': 'Filtrar por categoría', style: 'width:auto', onchange: (e) => { q.cat = e.target.value; renderList(); } }) : null;
    const sortSel = def.dateField ? h('select', { class: 'input', 'aria-label': 'Ordenar', style: 'width:auto', onchange: (e) => { q.sort = e.target.value; renderList(); } }, h('option', { value: 'date' }, 'Más recientes primero'), h('option', { value: 'date-asc' }, 'Más antiguas primero'), h('option', { value: 'manual' }, 'Orden manual')) : null;
    const addBtn = h('button', { type: 'button', class: 'btn', onclick: () => editItem(null) }, icEl('plus', 18), opts.addLabel || `Agregar ${def.singular}`);

    root.append(
      h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icEl('search', 18), search), statusSel, catSel, sortSel, addBtn),
      h('div', { style: 'display:flex;justify-content:space-between;gap:12px;margin:-4px 0 10px;flex-wrap:wrap' }, countEl, h('span', { class: 'muted small', id: 'order-hint-' + col })),
      list);

    function filtered() {
      let l = items.filter((it) => (!q.status || it.status === q.status) && (!q.cat || it[def.filterField] === q.cat) &&
        (!q.text || JSON.stringify(it).toLowerCase().includes(q.text)));
      if (q.sort === 'date') l = l.slice().sort((a, b) => String(b[def.dateField] || '').localeCompare(String(a[def.dateField] || '')));
      if (q.sort === 'date-asc') l = l.slice().sort((a, b) => String(a[def.dateField] || '').localeCompare(String(b[def.dateField] || '')));
      return l;
    }
    const manualOrder = () => q.sort === 'manual' && !q.text && !q.status && !q.cat;

    async function move(id, delta) {
      const idx = items.findIndex((x) => x.id === id);
      const j = idx + delta;
      if (j < 0 || j >= items.length) return;
      [items[idx], items[j]] = [items[j], items[idx]];
      renderList();
      await saveOrder();
    }
    async function saveOrder() {
      try { await api('POST', `/items/${col}/reorder`, { ids: items.map((x) => x.id) }); toast('Orden actualizado.'); refreshStatus(); }
      catch (e) { load(); }
    }

    function thumbFor(it) {
      const img = def.imageField && it[def.imageField];
      if (img && !/\.(mp4|webm)$/i.test(img)) return h('img', { class: 'item-thumb', src: img, alt: '', loading: 'lazy' });
      if (img) return h('div', { class: 'item-thumb', html: ic('video', 24) });
      if (it.icon) return h('div', { class: 'item-thumb icon', html: ic(it.icon, 24) });
      if (def.imageField) return h('div', { class: 'item-thumb', html: ic(col === 'testimonials' ? 'user' : 'image', 22) });
      return null;
    }

    let dragId = null;
    function renderList() {
      const l = filtered();
      const manual = manualOrder();
      countEl.textContent = `${l.length} de ${items.length} elemento${items.length === 1 ? '' : 's'}`;
      const hint = root.querySelector('#order-hint-' + col);
      if (hint) hint.textContent = manual && items.length > 1 ? 'Usa las flechas o arrastra para cambiar el orden de presentación.' : (items.length > 1 ? 'Quita filtros y elige «Orden manual» para reordenar.' : '');
      list.innerHTML = '';
      if (!l.length) { list.appendChild(h('li', { class: 'card empty' }, icEl('inbox', 32), h('p', {}, items.length ? 'Ningún elemento coincide con los filtros.' : `Aún no hay ${def.label.toLowerCase()}.`))); return; }
      l.forEach((it, i) => {
        const title = it[def.titleField] || '(sin título)';
        const toggle = h('label', { class: 'switch', title: it.status === 'publicado' ? 'Desactivar' : 'Activar' },
          h('input', { type: 'checkbox', checked: it.status === 'publicado', 'aria-label': (it.status === 'publicado' ? 'Desactivar ' : 'Activar ') + title, onchange: async (e) => {
            const ns = e.target.checked ? 'publicado' : 'despublicado';
            try { await api('PATCH', `/items/${col}/${it.id}/status`, { status: ns }); it.status = ns; toast(ns === 'publicado' ? 'Elemento activado. Publica los cambios para mostrarlo.' : 'Elemento desactivado. Publica los cambios para ocultarlo.'); renderList(); refreshStatus(); }
            catch (err) { e.target.checked = !e.target.checked; toast(err.message, 'err'); }
          } }), h('span', { class: 'track' }));
        const row = h('li', { class: 'item-row', draggable: manual ? 'true' : null, dataset: { id: it.id } },
          manual ? h('div', { class: 'item-order' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Subir «${title}»`, disabled: i === 0, html: ic('chevron-up', 16), onclick: () => move(it.id, -1) }),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Bajar «${title}»`, disabled: i === l.length - 1, html: ic('chevron-down', 16), onclick: () => move(it.id, 1) })) : null,
          thumbFor(it),
          h('div', { class: 'item-main' }, h('strong', {}, title), h('small', {}, subtitleFor(col, it))),
          h('div', { class: 'item-actions' },
            statusBadge(it.status),
            (col === 'benefits' || col === 'faqs' || col === 'complementary') && !it.validated ? h('span', { class: 'badge badge-borrador', title: 'Pendiente de validación por Seniors' }, 'Sin validar') : null,
            toggle,
            h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Editar ' + title, title: 'Editar', html: ic('edit', 17), onclick: () => editItem(it) }),
            h('button', { type: 'button', class: 'icon-btn sm danger', 'aria-label': 'Eliminar ' + title, title: 'Eliminar', html: ic('trash', 17), onclick: () => removeItem(it) })));
        if (manual) {
          row.addEventListener('dragstart', (e) => { dragId = it.id; row.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; });
          row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); $$('.drop-before', list).forEach((x) => x.classList.remove('drop-before')); });
          row.addEventListener('dragover', (e) => { e.preventDefault(); $$('.drop-before', list).forEach((x) => x.classList.remove('drop-before')); row.classList.add('drop-before'); });
          row.addEventListener('drop', async (e) => {
            e.preventDefault();
            if (dragId == null || dragId === it.id) return;
            const from = items.findIndex((x) => x.id === dragId);
            const [m] = items.splice(from, 1);
            items.splice(items.findIndex((x) => x.id === it.id), 0, m);
            dragId = null;
            renderList();
            await saveOrder();
          });
        }
        list.appendChild(row);
      });
    }

    function editItem(it) {
      const isNew = !it;
      const values = it ? { ...it } : { button_text: col === 'services' ? 'Conocer más' : undefined, included: col === 'complementary' ? 'Incluido' : undefined, example: false, group: col === 'links' ? 'Otros' : undefined, type: col === 'links' ? 'externo' : undefined };
      const fields = isNew && col === 'links' ? def.fields.filter((f) => f.name !== 'key') : def.fields;
      const form = buildForm(fields, values, { options, idPrefix: 'it' });
      const statusSel2 = h('select', { class: 'input', id: 'it-status', style: 'max-width:260px' }, Object.entries(STATUS).map(([k, v]) => h('option', { value: k }, v)));
      statusSel2.value = it ? it.status : 'borrador';
      const body = h('div', {},
        h('div', { class: 'field' }, h('label', { for: 'it-status' }, 'Estado'), statusSel2, h('div', { class: 'help' }, 'Borrador: en preparación. Publicado: visible tras «Publicar cambios». Despublicado: oculto en el sitio.')),
        col === 'testimonials' ? h('div', { class: 'notice warn' }, icEl('alert', 18), h('p', {}, 'Publica solo testimonios reales y con autorización de la persona. Los de ejemplo se muestran marcados como «Ejemplo ilustrativo».')) : null,
        form.el);
      const initialStatus = statusSel2.value;
      const save = h('button', { type: 'button', class: 'btn' }, icEl('check', 18), 'Guardar cambios');
      const preview = h('button', { type: 'button', class: 'btn btn-ghost' }, icEl('eye', 18), 'Vista previa');
      const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar');
      const isDirty = () => form.dirty() || statusSel2.value !== initialStatus;
      const d = dialog({
        title: isNew ? `Agregar ${def.singular}` : `Editar ${def.singular}`, body, drawer: true,
        actions: col.endsWith('_categories') || col === 'links' ? [cancel, save] : [preview, 'spacer', cancel, save],
        beforeClose: () => {
          if (!isDirty()) return true;
          confirmDialog('Tienes cambios sin guardar. ¿Deseas descartarlos?', { okText: 'Descartar', danger: true }).then((ok) => { if (ok) d.close(false); });
          return false;
        }
      });
      cancel.addEventListener('click', () => d.close());
      preview.addEventListener('click', async () => {
        try {
          const r = await api('POST', '/preview', { items: [{ collection: col, id: it ? it.id : -1, data: form.collect(), status: 'publicado' }] });
          openPreview(previewUrl(r.url, COLLECTION_PAGE[col]), 'Vista previa · ' + (form.collect()[def.titleField] || def.singular));
        } catch (e) { toast(e.message, 'err'); }
      });
      save.addEventListener('click', async () => {
        save.disabled = true;
        try {
          const payload = { data: form.collect(), status: statusSel2.value };
          if (isNew) await api('POST', `/items/${col}`, payload);
          else await api('PUT', `/items/${col}/${it.id}`, payload);
          d.close(true);
          toast('Cambios guardados correctamente.');
          refreshStatus();
          await load();
          if (opts.onChange) opts.onChange();
        } catch (e) {
          if (e.data && e.data.errors) form.showErrors(e.data.errors);
          toast(e.message, 'err');
        } finally { save.disabled = false; }
      });
    }

    async function removeItem(it) {
      const title = it[def.titleField] || def.singular;
      const ok = await confirmDialog(`¿Estás seguro de que deseas eliminar «${title}»?`, { danger: true, okText: 'Eliminar', title: 'Eliminar elemento', detail: h('p', { class: 'muted small', style: 'margin-top:8px' }, 'La eliminación se reflejará en el sitio al publicar los cambios. Si solo quieres ocultarlo, usa el interruptor para desactivarlo.') });
      if (!ok) return;
      try { await api('DELETE', `/items/${col}/${it.id}`); toast('Elemento eliminado.'); refreshStatus(); await load(); if (opts.onChange) opts.onChange(); }
      catch (e) { toast(e.message, 'err'); }
    }

    async function load() {
      [items, options] = await Promise.all([api('GET', `/items/${col}`), selectOptions()]);
      if (catSel) {
        const cur = catSel.value;
        const cats = def.filterField === 'group' ? SS.LINK_GROUPS : (options[def.fields.find((f) => f.name === def.filterField).source] || []);
        catSel.innerHTML = '';
        catSel.append(h('option', { value: '' }, def.filterField === 'group' ? 'Todas las ubicaciones' : 'Todas las categorías'), ...cats.map((c) => h('option', {}, c)));
        catSel.value = cur;
      }
      renderList();
    }
    load();
    root.reload = load;
    return root;
  }

  // =====================================================================
  //  Inicio / panel de control
  // =====================================================================
  router.add('inicio', {
    title: 'Inicio', async render() {
      const d = await api('GET', '/dashboard');
      const s = d.stats;
      const stat = (icon, n, label, href, alert) => h(href ? 'a' : 'div', { class: 'card stat' + (alert ? ' alert' : ''), href: href || null }, h('span', { class: 'stat-ic', html: ic(icon, 22) }), h('div', {}, h('strong', {}, n), h('span', {}, label)));
      const lastUpd = d.last_publication ? fmtDate(d.last_publication.at, true) : '—';
      const root = h('div');
      root.appendChild(h('div', { class: 'page-head' }, h('div', {}, h('h2', { style: 'margin:0' }, `Hola, ${state.user.name.split(' ')[0]}`), h('p', {}, 'Este es el resumen del estado de la página de Seniors.'))));
      if (d.pending_changes && can('publish')) root.appendChild(h('div', { class: 'notice warn' }, icEl('alert', 18), h('div', { style: 'flex:1' }, h('p', {}, h('strong', {}, 'Hay cambios guardados que aún no se han publicado.'), ' Revísalos con la vista previa y publícalos cuando estén listos.')), h('button', { type: 'button', class: 'btn btn-sm', onclick: () => window.A.publishDialog() }, 'Publicar cambios')));
      const u = d.unvalidated || {};
      if (can('content') && (u.benefits || u.faqs || u.testimonials_example)) {
        root.appendChild(h('div', { class: 'notice' }, icEl('shield', 18), h('p', {},
          'Contenido pendiente de validación por Seniors: ',
          [u.benefits ? `${u.benefits} beneficio(s)` : null, u.faqs ? `${u.faqs} respuesta(s) frecuente(s)` : null, u.testimonials_example ? `${u.testimonials_example} testimonio(s) de ejemplo publicados` : null].filter(Boolean).join(', ') + '.')));
      }
      root.appendChild(h('div', { class: 'stats' },
        stat('heart', s.services, 'Servicios publicados', can('content') ? '#/servicios' : null),
        stat('sparkles', s.experiences, 'Experiencias publicadas', can('content') ? '#/experiencias' : null),
        stat('quote', s.testimonials, 'Testimonios activos', can('content') ? '#/testimonios' : null),
        stat('image', s.images, 'Imágenes almacenadas' + (s.videos ? ` · ${s.videos} videos` : ''), can('media') ? '#/multimedia' : null),
        stat('inbox', s.pending, 'Solicitudes pendientes', can('requests') ? '#/solicitudes' : null, s.pending > 0),
        stat('calendar', lastUpd, 'Última publicación', can('history') ? '#/historial' : null)));
      // stat de fecha con fuente menor
      const last = root.querySelector('.stats .stat:last-child strong'); if (last) last.style.fontSize = '1.05rem';

      const quick = h('div', { class: 'quick' },
        can('content') ? h('a', { href: '#/textos/hero' }, icEl('layout', 22), 'Editar página principal') : null,
        can('content') ? h('a', { href: '#/experiencias?nuevo' }, icEl('plus', 22), 'Agregar experiencia') : null,
        can('media') ? h('a', { href: '#/multimedia?subir' }, icEl('upload', 22), 'Agregar fotografía') : null,
        can('requests') ? h('a', { href: '#/solicitudes' }, icEl('inbox', 22), 'Revisar solicitudes') : null,
        h('a', { href: '/', target: '_blank', rel: 'noopener' }, icEl('globe', 22), 'Ver sitio público'));
      const act = h('ul', { class: 'activity' }, d.activity.length ? d.activity.map((a) => h('li', {}, h('span', { class: 'a-ic', html: ic(a.pub_state === 'publicado' ? 'rocket' : 'edit', 15) }),
        h('div', { class: 'a-main' }, h('div', {}, h('strong', {}, a.action), ' — ', a.label), h('small', {}, `${a.user_name || 'Sistema'} · ${a.entity} · ${relTime(a.at)}`)),
        h('span', { class: 'badge ' + (a.pub_state === 'publicado' ? 'badge-publicado' : a.pub_state === 'sin publicar' ? 'badge-borrador' : 'badge-neutral') }, a.pub_state))) : h('li', { class: 'muted' }, 'Sin actividad reciente.'));
      root.appendChild(h('div', { class: 'dash-grid' },
        h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', {}, 'Actividad reciente'), can('history') ? h('a', { href: '#/historial', class: 'btn btn-ghost btn-sm' }, 'Ver historial') : null), act),
        h('section', { class: 'card', style: 'align-self:start' }, h('div', { class: 'card-head' }, h('h2', {}, 'Accesos rápidos')), quick)));
      return root;
    }
  });

  // =====================================================================
  //  Página principal (secciones)
  // =====================================================================
  const SECTION_ICONS = { hero: 'home', home: 'sparkles', benefits: 'heart', services: 'hand-heart', facilities: 'building', tour: 'compass', experiences: 'sparkles', testimonials: 'quote', faq: 'help-circle', booking: 'calendar', footer: 'layout' };
  const SECTION_MANAGE = { benefits: '#/beneficios', services: '#/servicios', facilities: '#/instalaciones', tour: '#/instalaciones/tour', experiences: '#/experiencias', testimonials: '#/testimonios', faq: '#/preguntas' };
  // Páginas del sitio público (cada opción del menú es una página independiente)
  const SITE_PAGES = [
    { key: 'inicio', path: '/', label: 'Inicio', desc: 'Resumen de todas las secciones con accesos a cada página.', sections: ['hero', 'home'] },
    { key: 'nosotros', path: '/nosotros', label: 'Nosotros', sections: ['benefits'] },
    { key: 'servicios', path: '/servicios', label: 'Servicios', sections: ['services'] },
    { key: 'instalaciones', path: '/instalaciones', label: 'Instalaciones', sections: ['facilities', 'tour'] },
    { key: 'experiencias', path: '/experiencias', label: 'Experiencias', sections: ['experiences'] },
    { key: 'testimonios', path: '/testimonios', label: 'Testimonios', sections: ['testimonials'] },
    { key: 'preguntas', path: '/preguntas-frecuentes', label: 'Preguntas frecuentes', sections: ['faq'] },
    { key: 'contacto', path: '/contacto', label: 'Contacto', sections: ['booking'] }
  ];
  const COLLECTION_PAGE = { benefits: 'nosotros', services: 'servicios', complementary: 'servicios', facilities: 'instalaciones', facility_categories: 'instalaciones', tour: 'instalaciones', experiences: 'experiencias', experience_categories: 'experiencias', testimonials: 'testimonios', faqs: 'preguntas' };
  const previewUrl = (base, page) => base + (base.includes('?') ? '&' : '?') + 'page=' + (page || 'inicio');

  router.add('pagina', {
    title: 'Página principal', perm: 'content', async render() {
      const content = await api('GET', '/content');
      const hidden = new Set((content.layout || {}).hidden || []);
      const root = h('div');
      root.appendChild(pageHead('Páginas del sitio', 'El sitio tiene una página por cada opción del menú. «Inicio» muestra un resumen; las demás muestran solo su propio contenido. Desactivar una página la oculta del menú y del resumen de Inicio.',
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => openPreview('/preview', 'Vista previa') }, icEl('eye', 18), 'Vista previa')));
      root.appendChild(workflowNotice());
      const setHidden = async (key, on, card, input) => {
        if (on) hidden.delete(key); else hidden.add(key);
        try { await api('PUT', '/content/layout', { hidden: [...hidden] }); toast(on ? 'Activado. Publica los cambios para mostrarlo.' : 'Desactivado. Publica los cambios para ocultarlo.'); if (card) card.classList.toggle('is-off', !on); refreshStatus(); }
        catch (err) { input.checked = !input.checked; }
      };
      const list = h('div', { class: 'grid' });
      SITE_PAGES.forEach((pg) => {
        const main = pg.sections[0];
        const def = SS.SECTIONS[main];
        const off = def.toggle && hidden.has(main);
        const sec = content[main] || {};
        const card = h('div', { class: 'card section-card' + (off ? ' is-off' : '') },
          h('span', { class: 'sc-ic', html: ic(SECTION_ICONS[main], 22) }),
          h('div', { class: 'sc-main' }, h('strong', {}, pg.label, ' ', h('code', { class: 'small muted' }, pg.path)), h('small', {}, pg.desc || sec.title || '')),
          h('div', { class: 'sc-actions' },
            def.toggle ? h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !off, 'aria-label': 'Página ' + pg.label + ' visible', onchange: (e) => setHidden(main, e.target.checked, card, e.target) }), h('span', { class: 'track' }), h('span', {}, 'Visible')) : h('span', { class: 'badge badge-neutral' }, 'Siempre visible'),
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => openPreview(previewUrl('/preview', pg.key), 'Vista previa · ' + pg.label) }, icEl('eye', 16), 'Ver'),
            SECTION_MANAGE[main] ? h('a', { class: 'btn btn-ghost btn-sm', href: SECTION_MANAGE[main] }, icEl('layout', 16), 'Elementos') : null,
            ...pg.sections.map((k) => h('a', { class: 'btn btn-sm', href: '#/textos/' + k }, icEl('edit', 16), pg.sections.length > 1 ? 'Editar ' + (k === 'hero' ? 'presentación' : k === 'home' ? 'invitación' : 'recorrido') : 'Editar textos'))));
        list.appendChild(card);
        // El recorrido virtual tiene su propio interruptor dentro de Instalaciones
        if (pg.key === 'instalaciones') {
          const tOff = hidden.has('tour');
          list.appendChild(h('div', { class: 'card section-card', style: 'margin-left:clamp(12px,4vw,48px)' },
            h('span', { class: 'sc-ic', html: ic('compass', 22) }),
            h('div', { class: 'sc-main' }, h('strong', {}, 'Recorrido virtual'), h('small', {}, 'Botón y visor panorámico de la página de Instalaciones')),
            h('div', { class: 'sc-actions' }, h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: !tOff, 'aria-label': 'Recorrido virtual visible', onchange: (e) => setHidden('tour', e.target.checked, null, e.target) }), h('span', { class: 'track' }), h('span', {}, 'Visible')),
              h('a', { class: 'btn btn-ghost btn-sm', href: '#/instalaciones/tour' }, icEl('layout', 16), 'Espacios'))));
        }
      });
      list.appendChild(h('div', { class: 'card section-card' },
        h('span', { class: 'sc-ic', html: ic('layout', 22) }),
        h('div', { class: 'sc-main' }, h('strong', {}, 'Pie de página'), h('small', {}, 'Común a todas las páginas')),
        h('div', { class: 'sc-actions' }, h('span', { class: 'badge badge-neutral' }, 'Siempre visible'), h('a', { class: 'btn btn-sm', href: '#/textos/footer' }, icEl('edit', 16), 'Editar textos'))));
      root.appendChild(list);
      return root;
    }
  });

  // =====================================================================
  //  Textos y contenidos
  // =====================================================================
  router.add('textos', {
    title: 'Textos y contenidos', perm: 'content', async render(rest) {
      const key = rest[0];
      if (key && SS.SECTIONS[key]) return sectionEditor(key);
      const content = await api('GET', '/content');
      const root = h('div');
      root.appendChild(pageHead('Textos y contenidos', 'Elige una sección para modificar sus títulos, descripciones y textos.'));
      const grid = h('div', { class: 'grid grid-2' });
      Object.entries(SS.SECTIONS).filter(([, d]) => can(d.permission)).forEach(([k, def]) => {
        const sec = content[k] || {};
        grid.appendChild(h('a', { class: 'card section-card', href: '#/textos/' + k, style: 'text-decoration:none;color:inherit' },
          h('span', { class: 'sc-ic', html: ic(SECTION_ICONS[k] || 'type', 22) }),
          h('div', { class: 'sc-main' }, h('strong', {}, def.label), h('small', {}, `${def.fields.length} campos editables` + (sec.title ? ' · ' + sec.title : ''))),
          h('span', { html: ic('chevron-right', 20), class: 'muted' })));
      });
      root.appendChild(grid);
      return root;
    }
  });

  async function sectionEditor(key, backHref) {
    const def = SS.SECTIONS[key] || SS.SETTINGS[key];
    const [content, links, options] = await Promise.all([api('GET', '/content'), linksByKey(), selectOptions()]);
    const form = buildForm(def.fields, content[key] || {}, { links, options, idPrefix: key });
    const root = h('div');
    const back = backHref || '#/textos';
    const save = h('button', { type: 'button', class: 'btn' }, icEl('check', 18), 'Guardar cambios');
    const cancel = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Cancelar');
    const preview = h('button', { type: 'button', class: 'btn btn-ghost' }, icEl('eye', 18), 'Vista previa');
    let saved = false;
    const linkDirty = () => form.links().some(({ item, text, url }) => item.text !== text || item.url !== url);
    router.setGuard(() => !saved && (form.dirty() || linkDirty()));
    cancel.addEventListener('click', () => { location.hash = back; });
    preview.addEventListener('click', async () => {
      try {
        const content2 = { [key]: form.collect() };
        const r = await api('POST', '/preview', { content: content2, items: form.links().map(({ item, text, url }) => ({ collection: 'links', id: item.id, status: item.status, data: { ...item, text, url } })) });
        openPreview(key === 'policies' ? r.url + '&page=privacy' : previewUrl(r.url, def.page), 'Vista previa · ' + def.label);
      } catch (e) { toast(e.message, 'err'); }
    });
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        await saveLinkRefs(form);
        await api('PUT', '/content/' + key, form.collect());
        saved = true;
        toast('Cambios guardados correctamente.');
        refreshStatus();
        router.reload();
      } catch (e) {
        if (e.data && e.data.errors) form.showErrors(e.data.errors);
        toast(e.message, 'err');
      } finally { save.disabled = false; }
    });
    root.appendChild(h('div', { class: 'page-head' },
      h('div', {}, h('a', { href: back, class: 'small', style: 'display:inline-flex;align-items:center;gap:4px;margin-bottom:6px' }, icEl('chevron-left', 16), 'Volver'), h('h2', { style: 'margin:0' }, def.label)),
      h('div', { class: 'page-actions' }, preview, cancel, save)));
    root.appendChild(workflowNotice());
    if (def.collection && SECTION_MANAGE[key]) root.appendChild(h('p', { class: 'small' }, 'Las tarjetas y elementos de esta sección se administran en ', h('a', { href: SECTION_MANAGE[key] }, (SS.COLLECTIONS[def.collection] || {}).label || 'su módulo'), '.'));
    root.appendChild(h('div', { class: 'card card-pad' }, form.el));
    root.appendChild(h('div', { class: 'page-actions', style: 'justify-content:flex-end;margin-top:16px' }, preview.cloneNode(true), save.cloneNode(true)));
    // Los botones duplicados al final reutilizan las mismas acciones
    const [p2, s2] = $$('.page-actions:last-child .btn', root);
    p2.addEventListener('click', () => preview.click());
    s2.addEventListener('click', () => save.click());
    return root;
  }

  // =====================================================================
  //  Colecciones
  // =====================================================================
  router.add('beneficios', { title: '¿Por qué elegir Seniors?', perm: 'content', navParent: 'pagina', async render() {
    return h('div', {}, pageHead('Beneficios', 'Tarjetas de la sección «¿Por qué elegir Seniors?». Marca cada una como validada cuando la institución confirme la información.', h('a', { class: 'btn btn-ghost', href: '#/textos/benefits' }, icEl('type', 18), 'Textos de la sección')), workflowNotice(), collectionManager('benefits'));
  } });
  router.add('servicios', { title: 'Servicios', perm: 'content', async render() {
    return h('div', {}, pageHead('Servicios', 'Servicios principales (tarjetas con fotografía) y servicios complementarios (iconos).', h('a', { class: 'btn btn-ghost', href: '#/textos/services' }, icEl('type', 18), 'Textos de la sección')), workflowNotice(),
      tabs([{ key: 'main', label: 'Servicios principales', render: () => collectionManager('services') }, { key: 'comp', label: 'Servicios complementarios', render: () => collectionManager('complementary') }]));
  } });
  router.add('instalaciones', { title: 'Instalaciones', perm: 'content', async render(rest) {
    return h('div', {}, pageHead('Instalaciones', 'Galería de fotografías por categorías y espacios del recorrido virtual (imágenes panorámicas).', h('a', { class: 'btn btn-ghost', href: '#/textos/facilities' }, icEl('type', 18), 'Textos de la sección')), workflowNotice(),
      tabs([
        { key: 'fotos', label: 'Fotografías', render: () => collectionManager('facilities', { addLabel: 'Agregar fotografía' }) },
        { key: 'cats', label: 'Categorías', render: () => collectionManager('facility_categories') },
        { key: 'tour', label: 'Recorrido virtual', render: () => h('div', {}, h('p', { class: 'muted' }, 'Cada espacio usa una imagen panorámica horizontal. Los visitantes pueden girar la vista arrastrando o con las flechas.'), collectionManager('tour', { addLabel: 'Agregar espacio' })) }
      ], rest[0] === 'tour' ? 'tour' : 'fotos'));
  } });
  router.add('experiencias', { title: 'Experiencias y actividades', perm: 'content', async render() {
    const mgr = collectionManager('experiences', { addLabel: 'Agregar experiencia' });
    const root = h('div', {}, pageHead('Experiencias', 'Publicaciones con fotografía o video. Guarda borradores y publícalas cuando estén listas.', h('a', { class: 'btn btn-ghost', href: '#/textos/experiences' }, icEl('type', 18), 'Textos de la sección')), workflowNotice(),
      tabs([{ key: 'posts', label: 'Publicaciones', render: () => mgr }, { key: 'cats', label: 'Categorías', render: () => collectionManager('experience_categories') }]));
    if (location.hash.includes('?nuevo')) setTimeout(() => { const b = $$('.toolbar .btn', root).find((x) => x.textContent.includes('Agregar')); if (b) b.click(); history.replaceState(null, '', '#/experiencias'); }, 400);
    return root;
  } });
  router.add('testimonios', { title: 'Testimonios', perm: 'content', async render() {
    return h('div', {}, pageHead('Testimonios', 'Experiencias de familias y residentes. Solo deben publicarse testimonios reales y autorizados.', h('a', { class: 'btn btn-ghost', href: '#/textos/testimonials' }, icEl('type', 18), 'Textos de la sección')), workflowNotice(), collectionManager('testimonials', { addLabel: 'Agregar testimonio' }));
  } });
  router.add('preguntas', { title: 'Preguntas frecuentes', perm: 'content', async render() {
    return h('div', {}, pageHead('Preguntas frecuentes', 'Preguntas y respuestas del acordeón. También alimentan las opciones del chat de atención.', h('a', { class: 'btn btn-ghost', href: '#/textos/faq' }, icEl('type', 18), 'Textos de la sección')), workflowNotice(), collectionManager('faqs', { addLabel: 'Agregar pregunta' }));
  } });
  router.add('enlaces', { title: 'Enlaces y botones', perm: 'links', async render() {
    const content = await api('GET', '/content');
    const S = content.settings || {};
    const wa = S.whatsapp ? `https://wa.me/${S.whatsapp}` : '—';
    return h('div', {}, pageHead('Enlaces y botones', 'Cambia los destinos de los botones y enlaces sin editar el código. Usa la dirección de una página del sitio (/, /nosotros, /servicios, /instalaciones, /experiencias, /testimonios, /preguntas-frecuentes, /contacto o /contacto#agendar para ir directo al formulario) o https:// para sitios externos.'),
      workflowNotice(),
      h('div', { class: 'card section-card', style: 'margin-bottom:14px' }, h('span', { class: 'sc-ic', html: ic('whatsapp', 22) }),
        h('div', { class: 'sc-main' }, h('strong', {}, 'Enlace de WhatsApp (botón flotante y pie de página)'), h('small', {}, `${wa} · Mensaje: «${S.whatsapp_message || ''}»`)),
        can('settings') ? h('a', { class: 'btn btn-ghost btn-sm', href: '#/configuracion' }, icEl('settings', 16), 'Modificar en Configuración') : null),
      collectionManager('links', { addLabel: 'Agregar enlace' }));
  } });

  // =====================================================================
  //  Biblioteca multimedia
  // =====================================================================
  router.add('multimedia', { title: 'Imágenes y multimedia', perm: 'media', async render() {
    let items = [];
    const q = { text: '', cat: '', kind: '' };
    const root = h('div');
    const grid = h('div', { class: 'media-grid' });
    const count = h('span', { class: 'muted small' });
    const upBtn = h('button', { type: 'button', class: 'btn', onclick: () => uploadDialog() }, icEl('upload', 18), 'Subir archivos');
    root.appendChild(pageHead('Imágenes y multimedia', 'Biblioteca central de fotografías, videos y logotipos. Las imágenes se optimizan automáticamente a WebP.', upBtn));
    root.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'search' }, icEl('search', 18), h('input', { class: 'input', type: 'search', placeholder: 'Buscar archivos…', 'aria-label': 'Buscar archivos', oninput: (e) => { q.text = e.target.value.toLowerCase(); render(); } })),
      h('select', { class: 'input', style: 'width:auto', 'aria-label': 'Categoría', onchange: (e) => { q.cat = e.target.value; render(); } }, h('option', { value: '' }, 'Todas las categorías'), SS.MEDIA_CATEGORIES.map((c) => h('option', {}, c))),
      h('select', { class: 'input', style: 'width:auto', 'aria-label': 'Tipo', onchange: (e) => { q.kind = e.target.value; render(); } }, h('option', { value: '' }, 'Imágenes y videos'), h('option', { value: 'image' }, 'Solo imágenes'), h('option', { value: 'video' }, 'Solo videos'))));
    root.appendChild(h('div', { style: 'margin:-4px 0 10px' }, count));
    root.appendChild(grid);

    function render() {
      const l = items.filter((m) => (!q.cat || m.category === q.cat) && (!q.kind || m.kind === q.kind) && (!q.text || (m.name + ' ' + (m.original_name || '')).toLowerCase().includes(q.text)));
      count.textContent = `${l.length} archivo${l.length === 1 ? '' : 's'}`;
      grid.innerHTML = '';
      if (!l.length) { grid.appendChild(h('div', { class: 'card empty', style: 'grid-column:1/-1' }, icEl('image', 32), h('p', {}, 'No hay archivos que coincidan.'))); return; }
      l.forEach((m) => grid.appendChild(h('div', { class: 'card media-card' },
        h('button', { type: 'button', class: 'mc-thumb', style: m.kind === 'image' ? `background-image:url('${encodeURI(m.thumb_url || m.url)}')` : '', 'aria-label': 'Ver ' + m.name, onclick: () => viewMedia(m) },
          m.kind === 'video' ? h('video', { src: m.url + '#t=0.5', preload: 'metadata', muted: true }) : null,
          h('span', { class: 'badge badge-neutral mc-kind' }, m.kind === 'video' ? 'Video' : (m.mime || '').split('/')[1]?.replace('svg+xml', 'svg').toUpperCase())),
        h('div', { class: 'mc-body' },
          h('strong', { title: m.name }, m.name),
          h('div', { class: 'mc-meta' }, h('span', {}, m.category), h('span', {}, fmtDate(m.created_at)), m.size ? h('span', {}, fmtSize(m.size)) : null),
          h('div', { class: 'mc-actions' },
            h('button', { type: 'button', class: 'icon-btn sm', title: 'Editar datos', 'aria-label': 'Editar ' + m.name, html: ic('edit', 16), onclick: () => editMedia(m) }),
            h('label', { class: 'icon-btn sm', title: 'Reemplazar archivo', 'aria-label': 'Reemplazar ' + m.name, html: ic('refresh', 16) + `<input type="file" hidden accept="${m.kind === 'video' ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/svg+xml,image/avif'}">`, onchange: (e) => replaceMedia(m, e.target.files[0]) }),
            h('button', { type: 'button', class: 'icon-btn sm', title: 'Copiar dirección', 'aria-label': 'Copiar dirección de ' + m.name, html: ic('copy', 16), onclick: () => { navigator.clipboard && navigator.clipboard.writeText(location.origin + m.url); toast('Dirección copiada.'); } }),
            h('button', { type: 'button', class: 'icon-btn sm danger', title: 'Eliminar', 'aria-label': 'Eliminar ' + m.name, html: ic('trash', 16), onclick: () => removeMedia(m) }))))));
    }
    function viewMedia(m) {
      dialog({ title: m.name, size: 'wide', body: h('div', {},
        m.kind === 'video' ? h('video', { src: m.url, controls: true, style: 'width:100%;border-radius:12px;background:#000' }) : h('img', { src: m.url, alt: m.alt || m.name, style: 'width:100%;border-radius:12px;background:var(--bg-2)' }),
        h('dl', { class: 'detail-list', style: 'margin-top:16px' },
          h('dt', {}, 'Archivo original'), h('dd', {}, m.original_name || '—'), h('dt', {}, 'Tipo'), h('dd', {}, m.mime),
          h('dt', {}, 'Dimensiones'), h('dd', {}, m.width ? `${m.width} × ${m.height} px` : '—'), h('dt', {}, 'Tamaño'), h('dd', {}, m.size ? fmtSize(m.size) : '—'),
          h('dt', {}, 'Cargado'), h('dd', {}, `${fmtDate(m.created_at, true)} · ${m.uploaded_by || ''}`), h('dt', {}, 'Dirección'), h('dd', {}, m.url))) });
    }
    function editMedia(m) {
      const name = h('input', { class: 'input', id: 'm-name', maxlength: 120 }); name.value = m.name;
      const alt = h('input', { class: 'input', id: 'm-alt', maxlength: 200 }); alt.value = m.alt || '';
      const cat = h('select', { class: 'input', id: 'm-cat' }, SS.MEDIA_CATEGORIES.map((c) => h('option', {}, c))); cat.value = m.category;
      const err = h('div', { class: 'err' });
      const ok = h('button', { type: 'button', class: 'btn' }, 'Guardar');
      const d = dialog({ title: 'Editar datos del archivo', body: h('div', {},
        h('div', { class: 'field' }, h('label', { for: 'm-name' }, 'Nombre'), name),
        h('div', { class: 'field' }, h('label', { for: 'm-alt' }, 'Texto alternativo (descripción para accesibilidad)'), alt),
        h('div', { class: 'field' }, h('label', { for: 'm-cat' }, 'Categoría'), cat), err),
        actions: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, 'Cancelar'), ok] });
      ok.addEventListener('click', async () => {
        try { await api('PUT', '/media/' + m.id, { name: name.value, alt: alt.value, category: cat.value }); d.close(true); toast('Cambios guardados correctamente.'); load(); }
        catch (e) { err.textContent = e.message; }
      });
    }
    async function replaceMedia(m, file) {
      if (!file) return;
      const ok = await confirmDialog(`¿Reemplazar «${m.name}» por «${file.name}»? Se actualizará en todas las secciones que lo usan (se verá en el sitio al publicar).`, { okText: 'Reemplazar' });
      if (!ok) return;
      const fd = new FormData(); fd.append('files', file);
      try { await api('POST', `/media/${m.id}/replace`, fd); toast('Imagen reemplazada correctamente.'); refreshStatus(); load(); }
      catch (e) { toast(e.message, 'err'); }
    }
    async function removeMedia(m) {
      let usage = [];
      try { usage = await api('GET', `/media/${m.id}/usage`); } catch (e) { return; }
      const detail = usage.length ? h('div', { class: 'notice warn', style: 'margin-top:12px' }, icEl('alert', 18), h('div', {},
        h('p', {}, h('strong', {}, 'Este archivo se está usando en la página:')),
        h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, [...new Set(usage.map((u) => `${u.place} (${u.scope})`))].map((t) => h('li', {}, t))),
        h('p', { style: 'margin-top:6px' }, 'Si lo eliminas, esas secciones quedarán sin imagen. Te recomendamos reemplazarlo en su lugar.'))) : null;
      const ok = await confirmDialog(`¿Estás seguro de que deseas eliminar «${m.name}»?`, { danger: true, okText: usage.length ? 'Eliminar de todas formas' : 'Eliminar', title: 'Eliminar archivo', detail });
      if (!ok) return;
      try { await api('DELETE', `/media/${m.id}${usage.length ? '?force=1' : ''}`); toast('Archivo eliminado.'); load(); }
      catch (e) { toast(e.message, 'err'); }
    }
    function uploadDialog() {
      let files = [];
      const list = h('div', { class: 'upload-list' });
      const cat = h('select', { class: 'input', id: 'up-cat' }, SS.MEDIA_CATEGORIES.map((c) => h('option', {}, c))); cat.value = 'General';
      const input = h('input', { type: 'file', multiple: true, hidden: true, accept: 'image/jpeg,image/png,image/webp,image/svg+xml,image/avif,video/mp4,video/webm', onchange: (e) => addFiles(e.target.files) });
      const dz = h('div', { class: 'dropzone', tabindex: '0', role: 'button', 'aria-label': 'Seleccionar archivos para subir', onclick: () => input.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } } },
        icEl('upload', 32), h('strong', { style: 'display:block' }, 'Arrastra archivos aquí o haz clic para seleccionarlos'),
        h('span', { class: 'muted small' }, 'Imágenes JPG, PNG, WebP o SVG (máx. 10 MB) · Videos MP4 o WebM (máx. 60 MB) · Hasta 10 archivos'), input);
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
      dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('is-over'); addFiles(e.dataTransfer.files); });
      function addFiles(fl) {
        for (const f of fl) {
          if (files.length >= 10) { toast('Máximo 10 archivos por carga.', 'warn'); break; }
          const isImg = /^image\/(jpeg|png|webp|svg\+xml|avif)$/.test(f.type), isVid = /^video\/(mp4|webm)$/.test(f.type);
          if (!isImg && !isVid) { toast(`«${f.name}»: formato no permitido.`, 'err'); continue; }
          if (isImg && f.size > 10 * 1048576) { toast(`«${f.name}»: supera 10 MB.`, 'err'); continue; }
          if (isVid && f.size > 60 * 1048576) { toast(`«${f.name}»: supera 60 MB.`, 'err'); continue; }
          files.push(f);
        }
        renderFiles();
      }
      function renderFiles() {
        list.innerHTML = '';
        files.forEach((f, i) => {
          const url = URL.createObjectURL(f);
          list.appendChild(h('div', { class: 'upload-item' },
            h('div', { class: 'ui-thumb', style: f.type.startsWith('image') ? `background-image:url('${url}')` : '' }, f.type.startsWith('video') ? h('video', { src: url, muted: true }) : null),
            h('div', { style: 'flex:1;min-width:0' }, h('strong', { style: 'display:block;font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, f.name), h('span', { class: 'muted small' }, fmtSize(f.size))),
            h('button', { type: 'button', class: 'icon-btn sm danger', 'aria-label': 'Quitar ' + f.name, html: ic('x', 16), onclick: () => { files.splice(i, 1); renderFiles(); } })));
        });
        ok.disabled = !files.length;
        ok.lastChild.textContent = files.length ? `Subir ${files.length} archivo${files.length === 1 ? '' : 's'}` : 'Subir';
      }
      const ok = h('button', { type: 'button', class: 'btn', disabled: true }, icEl('upload', 18), h('span', {}, 'Subir'));
      const d = dialog({ title: 'Subir archivos', size: 'wide', body: h('div', {}, dz, h('div', { class: 'field', style: 'margin-top:14px' }, h('label', { for: 'up-cat' }, 'Categoría'), cat), h('p', { class: 'small muted', style: 'margin:0' }, 'Vista previa de los archivos antes de guardar:'), list),
        actions: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, 'Cancelar'), ok] });
      ok.addEventListener('click', async () => {
        ok.disabled = true; ok.lastChild.textContent = 'Subiendo…';
        const fd = new FormData(); files.forEach((f) => fd.append('files', f)); fd.append('category', cat.value);
        try {
          const r = await api('POST', '/media', fd);
          (r.errors || []).forEach((e) => toast(e, 'err'));
          if (r.created && r.created.length) toast(r.created.length === 1 ? 'Imagen cargada correctamente.' : `${r.created.length} archivos cargados correctamente.`);
          d.close(true); load();
        } catch (e) { toast(e.message, 'err'); renderFiles(); }
      });
    }
    async function load() { items = await api('GET', '/media'); render(); }
    await load();
    if (location.hash.includes('?subir')) { history.replaceState(null, '', '#/multimedia'); setTimeout(uploadDialog, 100); }
    return root;
  } });

  // =====================================================================
  //  Identidad visual
  // =====================================================================
  router.add('identidad', { title: 'Identidad visual', perm: 'brand', async render() {
    const content = await api('GET', '/content');
    const def = SS.SETTINGS.brand;
    const form = buildForm(def.fields, content.brand || {}, { idPrefix: 'brand' });
    const S = content.settings || {};
    const pv = h('div');
    function renderPreview() {
      const b = form.collect();
      pv.innerHTML = '';
      pv.append(
        h('p', { class: 'small muted', style: 'margin:0 0 8px' }, 'Pestaña del navegador'),
        h('div', { class: 'brand-preview', style: 'background:#d9dedb;margin-bottom:16px' }, h('div', { class: 'bp-tab' }, b.favicon ? h('img', { src: b.favicon, alt: '' }) : null, h('span', {}, (content.seo || {}).title || S.name || 'Seniors')), h('div', { style: 'height:10px;background:#fff' })),
        h('p', { class: 'small muted', style: 'margin:0 0 8px' }, 'Encabezado (fondo claro)'),
        h('div', { class: 'brand-preview', style: 'margin-bottom:16px' }, h('div', { class: 'bp-header' }, b.logo_main ? h('img', { src: b.logo_main, alt: 'Logotipo principal' }) : h('span', { class: 'muted' }, 'Sin logotipo'), h('span', { class: 'bp-btn' }, 'Agendar una visita'))),
        h('p', { class: 'small muted', style: 'margin:0 0 8px' }, 'Pie de página (fondo oscuro)'),
        h('div', { class: 'brand-preview' }, h('div', { class: 'bp-footer' }, b.logo_dark ? h('img', { src: b.logo_dark, alt: 'Logotipo para fondos oscuros' }) : null, h('div', {}, (content.footer || {}).description || ''))),
        b.logo_light ? h('div', { style: 'margin-top:16px' }, h('p', { class: 'small muted', style: 'margin:0 0 8px' }, 'Logotipo para fondos claros'), h('div', { class: 'brand-preview', style: 'padding:16px;background:var(--bg)' }, h('img', { src: b.logo_light, alt: '', style: 'height:48px;width:auto' }))) : null);
    }
    form.el.addEventListener('input', renderPreview);
    form.el.addEventListener('click', () => setTimeout(renderPreview, 50));
    renderPreview();
    let saved = false;
    router.setGuard(() => !saved && form.dirty());
    const save = h('button', { type: 'button', class: 'btn', onclick: async () => {
      try { await api('PUT', '/content/brand', form.collect()); saved = true; toast('Cambios guardados correctamente. Publica los cambios para verlos en el sitio.'); refreshStatus(); router.reload(); }
      catch (e) { if (e.data && e.data.errors) form.showErrors(e.data.errors); toast(e.message, 'err'); }
    } }, icEl('check', 18), 'Guardar cambios');
    const prev = h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => { const r = await api('POST', '/preview', { content: { brand: form.collect() } }); openPreview(r.url, 'Vista previa · Identidad visual'); } }, icEl('eye', 18), 'Vista previa');
    return h('div', {}, pageHead('Identidad visual', 'Logotipos, favicon e imágenes institucionales. Los cambios se reflejan en el sitio después de guardar y publicar.', prev, save),
      workflowNotice(),
      h('div', { class: 'grid grid-2', style: 'align-items:start' }, h('div', { class: 'card card-pad' }, form.el), h('div', { class: 'card card-pad' }, h('h3', {}, 'Vista previa'), pv)));
  } });

  // =====================================================================
  //  Solicitudes de visita
  // =====================================================================
  router.add('solicitudes', { title: 'Solicitudes de visita', perm: 'requests', async render() {
    const q = { q: '', status: '', from: '', to: '', by: 'received' };
    let data = { rows: [], counts: {} };
    const root = h('div');
    const chips = h('div', { class: 'status-chips', role: 'group', 'aria-label': 'Filtrar por estado' });
    const tableWrap = h('div', { class: 'card' });
    const qs = () => new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
    const exportBtn = h('a', { class: 'btn btn-ghost', href: '#', onclick: (e) => { e.preventDefault(); location.href = '/api/admin/requests.csv?' + qs(); } }, icEl('download', 18), 'Exportar CSV');
    root.appendChild(pageHead('Solicitudes de visita', 'Solicitudes enviadas desde el formulario del sitio. Las visitas no se confirman automáticamente: verifica la disponibilidad y actualiza el estado.', exportBtn));
    root.appendChild(chips);
    let timer;
    root.appendChild(h('div', { class: 'toolbar' },
      h('div', { class: 'search' }, icEl('search', 18), h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre, correo, teléfono o servicio…', 'aria-label': 'Buscar solicitudes', oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { q.q = e.target.value; load(); }, 300); } })),
      h('select', { class: 'input', style: 'width:auto', 'aria-label': 'Filtrar fechas por', onchange: (e) => { q.by = e.target.value; load(); } }, h('option', { value: 'received' }, 'Fecha de recepción'), h('option', { value: 'visit' }, 'Fecha solicitada')),
      h('label', { class: 'small muted', style: 'display:flex;align-items:center;gap:6px' }, 'Desde', h('input', { class: 'input', type: 'date', style: 'width:auto', onchange: (e) => { q.from = e.target.value; load(); } })),
      h('label', { class: 'small muted', style: 'display:flex;align-items:center;gap:6px' }, 'Hasta', h('input', { class: 'input', type: 'date', style: 'width:auto', onchange: (e) => { q.to = e.target.value; load(); } }))));
    root.appendChild(tableWrap);

    function renderChips() {
      chips.innerHTML = '';
      const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
      const mk = (key, label, n) => h('button', { type: 'button', class: 'status-chip', 'aria-pressed': String(q.status === key), onclick: () => { q.status = key; load(); } }, label, h('b', {}, n || 0));
      chips.append(mk('', 'Todas', total), ...Object.entries(SS.REQUEST_STATUS).map(([k, v]) => mk(k, v, data.counts[k])));
    }
    function renderTable() {
      tableWrap.innerHTML = '';
      if (!data.rows.length) { tableWrap.appendChild(h('div', { class: 'empty' }, icEl('inbox', 32), h('p', {}, 'No hay solicitudes con estos filtros.'))); return; }
      const tb = h('tbody');
      data.rows.forEach((r) => tb.appendChild(h('tr', { class: 'clickable', tabindex: '0', onclick: () => detail(r), onkeydown: (e) => { if (e.key === 'Enter') detail(r); } },
        h('td', { class: 'td-main', 'data-label': 'Nombre' }, r.name),
        h('td', { 'data-label': 'Teléfono' }, r.phone),
        h('td', { 'data-label': 'Correo' }, r.email),
        h('td', { 'data-label': 'Servicio' }, r.service),
        h('td', { 'data-label': 'Fecha solicitada' }, fmtDate(r.preferred_date)),
        h('td', { 'data-label': 'Horario' }, r.preferred_time),
        h('td', { 'data-label': 'Recibida' }, fmtDate(r.created_at, true)),
        h('td', { 'data-label': 'Estado' }, h('span', { class: 'badge badge-' + r.status }, SS.REQUEST_STATUS[r.status])))));
      tableWrap.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table responsive' },
        h('thead', {}, h('tr', {}, ['Nombre', 'Teléfono', 'Correo', 'Servicio', 'Fecha solicitada', 'Horario', 'Recibida', 'Estado'].map((t) => h('th', { scope: 'col' }, t)))), tb)));
    }
    function detail(r) {
      const sel = h('select', { class: 'input', id: 'rq-status', style: 'max-width:240px' }, Object.entries(SS.REQUEST_STATUS).map(([k, v]) => h('option', { value: k }, v)));
      sel.value = r.status;
      const notes = h('ul', { class: 'timeline' });
      const renderNotes = (list) => { notes.innerHTML = ''; if (!list.length) notes.appendChild(h('li', { class: 'system' }, 'Sin observaciones.')); list.slice().reverse().forEach((n) => notes.appendChild(h('li', { class: n.system ? 'system' : '' }, h('small', {}, `${n.by} · ${fmtDate(n.at, true)}`), n.text))); };
      renderNotes(r.notes);
      const note = h('textarea', { class: 'input', id: 'rq-note', rows: 3, maxlength: 1000, placeholder: 'Ej.: Se llamó a la familia, prefieren el sábado en la mañana.' });
      const tel = r.phone.replace(/[^\d+]/g, '');
      const body = h('div', {},
        h('dl', { class: 'detail-list' },
          h('dt', {}, 'Nombre'), h('dd', {}, r.name),
          h('dt', {}, 'Teléfono'), h('dd', {}, h('a', { href: 'tel:' + tel }, r.phone)),
          h('dt', {}, 'Correo'), h('dd', {}, h('a', { href: 'mailto:' + r.email }, r.email)),
          h('dt', {}, 'Servicio de interés'), h('dd', {}, r.service),
          h('dt', {}, 'Fecha solicitada'), h('dd', {}, fmtDate(r.preferred_date)),
          h('dt', {}, 'Horario preferido'), h('dd', {}, r.preferred_time),
          h('dt', {}, 'Mensaje'), h('dd', {}, r.message || '—'),
          h('dt', {}, 'Recibida'), h('dd', {}, fmtDate(r.created_at, true)),
          h('dt', {}, 'Autorización de datos'), h('dd', {}, 'Aceptada el ' + fmtDate(r.consent_at, true))),
        h('div', { class: 'field' }, h('label', { for: 'rq-status' }, 'Estado de la solicitud'), h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, sel, h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => {
          if (sel.value === r.status) return;
          if (sel.value === 'confirmado') { const ok = await confirmDialog('¿Confirmas que ya verificaste la disponibilidad y acordaste la visita con la familia?', { okText: 'Sí, confirmar' }); if (!ok) return; }
          try { const u = await api('PATCH', '/requests/' + r.id, { status: sel.value }); Object.assign(r, u); renderNotes(u.notes); toast('Estado actualizado.'); load(); updateBell(); } catch (e) { toast(e.message, 'err'); }
        } }, 'Actualizar estado'))),
        h('h3', { style: 'margin-top:8px' }, 'Observaciones internas'), notes,
        h('div', { class: 'field' }, h('label', { for: 'rq-note' }, 'Nueva observación'), note),
        h('button', { type: 'button', class: 'btn', onclick: async () => {
          if (!note.value.trim()) return;
          try { const u = await api('POST', `/requests/${r.id}/notes`, { text: note.value }); r.notes = u.notes; renderNotes(u.notes); note.value = ''; toast('Observación registrada.'); } catch (e) { toast(e.message, 'err'); }
        } }, icEl('plus', 18), 'Agregar observación'));
      dialog({ title: `Solicitud #${r.id}`, body, drawer: true });
    }
    async function load() { data = await api('GET', '/requests?' + qs()); renderChips(); renderTable(); }
    await load();
    return root;
  } });

  // =====================================================================
  //  Historial
  // =====================================================================
  router.add('historial', { title: 'Historial de cambios', perm: 'history', async render() {
    const root = h('div');
    root.appendChild(pageHead('Historial de cambios', 'Registro de modificaciones (quién, cuándo, qué y estado de publicación) y versiones publicadas del sitio.'));
    root.appendChild(tabs([
      { key: 'act', label: 'Actividad', render: async () => {
        let page = 1, q = '';
        const wrap = h('div', { class: 'card' });
        const el = h('div', {}, h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icEl('search', 18), h('input', { class: 'input', type: 'search', placeholder: 'Buscar por usuario, elemento o acción…', 'aria-label': 'Buscar en el historial', onchange: (e) => { q = e.target.value; page = 1; load(); } }))), wrap);
        async function load() {
          const d = await api('GET', `/history?page=${page}&q=${encodeURIComponent(q)}`);
          wrap.innerHTML = '';
          if (!d.rows.length) { wrap.appendChild(h('div', { class: 'empty' }, 'Sin registros.')); return; }
          wrap.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table responsive' },
            h('thead', {}, h('tr', {}, ['Fecha y hora', 'Usuario', 'Elemento', 'Modificación', 'Publicación'].map((t) => h('th', { scope: 'col' }, t)))),
            h('tbody', {}, d.rows.map((a) => h('tr', {},
              h('td', { 'data-label': 'Fecha' }, fmtDate(a.at, true)),
              h('td', { 'data-label': 'Usuario' }, a.user_name || 'Sistema'),
              h('td', { class: 'td-main', 'data-label': 'Elemento' }, `${a.entity}: ${a.label}`),
              h('td', { 'data-label': 'Modificación' }, a.action),
              h('td', { 'data-label': 'Publicación' }, h('span', { class: 'badge ' + (a.pub_state === 'publicado' ? 'badge-publicado' : a.pub_state === 'sin publicar' ? 'badge-borrador' : 'badge-neutral') }, a.pub_state))))))));
          wrap.appendChild(h('div', { class: 'pager' }, h('span', { class: 'muted small' }, `Página ${d.page} de ${d.pages} · ${d.total} registros`),
            h('div', { style: 'display:flex;gap:6px' }, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: d.page <= 1, onclick: () => { page--; load(); } }, 'Anterior'), h('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: d.page >= d.pages, onclick: () => { page++; load(); } }, 'Siguiente'))));
        }
        await load();
        return el;
      } },
      { key: 'ver', label: 'Versiones publicadas', render: async () => {
        const list = await api('GET', '/publications');
        const wrap = h('div', {}, h('div', { class: 'notice' }, icEl('history', 18), h('p', {}, 'Restaurar una versión reemplaza la copia de trabajo (borrador) por el contenido de esa versión. El sitio público no cambia hasta que publiques.')));
        wrap.appendChild(h('ul', { class: 'item-list' }, list.map((p, i) => h('li', { class: 'item-row' },
          h('div', { class: 'item-thumb icon', html: ic(i === 0 ? 'rocket' : 'history', 22) }),
          h('div', { class: 'item-main' }, h('strong', {}, `Versión #${p.id}` + (i === 0 ? ' · publicada actualmente' : '')), h('small', {}, `${fmtDate(p.created_at, true)} · ${p.user_name || 'Sistema'}${p.note ? ' · ' + p.note : ''}`)),
          h('div', { class: 'item-actions' }, can('publish') && i > 0 ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async () => {
            const ok = await confirmDialog(`¿Restaurar la versión #${p.id} en la copia de trabajo? Se perderán los cambios guardados que no se hayan publicado.`, { okText: 'Restaurar', danger: true });
            if (!ok) return;
            try { await api('POST', `/publications/${p.id}/restore`); toast('Versión restaurada en el borrador. Revisa la vista previa y publica para aplicarla.'); refreshStatus(); } catch (e) { toast(e.message, 'err'); }
          } }, icEl('refresh', 16), 'Restaurar') : null)))));
        return wrap;
      } }
    ]));
    return root;
  } });

  // =====================================================================
  //  Configuración
  // =====================================================================
  router.add('configuracion', { title: 'Configuración', perm: 'settings', async render(rest) {
    const root = h('div');
    root.appendChild(pageHead('Configuración general', 'Información institucional usada en el encabezado, pie de página, formulario, WhatsApp y chat.'));
    const simpleEditor = (key) => async () => {
      const content = await api('GET', '/content');
      const def = SS.SETTINGS[key] || SS.SECTIONS[key];
      const form = buildForm(def.fields, content[key] || {}, { idPrefix: key });
      let saved = false;
      router.setGuard(() => !saved && form.dirty());
      const save = h('button', { type: 'button', class: 'btn', onclick: async () => {
        try { await api('PUT', '/content/' + key, form.collect()); saved = true; toast('Cambios guardados correctamente.'); refreshStatus(); }
        catch (e) { if (e.data && e.data.errors) form.showErrors(e.data.errors); toast(e.message, 'err'); }
      } }, icEl('check', 18), 'Guardar cambios');
      const prev = h('button', { type: 'button', class: 'btn btn-ghost', onclick: async () => { const r = await api('POST', '/preview', { content: { [key]: form.collect() } }); openPreview(key === 'policies' ? r.url + '&page=data' : r.url, 'Vista previa · ' + def.label); } }, icEl('eye', 18), 'Vista previa');
      return h('div', {}, workflowNotice(), h('div', { class: 'card card-pad' }, form.el, h('div', { class: 'page-actions', style: 'justify-content:flex-end;margin-top:8px' }, prev, save)));
    };
    root.appendChild(tabs([
      { key: 'general', label: 'Institución y contacto', render: simpleEditor('settings') },
      { key: 'seo', label: 'SEO y redes sociales', render: simpleEditor('seo') },
      { key: 'policies', label: 'Políticas legales', render: simpleEditor('policies') },
      { key: 'backup', label: 'Copias de seguridad', render: async () => h('div', { class: 'card card-pad' },
        h('h3', {}, 'Copias de seguridad'),
        h('p', { class: 'muted' }, 'El sistema guarda automáticamente una copia diaria de la base de datos (se conservan las últimas 14). También puedes descargar una copia ahora.'),
        h('a', { class: 'btn', href: '/api/admin/backup' }, icEl('download', 18), 'Descargar copia de seguridad'),
        h('p', { class: 'small muted', style: 'margin-top:12px' }, 'Las imágenes y videos se encuentran en la carpeta «uploads» del servidor y deben incluirse en el respaldo del alojamiento.')) }
    ], rest[0]));
    return root;
  } });

  // =====================================================================
  //  Usuarios y permisos
  // =====================================================================
  router.add('usuarios', { title: 'Usuarios y permisos', perm: 'users', async render() {
    const root = h('div');
    const wrap = h('div', { class: 'card' });
    const PERM_LABELS = { content: 'Textos y contenidos', media: 'Imágenes y multimedia', links: 'Enlaces y botones', brand: 'Identidad visual', settings: 'Configuración', requests: 'Solicitudes', publish: 'Publicar cambios', users: 'Usuarios', history: 'Historial' };
    root.appendChild(pageHead('Usuarios y permisos', 'Cada persona debe tener su propio usuario. Los permisos se aplican en la interfaz y en el servidor.', h('button', { type: 'button', class: 'btn', onclick: () => edit(null) }, icEl('plus', 18), 'Crear usuario')));
    root.appendChild(wrap);
    root.appendChild(h('h2', { style: 'margin-top:28px' }, 'Roles'));
    root.appendChild(h('div', { class: 'grid grid-3' }, Object.entries(state.roles).map(([k, r]) => h('div', { class: 'card card-pad' }, h('h3', {}, r.label), h('ul', { style: 'margin:0;padding-left:18px', class: 'small' }, r.perms.map((p) => h('li', {}, PERM_LABELS[p] || p)))))));

    async function load() {
      const users = await api('GET', '/users');
      wrap.innerHTML = '';
      wrap.appendChild(h('div', { class: 'table-wrap' }, h('table', { class: 'table responsive' },
        h('thead', {}, h('tr', {}, ['Nombre', 'Correo', 'Rol', 'Estado', 'Último acceso', ''].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, users.map((u) => h('tr', {},
          h('td', { class: 'td-main', 'data-label': 'Nombre' }, u.name, u.id === state.user.id ? h('span', { class: 'badge badge-neutral', style: 'margin-left:6px' }, 'Tú') : null),
          h('td', { 'data-label': 'Correo' }, u.email),
          h('td', { 'data-label': 'Rol' }, (state.roles[u.role] || {}).label),
          h('td', { 'data-label': 'Estado' }, h('span', { class: 'badge ' + (u.active ? 'badge-publicado' : 'badge-despublicado') }, u.active ? 'Activo' : 'Desactivado')),
          h('td', { 'data-label': 'Último acceso' }, u.last_login ? fmtDate(u.last_login, true) : 'Nunca'),
          h('td', { 'data-label': 'Acciones' }, h('div', { style: 'display:flex;gap:6px;justify-content:flex-end' },
            h('button', { type: 'button', class: 'icon-btn sm', title: 'Editar', 'aria-label': 'Editar ' + u.name, html: ic('edit', 16), onclick: () => edit(u) }),
            h('button', { type: 'button', class: 'icon-btn sm', title: 'Asignar contraseña', 'aria-label': 'Asignar contraseña a ' + u.name, html: ic('lock', 16), onclick: () => setPassword(u) })))))))));
    }
    function edit(u) {
      const isNew = !u;
      const name = h('input', { class: 'input', id: 'us-name', maxlength: 100 }); name.value = u ? u.name : '';
      const email = h('input', { class: 'input', id: 'us-email', type: 'email', maxlength: 160 }); email.value = u ? u.email : '';
      const role = h('select', { class: 'input', id: 'us-role' }, Object.entries(state.roles).map(([k, r]) => h('option', { value: k }, r.label))); role.value = u ? u.role : 'editor';
      const pw = h('input', { class: 'input', id: 'us-pw', type: 'text', autocomplete: 'new-password' });
      const active = h('input', { type: 'checkbox', id: 'us-active' }); active.checked = u ? u.active : true;
      const self = u && u.id === state.user.id;
      if (self) { role.disabled = true; active.disabled = true; }
      const err = h('div', { class: 'err' });
      const body = h('div', {},
        h('div', { class: 'field' }, h('label', { for: 'us-name' }, 'Nombre'), name),
        h('div', { class: 'field' }, h('label', { for: 'us-email' }, 'Correo electrónico (usuario)'), email),
        h('div', { class: 'field' }, h('label', { for: 'us-role' }, 'Rol'), role, self ? h('div', { class: 'help' }, 'No puedes cambiar tu propio rol.') : null),
        isNew ? h('div', { class: 'field' }, h('label', { for: 'us-pw' }, 'Contraseña temporal'), pw, h('div', { class: 'help' }, 'Mínimo 10 caracteres con letras y números. Se pedirá cambiarla en el primer ingreso. Entrégala por un canal seguro.')) : null,
        !isNew ? h('div', { class: 'field' }, h('label', { class: 'check-row', for: 'us-active' }, active, h('span', {}, 'Usuario activo (puede iniciar sesión)'))) : null, err);
      const ok = h('button', { type: 'button', class: 'btn' }, isNew ? 'Crear usuario' : 'Guardar cambios');
      const d = dialog({ title: isNew ? 'Crear usuario' : 'Editar usuario', body, actions: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, 'Cancelar'), ok] });
      ok.addEventListener('click', async () => {
        err.textContent = '';
        try {
          if (isNew) await api('POST', '/users', { name: name.value, email: email.value, role: role.value, password: pw.value });
          else {
            if (u.active && !active.checked) { const c = await confirmDialog(`¿Desactivar a ${u.name}? Su sesión se cerrará y no podrá ingresar.`, { danger: true, okText: 'Desactivar' }); if (!c) return; }
            await api('PUT', '/users/' + u.id, { name: name.value, email: email.value, role: role.value, active: active.checked });
          }
          d.close(true); toast(isNew ? 'Usuario creado.' : 'Cambios guardados correctamente.'); load();
        } catch (e) { err.textContent = e.data && e.data.errors ? Object.values(e.data.errors).join(' ') : e.message; }
      });
    }
    function setPassword(u) {
      const pw = h('input', { class: 'input', id: 'sp-pw', type: 'text', autocomplete: 'new-password' });
      const err = h('div', { class: 'err' });
      const ok = h('button', { type: 'button', class: 'btn' }, 'Asignar contraseña');
      const d = dialog({ title: 'Asignar contraseña a ' + u.name, body: h('div', {}, h('div', { class: 'field' }, h('label', { for: 'sp-pw' }, 'Nueva contraseña temporal'), pw, h('div', { class: 'help' }, 'Se cerrarán sus sesiones activas y deberá cambiarla al ingresar.')), err),
        actions: [h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => d.close() }, 'Cancelar'), ok] });
      ok.addEventListener('click', async () => {
        try { await api('POST', `/users/${u.id}/password`, { password: pw.value }); d.close(true); toast('Contraseña asignada.'); }
        catch (e) { err.textContent = e.message; }
      });
    }
    await load();
    return root;
  } });
})();

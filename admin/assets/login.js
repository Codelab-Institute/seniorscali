(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const views = ['login', 'forgot', 'reset'];
  function show(v) { views.forEach((x) => ($('#view-' + x).hidden = x !== v)); const f = $('#view-' + v + ' input'); if (f) f.focus(); }
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  const msg = (el, text, type) => { el.hidden = !text; el.textContent = text || ''; el.className = 'form-msg ' + (type || 'err'); };
  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudo completar la acción.');
    return j;
  }

  const params = new URLSearchParams(location.search);
  if (location.pathname.startsWith('/admin/restablecer')) show(params.get('token') ? 'reset' : 'forgot');

  $('.pw-toggle').addEventListener('click', (e) => {
    const i = $('#password'); const b = e.currentTarget;
    const vis = i.type === 'password'; i.type = vis ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(vis)); b.setAttribute('aria-label', vis ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#login-msg');
    const email = $('#email').value.trim(), password = $('#password').value;
    if (!email || !password) return msg(m, 'Ingresa tu correo y contraseña.');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Verificando…';
    try {
      await post('/api/auth/login', { email, password });
      const next = params.get('next');
      location.href = next && /^\/(admin|preview)(\/|\?|#|$)/.test(next) ? next : '/admin';
    } catch (err) {
      msg(m, err.message);
      $('#password').value = ''; $('#password').focus();
    } finally { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }
  });

  $('#forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#forgot-msg');
    const email = $('#f-email').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return msg(m, 'Ingresa un correo válido.');
    try { const j = await post('/api/auth/forgot', { email }); msg(m, j.message, 'ok'); } catch (err) { msg(m, err.message); }
  });

  $('#reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const m = $('#reset-msg');
    const a = $('#r-pw').value, b = $('#r-pw2').value;
    if (a !== b) return msg(m, 'Las contraseñas no coinciden.');
    try {
      await post('/api/auth/reset', { token: params.get('token'), password: a });
      msg(m, 'Contraseña actualizada. Ya puedes iniciar sesión.', 'ok');
      e.target.hidden = true;
    } catch (err) { msg(m, err.message); }
  });
})();

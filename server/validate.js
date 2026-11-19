/*
 * Validación y saneamiento en el servidor de todo lo que llega desde el panel.
 */
const sanitizeHtml = require('sanitize-html');
const { isValidUrl } = require('../shared/schema');
const { ICONS } = require('../shared/icons');

const RICH_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: {
    b: 'strong', i: 'em', div: 'p',
    a: (tagName, attribs) => {
      const href = attribs.href || '';
      const out = { href };
      if (/^https?:/i.test(href)) { out.target = '_blank'; out.rel = 'noopener noreferrer'; }
      return { tagName: 'a', attribs: out };
    }
  },
  exclusiveFilter: (frame) => frame.tag === 'a' && !isValidUrl(frame.attribs.href || ''),
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed']
};

function cleanRich(html) {
  return sanitizeHtml(String(html || ''), RICH_OPTIONS).trim();
}
function cleanText(s) {
  // Texto plano: sin etiquetas ni caracteres de control.
  return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/<[^>]*>/g, '').trim();
}
function isMediaRef(v) {
  return typeof v === 'string' && /^\/(uploads|placeholders|brand)\/[\w\-./]+\.(webp|png|jpe?g|svg|gif|mp4|webm|avif)$/i.test(v) && !v.includes('..');
}

/**
 * Valida `input` contra la lista de campos. `ctx.options` resuelve selects con fuente dinámica.
 * Devuelve { data, errors } (errors: { campo: mensaje }).
 */
function validateFields(fields, input, ctx) {
  const data = {};
  const errors = {};
  const src = input || {};
  for (const f of fields) {
    if (f.type === 'linkref') continue;
    let v = src[f.name];
    switch (f.type) {
      case 'rich': v = cleanRich(v); break;
      case 'checkbox': v = v === true || v === 'true' || v === 1 || v === '1' || v === 'on'; break;
      case 'lines': v = cleanText(v).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join('\n'); break;
      default: v = cleanText(v);
    }
    const empty = v === '' || v == null;
    if (f.required && empty && f.type !== 'checkbox') { errors[f.name] = 'Este campo es obligatorio.'; data[f.name] = v; continue; }
    if (!empty && f.max && typeof v === 'string' && v.length > f.max) errors[f.name] = `Máximo ${f.max} caracteres.`;
    if (!empty) {
      if (f.type === 'url' && !isValidUrl(v)) errors[f.name] = 'Dirección no válida. Usa una página (/servicios, /contacto#agendar), https://…, mailto: o tel:.';
      if ((f.type === 'image' || f.type === 'media') && !isMediaRef(v)) errors[f.name] = 'Selecciona un archivo de la biblioteca multimedia.';
      if (f.type === 'image' && /\.(mp4|webm)$/i.test(v)) errors[f.name] = 'Este campo solo admite imágenes.';
      if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.name] = 'Fecha no válida.';
      if (f.type === 'icon' && !ICONS[v]) errors[f.name] = 'Icono no válido.';
      if (f.type === 'select') {
        const opts = f.options || (ctx && ctx.options && ctx.options[f.source]) || [];
        if (!opts.includes(v)) errors[f.name] = 'Selecciona una opción válida.';
      }
      if (f.pattern && !new RegExp(f.pattern).test(v)) errors[f.name] = 'Formato no válido.';
    }
    data[f.name] = v;
  }
  return { data, errors };
}

module.exports = { validateFields, cleanRich, cleanText, isMediaRef };

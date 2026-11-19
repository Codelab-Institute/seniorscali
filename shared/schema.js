/*
 * Esquema de contenidos compartido entre servidor (validación) y panel (generación de formularios).
 *
 * Tipos de campo: text, textarea, rich, image, media (imagen o video), select, date, icon, url, checkbox, lines, linkref
 */
(function (root) {
  const STATUS = { borrador: 'Borrador', publicado: 'Publicado', despublicado: 'Despublicado' };

  const LINK_TYPES = { interno: 'Sección interna', externo: 'Sitio externo', whatsapp: 'WhatsApp', telefono: 'Teléfono', correo: 'Correo', red: 'Red social' };
  const LINK_GROUPS = ['Encabezado', 'Menú', 'Presentación principal', 'Servicios', 'Instalaciones', 'Redes sociales', 'Pie de página', 'Otros'];

  // ---- Colecciones administrables ----
  const COLLECTIONS = {
    benefits: {
      label: 'Beneficios', singular: 'beneficio', permission: 'content', titleField: 'title',
      section: '¿Por qué elegir Seniors?',
      fields: [
        { name: 'icon', label: 'Icono', type: 'icon', required: true },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 80 },
        { name: 'description', label: 'Descripción breve', type: 'textarea', required: true, max: 280 },
        { name: 'validated', label: 'Característica validada por Seniors', type: 'checkbox', help: 'Marca esta casilla cuando la institución haya confirmado el texto.' }
      ]
    },
    services: {
      label: 'Servicios principales', singular: 'servicio', permission: 'content', titleField: 'title', imageField: 'image',
      fields: [
        { name: 'image', label: 'Fotografía', type: 'image', required: true },
        { name: 'image_alt', label: 'Texto alternativo de la fotografía', type: 'text', max: 160 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 80 },
        { name: 'description', label: 'Descripción', type: 'textarea', required: true, max: 400 },
        { name: 'details', label: 'Información ampliada («Conocer más»)', type: 'rich', max: 4000 },
        { name: 'button_text', label: 'Texto del botón', type: 'text', max: 40, placeholder: 'Conocer más' },
        { name: 'link', label: 'Enlace del botón (opcional)', type: 'url', help: 'Si se deja vacío, el botón abre una ventana con la información ampliada. Ejemplo de enlace: /contacto#agendar' }
      ]
    },
    complementary: {
      label: 'Servicios complementarios', singular: 'servicio complementario', permission: 'content', titleField: 'title',
      fields: [
        { name: 'icon', label: 'Icono', type: 'icon', required: true },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 80 },
        { name: 'description', label: 'Descripción', type: 'textarea', max: 240 },
        { name: 'included', label: 'Modalidad', type: 'select', options: ['Incluido', 'Adicional'], required: true },
        { name: 'validated', label: 'Información verificada con Seniors', type: 'checkbox' }
      ]
    },
    facility_categories: {
      label: 'Categorías de instalaciones', singular: 'categoría', permission: 'content', titleField: 'name',
      fields: [{ name: 'name', label: 'Nombre', type: 'text', required: true, max: 60 }]
    },
    facilities: {
      label: 'Instalaciones', singular: 'fotografía', permission: 'content', titleField: 'title', imageField: 'image', filterField: 'category',
      fields: [
        { name: 'image', label: 'Fotografía', type: 'image', required: true },
        { name: 'title', label: 'Nombre', type: 'text', required: true, max: 80 },
        { name: 'description', label: 'Descripción', type: 'textarea', max: 300 },
        { name: 'category', label: 'Categoría', type: 'select', source: 'facility_categories', required: true }
      ]
    },
    tour: {
      label: 'Recorrido virtual', singular: 'espacio', permission: 'content', titleField: 'title', imageField: 'image',
      fields: [
        { name: 'image', label: 'Imagen panorámica', type: 'image', required: true, help: 'Usa una fotografía panorámica horizontal (proporción 3:1 o más amplia).' },
        { name: 'title', label: 'Nombre del espacio', type: 'text', required: true, max: 60 },
        { name: 'description', label: 'Descripción', type: 'textarea', max: 400 }
      ]
    },
    experience_categories: {
      label: 'Categorías de experiencias', singular: 'categoría', permission: 'content', titleField: 'name',
      fields: [{ name: 'name', label: 'Nombre', type: 'text', required: true, max: 60 }]
    },
    experiences: {
      label: 'Experiencias y actividades', singular: 'publicación', permission: 'content', titleField: 'title', imageField: 'media', filterField: 'category', dateField: 'date',
      fields: [
        { name: 'media', label: 'Fotografía o video', type: 'media', required: true },
        { name: 'poster', label: 'Imagen de portada del video (opcional)', type: 'image' },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 100 },
        { name: 'description', label: 'Descripción', type: 'textarea', max: 600 },
        { name: 'category', label: 'Categoría', type: 'select', source: 'experience_categories', required: true },
        { name: 'date', label: 'Fecha', type: 'date' }
      ]
    },
    testimonials: {
      label: 'Testimonios', singular: 'testimonio', permission: 'content', titleField: 'name', imageField: 'photo',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text', required: true, max: 80 },
        { name: 'relation', label: 'Relación con el residente', type: 'text', required: true, max: 80, placeholder: 'Hija de residente' },
        { name: 'photo', label: 'Fotografía (opcional)', type: 'image' },
        { name: 'comment', label: 'Comentario', type: 'textarea', required: true, max: 700 },
        { name: 'date', label: 'Fecha (opcional)', type: 'date' },
        { name: 'example', label: 'Testimonio de ejemplo', type: 'checkbox', help: 'Si está marcado, el sitio lo identifica como «Ejemplo ilustrativo». Desmárcalo solo para testimonios reales autorizados.' }
      ]
    },
    faqs: {
      label: 'Preguntas frecuentes', singular: 'pregunta', permission: 'content', titleField: 'question',
      fields: [
        { name: 'question', label: 'Pregunta', type: 'text', required: true, max: 160 },
        { name: 'answer', label: 'Respuesta', type: 'rich', required: true, max: 3000 },
        { name: 'validated', label: 'Respuesta proporcionada/validada por Seniors', type: 'checkbox' }
      ]
    },
    links: {
      label: 'Enlaces y botones', singular: 'enlace', permission: 'links', titleField: 'label', filterField: 'group',
      fields: [
        { name: 'label', label: 'Nombre del elemento', type: 'text', required: true, max: 80 },
        { name: 'text', label: 'Texto visible', type: 'text', max: 60 },
        { name: 'url', label: 'Dirección de destino', type: 'url', required: true },
        { name: 'type', label: 'Tipo de enlace', type: 'select', options: Object.keys(LINK_TYPES), labels: LINK_TYPES, required: true },
        { name: 'group', label: 'Ubicación', type: 'select', options: LINK_GROUPS, required: true },
        { name: 'icon', label: 'Icono (redes sociales)', type: 'icon', icons: ['facebook', 'instagram', 'youtube', 'tiktok', 'globe', 'whatsapp', 'link'] },
        { name: 'new_tab', label: 'Abrir en una pestaña nueva', type: 'checkbox' },
        { name: 'key', label: 'Identificador interno', type: 'text', readonly: true, max: 40, help: 'Lo usa el sitio para ubicar el enlace. No es necesario modificarlo.' }
      ]
    }
  };

  // ---- Secciones de contenido único ----
  const SECTIONS = {
    hero: {
      label: 'Presentación principal (Hero)', page: 'inicio', permission: 'content', toggle: false,
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 80 },
        { name: 'title', label: 'Título principal', type: 'text', required: true, max: 120 },
        { name: 'description', label: 'Descripción', type: 'textarea', required: true, max: 300 },
        { name: 'primary', label: 'Botón principal', type: 'linkref', key: 'hero_primary' },
        { name: 'secondary', label: 'Botón secundario', type: 'linkref', key: 'hero_secondary' },
        { name: 'image', label: 'Fotografía principal', type: 'image', required: true },
        { name: 'image_alt', label: 'Texto alternativo de la fotografía', type: 'text', max: 160 },
        { name: 'highlights', label: 'Datos destacados (uno por línea, formato «valor | texto»)', type: 'lines', max: 400 }
      ]
    },
    home: {
      label: 'Inicio: invitación final', page: 'inicio', permission: 'content', toggle: false,
      fields: [
        { name: 'cta_title', label: 'Título de la invitación', type: 'text', required: true, max: 120 },
        { name: 'cta_text', label: 'Texto de la invitación', type: 'textarea', max: 300 }
      ]
    },
    benefits: {
      label: '¿Por qué elegir Seniors?', page: 'nosotros', permission: 'content', toggle: true, collection: 'benefits',
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'rich', max: 1500 }
      ]
    },
    services: {
      label: 'Servicios', page: 'servicios', permission: 'content', toggle: true, collection: 'services',
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 500 },
        { name: 'complementary_title', label: 'Título de servicios complementarios', type: 'text', max: 120 },
        { name: 'complementary_intro', label: 'Texto de servicios complementarios', type: 'textarea', max: 400 }
      ]
    },
    facilities: {
      label: 'Instalaciones', page: 'instalaciones', permission: 'content', toggle: true, collection: 'facilities',
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 500 },
        { name: 'tour_button', label: 'Texto del botón del recorrido virtual', type: 'text', max: 60 }
      ]
    },
    tour: {
      label: 'Recorrido virtual', page: 'instalaciones', permission: 'content', toggle: true, collection: 'tour',
      fields: [
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 400 }
      ]
    },
    experiences: {
      label: 'Experiencias y actividades', page: 'experiencias', permission: 'content', toggle: true, collection: 'experiences',
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 500 }
      ]
    },
    testimonials: {
      label: 'Testimonios', page: 'testimonios', permission: 'content', toggle: true, collection: 'testimonials',
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 400 }
      ]
    },
    faq: {
      label: 'Preguntas frecuentes', page: 'preguntas', permission: 'content', toggle: true, collection: 'faqs',
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 400 }
      ]
    },
    booking: {
      label: 'Contacto y agendamiento de visitas', page: 'contacto', permission: 'content', toggle: true,
      fields: [
        { name: 'eyebrow', label: 'Antetítulo', type: 'text', max: 60 },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 120 },
        { name: 'intro', label: 'Texto introductorio', type: 'textarea', max: 500 },
        { name: 'time_slots', label: 'Horarios disponibles (uno por línea)', type: 'lines', required: true, max: 600 },
        { name: 'consent_text', label: 'Texto de aceptación de datos', type: 'rich', required: true, max: 600 },
        { name: 'success_message', label: 'Mensaje de confirmación', type: 'textarea', required: true, max: 400 }
      ]
    },
    footer: {
      label: 'Pie de página', page: 'inicio', permission: 'content', toggle: false,
      fields: [
        { name: 'description', label: 'Descripción institucional', type: 'textarea', required: true, max: 400 },
        { name: 'nav_title', label: 'Título de la columna de navegación', type: 'text', max: 40 },
        { name: 'contact_title', label: 'Título de la columna de contacto', type: 'text', max: 40 },
        { name: 'social_title', label: 'Título de la columna de redes', type: 'text', max: 40 },
        { name: 'copyright', label: 'Derechos de autor', type: 'text', max: 160, help: 'Usa {año} para insertar el año actual.' }
      ]
    },
    policies: {
      label: 'Políticas legales', permission: 'settings', toggle: false,
      fields: [
        { name: 'privacy', label: 'Política de privacidad', type: 'rich', required: true, max: 20000 },
        { name: 'data', label: 'Política de tratamiento de datos personales', type: 'rich', required: true, max: 20000 }
      ]
    }
  };

  const SETTINGS = {
    settings: {
      label: 'Configuración general', permission: 'settings',
      fields: [
        { name: 'name', label: 'Nombre institucional', type: 'text', required: true, max: 120 },
        { name: 'short_name', label: 'Nombre corto', type: 'text', required: true, max: 40 },
        { name: 'address', label: 'Dirección', type: 'text', max: 200 },
        { name: 'phones', label: 'Teléfonos (uno por línea)', type: 'lines', max: 300 },
        { name: 'whatsapp', label: 'Número de WhatsApp (con indicativo, solo dígitos)', type: 'text', required: true, max: 20, pattern: '^[0-9]{8,15}$' },
        { name: 'whatsapp_message', label: 'Mensaje predeterminado de WhatsApp', type: 'textarea', max: 300 },
        { name: 'email', label: 'Correo electrónico', type: 'text', max: 120, pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
        { name: 'hours', label: 'Horarios de atención (uno por línea)', type: 'lines', max: 300 },
        { name: 'maps_url', label: 'Enlace de ubicación en mapas', type: 'url' },
        { name: 'chat_name', label: 'Nombre del chat de atención', type: 'text', max: 60 },
        { name: 'chat_welcome', label: 'Mensaje de bienvenida del chat', type: 'textarea', max: 400 }
      ]
    },
    seo: {
      label: 'SEO y redes sociales', permission: 'settings',
      fields: [
        { name: 'title', label: 'Título de la página', type: 'text', required: true, max: 70 },
        { name: 'description', label: 'Descripción para buscadores', type: 'textarea', required: true, max: 170 },
        { name: 'og_image', label: 'Imagen para redes sociales', type: 'image' },
        { name: 'site_url', label: 'Dirección pública del sitio', type: 'url', help: 'Ejemplo: https://www.seniorscali.co — se usa en el sitemap y metadatos.' }
      ]
    },
    brand: {
      label: 'Identidad visual', permission: 'brand',
      fields: [
        { name: 'logo_main', label: 'Logotipo principal (encabezado)', type: 'image', required: true },
        { name: 'logo_light', label: 'Logotipo para fondos claros', type: 'image', required: true },
        { name: 'logo_dark', label: 'Logotipo para fondos oscuros (pie de página)', type: 'image', required: true },
        { name: 'favicon', label: 'Favicon (cuadrado, PNG)', type: 'image', required: true },
        { name: 'isotype', label: 'Isotipo / icono institucional', type: 'image' },
        { name: 'institutional_image', label: 'Imagen institucional', type: 'image' }
      ]
    }
  };

  // Orden de las secciones en la página pública.
  const PAGE_ORDER = ['hero', 'benefits', 'services', 'facilities', 'experiences', 'testimonials', 'faq', 'booking'];

  const ROLES = {
    admin: { label: 'Administrador', perms: ['content', 'media', 'links', 'brand', 'settings', 'requests', 'publish', 'users', 'history'] },
    editor: { label: 'Editor de contenidos', perms: ['content', 'media', 'history'] },
    gestor: { label: 'Gestor de solicitudes', perms: ['requests'] }
  };

  const REQUEST_STATUS = { pendiente: 'Pendiente', revision: 'En revisión', contactado: 'Contactado', confirmado: 'Confirmado', cancelado: 'Cancelado' };

  const MEDIA_CATEGORIES = ['Logotipos', 'Hero', 'Servicios', 'Instalaciones', 'Experiencias', 'Testimonios', 'Recorrido virtual', 'General'];

  // Validación de direcciones de enlaces: secciones internas, rutas relativas, http(s), mailto, tel.
  function isValidUrl(v) {
    if (typeof v !== 'string') return false;
    const s = v.trim();
    if (!s) return false;
    if (/^#[A-Za-z][\w-]*$/.test(s)) return true;
    if (/^\/(?!\/)[\w\-./?=&%#]*$/.test(s)) return true;
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(s)) return true;
    if (/^tel:\+?[0-9 ()-]{7,20}$/i.test(s)) return true;
    try {
      const u = new URL(s);
      return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname && u.hostname.includes('.');
    } catch (e) { return false; }
  }

  const api = { STATUS, COLLECTIONS, SECTIONS, SETTINGS, PAGE_ORDER, ROLES, REQUEST_STATUS, MEDIA_CATEGORIES, LINK_TYPES, LINK_GROUPS, isValidUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SeniorsSchema = api;
})(typeof window !== 'undefined' ? window : globalThis);

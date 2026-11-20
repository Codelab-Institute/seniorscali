/*
 * Datos generales de Seniors, comunes a ambos idiomas.
 * Los textos traducibles se escriben como { es: '…', en: '…' }.
 */
module.exports = {
  // Dirección pública del sitio (sin barra final). Se usa en el sitemap, las etiquetas canónicas y las redes sociales.
  siteUrl: 'https://www.seniorscali.co',

  name: 'Seniors Hogar y Entretenimiento Gold',
  shortName: 'Seniors',

  address: 'Carrera 115A # 16-115, Cali, Valle del Cauca, Colombia',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Carrera+115A+%2316-115+Cali+Colombia',
  phones: ['+57 313 544 9717', '+57 317 854 2033', '+57 602 395 8956'],
  email: 'seniorscali@gmail.com',

  // WhatsApp: número con indicativo, solo dígitos, y mensaje inicial del botón flotante.
  whatsapp: '573135449717',
  whatsappMessage: {
    es: 'Hola, quiero más información sobre Seniors.',
    en: 'Hello, I would like more information about Seniors.'
  },

  hours: {
    es: ['Pasadía: lunes a domingo, 9:00 a. m. – 5:00 p. m.', 'Visitas a las instalaciones: con cita previa'],
    en: ['Day program: Monday to Sunday, 9:00 a.m. – 5:00 p.m.', 'Facility tours: by appointment']
  },

  social: [
    { name: 'Facebook', icon: 'facebook', url: 'https://www.facebook.com/seniorscali' },
    { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/seniorscali/' }
  ],

  /*
   * Formulario de agendamiento.
   * - Sin «endpoint»: al enviar se abre WhatsApp con la solicitud ya redactada.
   * - Con «endpoint» (por ejemplo, un formulario de Formspree: https://formspree.io/f/xxxx):
   *   la solicitud se envía a ese servicio y el equipo la recibe por correo.
   */
  form: {
    endpoint: ''
  },

  // Recursos de marca (carpeta src/assets/brand)
  brand: {
    logoLight: 'brand/logo-claro.png', // encabezado (fondos claros)
    logoDark: 'brand/logo-oscuro.png', // pie de página (fondos oscuros)
    isotype: 'brand/isotipo.png',
    favicon: 'brand/favicon-192.png',
    favicon32: 'brand/favicon-32.png',
    appleIcon: 'brand/favicon-180.png'
  },

  // Imagen para compartir en redes sociales (carpeta src/assets/images)
  shareImage: 'images/hero.svg'
};

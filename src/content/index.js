/*
 * Reúne todos los contenidos del sitio (archivos JSON de esta carpeta).
 * Los textos traducibles se escriben como { "es": "…", "en": "…" }.
 */
module.exports = {
  settings: require('./settings.json'),
  ui: require('./ui.json'),
  home: require('./home.json'),
  services: require('./services.json'),
  facilities: require('./facilities.json'),
  experiences: require('./experiences.json'),
  wellness: require('./wellness.json'),
  testimonials: require('./testimonials.json'),
  faq: require('./faq.json'),
  contact: require('./contact.json'),
  legal: require('./legal.json')
};

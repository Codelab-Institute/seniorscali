/*
 * Instalaciones (galería por categorías) y recorrido virtual (imágenes panorámicas).
 */
const categories = {
  rooms: { es: 'Habitaciones', en: 'Rooms' },
  gardens: { es: 'Zonas verdes', en: 'Gardens' },
  common: { es: 'Espacios comunes', en: 'Common areas' },
  dining: { es: 'Comedor', en: 'Dining room' },
  fun: { es: 'Zonas de entretenimiento', en: 'Entertainment areas' },
  activities: { es: 'Áreas de actividades', en: 'Activity areas' }
};

module.exports = {
  seo: {
    title: { es: 'Instalaciones', en: 'Facilities' },
    description: {
      es: 'Conoce las habitaciones, zonas verdes, espacios comunes y áreas de actividades de Seniors en Cali, y haz un recorrido virtual.',
      en: 'Discover the rooms, gardens, common areas and activity spaces at Seniors in Cali, and take a virtual tour.'
    }
  },
  eyebrow: { es: 'Instalaciones', en: 'Facilities' },
  title: { es: 'Espacios pensados para *el bienestar*', en: 'Spaces designed for *well-being*' },
  intro: {
    es: 'Conoce los espacios que tenemos para hacer la estadía más cómoda, tranquila y entretenida.',
    en: 'Discover the spaces we offer to make every stay more comfortable, peaceful and enjoyable.'
  },

  categories,

  // category: clave de «categories»
  photos: [
    { image: 'images/instalacion-0-1.svg', category: 'rooms', title: { es: 'Habitación individual', en: 'Private room' } },
    { image: 'images/instalacion-0-2.svg', category: 'rooms', title: { es: 'Habitación compartida', en: 'Shared room' } },
    { image: 'images/instalacion-1-1.svg', category: 'gardens', title: { es: 'Jardín principal', en: 'Main garden' } },
    { image: 'images/instalacion-1-2.svg', category: 'gardens', title: { es: 'Senderos', en: 'Garden paths' } },
    { image: 'images/instalacion-2-1.svg', category: 'common', title: { es: 'Sala de estar', en: 'Living room' } },
    { image: 'images/instalacion-2-2.svg', category: 'common', title: { es: 'Terraza', en: 'Terrace' } },
    { image: 'images/instalacion-3-1.svg', category: 'dining', title: { es: 'Comedor', en: 'Dining room' } },
    { image: 'images/instalacion-3-2.svg', category: 'dining', title: { es: 'Cocina', en: 'Kitchen' } },
    { image: 'images/instalacion-4-1.svg', category: 'fun', title: { es: 'Salón de juegos', en: 'Games room' } },
    { image: 'images/instalacion-4-2.svg', category: 'fun', title: { es: 'Sala de música', en: 'Music room' } },
    { image: 'images/instalacion-5-1.svg', category: 'activities', title: { es: 'Taller de arte', en: 'Art studio' } },
    { image: 'images/instalacion-5-2.svg', category: 'activities', title: { es: 'Zona de ejercicio', en: 'Exercise area' } }
  ],

  tour: {
    eyebrow: { es: 'Recorrido virtual', en: 'Virtual tour' },
    title: { es: 'Recorre Seniors *desde casa*', en: 'Tour Seniors *from home*' },
    intro: {
      es: 'Explora nuestros espacios. Arrastra la imagen o usa las flechas para mirar alrededor.',
      en: 'Explore our spaces. Drag the image or use the arrows to look around.'
    },
    // Imágenes panorámicas horizontales (proporción 3:1 o más amplia)
    spaces: [
      { image: 'images/panorama-1.svg', title: { es: 'Recepción y acceso', en: 'Reception & entrance' }, text: { es: 'Nuestro punto de bienvenida para residentes, familias y visitantes.', en: 'Our welcome point for residents, families and visitors.' } },
      { image: 'images/panorama-2.svg', title: { es: 'Zonas verdes', en: 'Gardens' }, text: { es: 'Más de 3.500 m² de áreas de esparcimiento al aire libre.', en: 'More than 3,500 m² of outdoor leisure areas.' } },
      { image: 'images/panorama-3.svg', title: { es: 'Sala común', en: 'Common room' }, text: { es: 'Espacio para compartir, conversar y disfrutar de actividades grupales.', en: 'A space to share, talk and enjoy group activities.' } },
      { image: 'images/panorama-4.svg', title: { es: 'Comedor', en: 'Dining room' }, text: { es: 'Donde se sirve una alimentación balanceada en un ambiente familiar.', en: 'Where balanced meals are served in a family atmosphere.' } },
      { image: 'images/panorama-5.svg', title: { es: 'Habitaciones', en: 'Rooms' }, text: { es: 'Habitaciones 100 % dotadas, compartidas o individuales.', en: 'Fully furnished shared or private rooms.' } }
    ]
  }
};

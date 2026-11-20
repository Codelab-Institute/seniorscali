/*
 * Experiencias y actividades. Se muestran de la más reciente a la más antigua (campo «date»: AAAA-MM-DD).
 * «example: true» marca la publicación como «Ejemplo ilustrativo»; quítalo al reemplazarla por una experiencia real.
 * «media» puede ser una imagen o un video .mp4/.webm (en ese caso «poster» es la imagen de portada).
 */
const categories = {
  celebrations: { es: 'Celebraciones y cumpleaños', en: 'Celebrations & birthdays' },
  art: { es: 'Actividades artísticas', en: 'Art activities' },
  games: { es: 'Juegos y dinámicas grupales', en: 'Games & group activities' },
  physical: { es: 'Actividades físicas', en: 'Physical activities' },
  family: { es: 'Encuentros familiares', en: 'Family gatherings' },
  workshops: { es: 'Talleres y eventos especiales', en: 'Workshops & special events' }
};

module.exports = {
  seo: {
    title: { es: 'Experiencias', en: 'Experiences' },
    description: {
      es: 'Celebraciones, talleres, juegos y encuentros familiares que hacen parte del día a día en Seniors.',
      en: 'Celebrations, workshops, games and family gatherings that are part of everyday life at Seniors.'
    }
  },
  eyebrow: { es: 'Experiencias', en: 'Experiences' },
  title: { es: 'La vida en la *comunidad Seniors*', en: 'Life in the *Seniors community*' },
  intro: {
    es: 'Celebraciones, talleres, juegos y encuentros familiares que hacen parte de nuestro día a día.',
    en: 'Celebrations, workshops, games and family gatherings that are part of our everyday life.'
  },

  categories,

  items: [
    { example: true, media: 'images/experiencia-1.svg', category: 'celebrations', date: '2026-11-08', title: { es: 'Celebración de cumpleaños del mes', en: 'Monthly birthday celebration' }, text: { es: 'Celebramos juntos a quienes cumplen años este mes, con música, torta y mucha alegría.', en: 'We celebrated this month’s birthdays together with music, cake and lots of joy.' } },
    { example: true, media: 'images/experiencia-2.svg', category: 'art', date: '2026-10-28', title: { es: 'Taller de pintura', en: 'Painting workshop' }, text: { es: 'Una tarde de color y creatividad en nuestro taller de arte.', en: 'An afternoon of color and creativity in our art studio.' } },
    { example: true, media: 'images/experiencia-3.svg', category: 'games', date: '2026-10-15', title: { es: 'Tarde de juegos de mesa', en: 'Board game afternoon' }, text: { es: 'Juegos que estimulan la memoria y fortalecen la amistad.', en: 'Games that stimulate memory and strengthen friendships.' } },
    { example: true, media: 'images/experiencia-4.svg', category: 'physical', date: '2026-10-02', title: { es: 'Gimnasia suave al aire libre', en: 'Gentle outdoor exercise' }, text: { es: 'Movimiento y estiramientos en nuestras zonas verdes.', en: 'Movement and stretching in our gardens.' } },
    { example: true, media: 'images/experiencia-5.svg', category: 'family', date: '2026-09-20', title: { es: 'Encuentro de familias', en: 'Family gathering' }, text: { es: 'Un día para compartir con las familias de nuestros residentes.', en: 'A day to spend with our residents’ families.' } },
    { example: true, media: 'images/experiencia-6.svg', category: 'workshops', date: '2026-09-06', title: { es: 'Taller de temporada', en: 'Seasonal workshop' }, text: { es: 'Actividades especiales preparadas para la temporada.', en: 'Special activities prepared for the season.' } }
  ]
};

/*
 * Inicio y Nosotros.
 * En los títulos, las palabras entre *asteriscos* se destacan con cursiva de color.
 */
module.exports = {
  seo: {
    title: {
      es: 'Seniors · Hogar y entretenimiento para adultos mayores en Cali',
      en: 'Seniors · Senior living and day care in Cali, Colombia'
    },
    description: {
      es: 'Hogar y centro de entretenimiento gold para adultos mayores en Cali: estadía, pasadía y talleres con atención personalizada, acompañamiento y bienestar integral.',
      en: 'A premium home and day center for older adults in Cali, Colombia: residential stays, day program and workshops with personalized care, companionship and well-being.'
    }
  },

  hero: {
    eyebrow: { es: 'Hogar y entretenimiento gold · Cali', en: 'Senior home & day center · Cali' },
    title: { es: 'Un lugar para *disfrutar* cada etapa de la vida', en: 'A place to *enjoy* every stage of life' },
    description: {
      es: 'Un espacio donde el cuidado, la compañía y el bienestar se convierten en parte de cada día.',
      en: 'A place where care, companionship and well-being become part of every day.'
    },
    primary: { es: 'Conoce nuestros servicios', en: 'Explore our services' },
    secondary: { es: 'Agenda una visita', en: 'Book a visit' },
    image: 'images/hero.svg',
    imageAlt: { es: 'Residentes de Seniors compartiendo en las zonas verdes', en: 'Seniors residents spending time in the gardens' },
    badge: { es: 'Cuidado con amor', en: 'Cared for with love' },
    visitNote: { title: { es: 'Visítanos', en: 'Visit us' }, text: { es: 'Recorridos con cita previa', en: 'Tours by appointment' } },
    // Datos destacados [valor, descripción]
    highlights: [
      { value: { es: '3.500 m²', en: '3,500 m²' }, label: { es: 'de zonas de esparcimiento', en: 'of green and leisure areas' } },
      { value: '16', label: { es: 'huéspedes con atención personalizada', en: 'residents with personalized care' } },
      { value: { es: 'Lun – Dom', en: 'Mon – Sun' }, label: { es: 'servicio de pasadía', en: 'day program' } }
    ]
  },

  // Encabezados de los bloques de resumen en Inicio
  teasers: {
    about: { eyebrow: { es: 'Nosotros', en: 'About us' }, title: { es: '¿Por qué elegir *Seniors*?', en: 'Why choose *Seniors*?' }, link: { es: 'Conoce más sobre nosotros', en: 'Learn more about us' } },
    services: { eyebrow: { es: 'Servicios', en: 'Services' }, title: { es: 'Planes pensados para *cada familia*', en: 'Plans designed for *every family*' }, link: { es: 'Ver todos los servicios', en: 'See all services' } },
    facilities: { eyebrow: { es: 'Instalaciones', en: 'Facilities' }, title: { es: 'Espacios cálidos y *llenos de vida*', en: 'Warm spaces *full of life*' }, link: { es: 'Ver las instalaciones', en: 'See our facilities' } },
    experiences: { eyebrow: { es: 'Experiencias', en: 'Experiences' }, title: { es: 'Momentos que *compartimos*', en: 'Moments we *share*' }, link: { es: 'Ver todas las experiencias', en: 'See all experiences' } },
    testimonials: { eyebrow: { es: 'Testimonios', en: 'Testimonials' }, title: { es: 'Lo que dicen *las familias*', en: 'What *families* say' }, link: { es: 'Ver todos los testimonios', en: 'See all testimonials' } }
  },

  cta: {
    title: { es: '¿Quieres *conocernos*?', en: 'Would you like to *visit us*?' },
    text: {
      es: 'Agenda una visita y recorre nuestras instalaciones. Será un gusto recibirte a ti y a tu familia.',
      en: 'Book a visit and tour our facilities. We will be delighted to welcome you and your family.'
    },
    faq: { es: 'Preguntas frecuentes', en: 'Frequently asked questions' }
  },

  // ---------------- Página «Nosotros» ----------------
  about: {
    seo: {
      title: { es: 'Nosotros', en: 'About us' },
      description: {
        es: 'Somos un hogar y centro de entretenimiento gold para adultos mayores en Cali, donde atendemos a cada persona como en su propio hogar.',
        en: 'We are a premium home and day center for older adults in Cali, where we care for each person as if they were at home.'
      }
    },
    eyebrow: { es: 'Nosotros', en: 'About us' },
    title: { es: 'Cuidándote para que te sientas *en familia*', en: 'Caring for you so you feel *at home*' },
    intro: {
      es: 'Somos un hogar y centro de entretenimiento gold para adultos mayores, donde atendemos a cada persona como en su propio hogar, con amor y dedicación.',
      en: 'We are a premium home and day center for older adults, where we care for each person as if they were at home, with love and dedication.'
    },
    story: {
      title: { es: 'Una inspiración *familiar*', en: 'A *family* inspiration' },
      paragraphs: {
        es: [
          'Con un concepto renovado, producto de una inspiración familiar, en Seniors queremos brindar a las familias caleñas un espacio de alta calidad, con dotación y personal especializado.',
          'Marcamos la diferencia ofreciendo un espacio cálido, con comodidad en las habitaciones y atención personalizada en el diario vivir de los 16 huéspedes que podemos alojar, además de una atención novedosa y variada para quienes asisten a nuestro servicio de pasadía.'
        ],
        en: [
          'With a renewed concept born from a family inspiration, Seniors offers families in Cali a high-quality space with specialized staff and facilities.',
          'We make a difference by offering a warm environment, comfortable rooms and personalized day-to-day care for the 16 residents we can host, along with an innovative and varied program for those who join our day service.'
        ]
      }
    },
    benefitsTitle: { es: '¿Por qué elegir *Seniors*?', en: 'Why choose *Seniors*?' },
    // Beneficios: icono (ver src/lib/icons.js), título y descripción.
    benefits: [
      { icon: 'user-check', title: { es: 'Atención personalizada', en: 'Personalized care' }, text: { es: 'Acompañamos el diario vivir de cada huésped según sus necesidades, gustos y ritmo.', en: 'We support each resident’s daily life according to their needs, preferences and pace.' } },
      { icon: 'hand-heart', title: { es: 'Acompañamiento', en: 'Companionship' }, text: { es: 'Un equipo cálido y cercano que brinda tranquilidad a los residentes y a sus familias.', en: 'A warm, caring team that brings peace of mind to residents and their families.' } },
      { icon: 'palette', title: { es: 'Actividades recreativas', en: 'Recreational activities' }, text: { es: 'Programación variada de juegos, arte, música y celebraciones durante toda la semana.', en: 'A varied program of games, art, music and celebrations throughout the week.' } },
      { icon: 'sofa', title: { es: 'Espacios cómodos', en: 'Comfortable spaces' }, text: { es: 'Habitaciones 100 % dotadas, zonas comunes amplias y más de 3.500 m² de áreas de esparcimiento.', en: 'Fully furnished rooms, spacious common areas and more than 3,500 m² of leisure areas.' } },
      { icon: 'heart', title: { es: 'Bienestar integral', en: 'Holistic well-being' }, text: { es: 'Enfermería, fisioterapia y alimentación balanceada para cuidar la salud física y emocional.', en: 'Nursing, physical therapy and balanced meals to care for physical and emotional health.' } },
      { icon: 'users', title: { es: 'Convivencia y socialización', en: 'Community and friendship' }, text: { es: 'Un ambiente familiar donde se construyen amistades y se comparten momentos especiales.', en: 'A family atmosphere where friendships grow and special moments are shared.' } }
    ]
  }
};

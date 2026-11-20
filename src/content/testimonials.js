/*
 * Testimonios. Publica solo testimonios reales y autorizados.
 * «example: true» los muestra marcados como «Ejemplo ilustrativo»; quítalo (o borra el testimonio) al usar testimonios reales.
 * «photo» es opcional (carpeta src/assets/images).
 */
module.exports = {
  seo: {
    title: { es: 'Testimonios', en: 'Testimonials' },
    description: {
      es: 'Experiencias de las familias y residentes de Seniors, hogar y centro de entretenimiento para adultos mayores en Cali.',
      en: 'Experiences shared by the families and residents of Seniors, a home and day center for older adults in Cali.'
    }
  },
  eyebrow: { es: 'Testimonios', en: 'Testimonials' },
  title: { es: 'Lo que dicen *las familias*', en: 'What *families* say' },
  intro: {
    es: 'La confianza de las familias es nuestro mayor compromiso.',
    en: 'The trust of families is our greatest commitment.'
  },

  items: [
    {
      example: true, name: 'Familia de ejemplo', photo: '', date: '',
      relation: { es: 'Hija de residente', en: 'Resident’s daughter' },
      text: {
        es: 'Este es un testimonio de ejemplo para mostrar el diseño. Reemplázalo por un testimonio real autorizado por la familia.',
        en: 'This is a sample testimonial to show the design. Replace it with a real testimonial authorized by the family.'
      }
    },
    {
      example: true, name: 'Familiar de ejemplo', photo: '', date: '',
      relation: { es: 'Nieto de usuaria de pasadía', en: 'Grandson of a day program member' },
      text: {
        es: 'Texto ilustrativo. Los testimonios publicados deben corresponder a experiencias reales y contar con autorización.',
        en: 'Illustrative text. Published testimonials must reflect real experiences and be authorized.'
      }
    },
    {
      example: true, name: 'Testimonio de ejemplo', photo: '', date: '',
      relation: { es: 'Esposa de residente', en: 'Resident’s wife' },
      text: {
        es: 'Ejemplo de comentario. Puedes agregar una fotografía opcional, la relación con el residente y la fecha.',
        en: 'Sample comment. You can add an optional photo, the relationship to the resident and the date.'
      }
    }
  ]
};

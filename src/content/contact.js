/*
 * Contacto y formulario de agendamiento.
 */
module.exports = {
  seo: {
    title: { es: 'Contacto y visitas', en: 'Contact & visits' },
    description: {
      es: 'Agenda una visita a Seniors en Cali. Dirección, teléfonos, WhatsApp, correo y horarios de atención.',
      en: 'Book a visit to Seniors in Cali. Address, phone numbers, WhatsApp, email and opening hours.'
    }
  },
  eyebrow: { es: 'Agenda tu visita', en: 'Book your visit' },
  title: { es: 'Ven a *conocernos*', en: 'Come and *meet us*' },
  intro: {
    es: 'Déjanos tus datos y la fecha que prefieres. Nuestro equipo verificará la disponibilidad y se comunicará contigo para confirmar la visita.',
    en: 'Leave your details and preferred date. Our team will check availability and get in touch to confirm your visit.'
  },
  timeSlots: {
    es: ['9:00 a. m. – 10:00 a. m.', '10:00 a. m. – 11:00 a. m.', '11:00 a. m. – 12:00 m.', '2:00 p. m. – 3:00 p. m.', '3:00 p. m. – 4:00 p. m.', '4:00 p. m. – 5:00 p. m.'],
    en: ['9:00 – 10:00 a.m.', '10:00 – 11:00 a.m.', '11:00 a.m. – 12:00 p.m.', '2:00 – 3:00 p.m.', '3:00 – 4:00 p.m.', '4:00 – 5:00 p.m.']
  },
  // {data} se reemplaza por el enlace a la política de tratamiento de datos
  consent: {
    es: 'Autorizo a Seniors a tratar mis datos personales para gestionar esta solicitud, conforme a la <a href="{data}">Política de tratamiento de datos personales</a>.',
    en: 'I authorize Seniors to process my personal data to handle this request, in accordance with the <a href="{data}">Personal data policy</a>.'
  },
  success: {
    es: '¡Gracias! Recibimos tu solicitud. Nuestro equipo verificará la disponibilidad y te contactará para confirmar la fecha y hora de tu visita.',
    en: 'Thank you! We received your request. Our team will check availability and contact you to confirm the date and time of your visit.'
  }
};

# Seniors · Sitio web

Sitio web **estático y bilingüe (español / inglés)** de **Seniors Hogar y Entretenimiento Gold**.
No usa servidor ni base de datos: el sitio se genera como HTML puro y se publica en GitHub Pages. Los contenidos se editan en los archivos de `src/content/` y cada cambio subido a GitHub se publica automáticamente.

## Uso

Requisitos: Node.js 18 o superior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000/ (inglés en http://localhost:3000/en/). Al guardar cambios en `src/`, el sitio se reconstruye y el navegador se recarga solo.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor local con reconstrucción y recarga automáticas |
| `npm run build` | Genera el sitio final en `dist/` |
| `npm run check` | Revisa `dist/`: enlaces, imágenes, anclas, idioma y metadatos |
| `npm start` | Sirve `dist/` tal como quedará publicado |
| `npm run brand` | Regenera logotipos y favicons desde `Logo.png` y `Favicon 2.png` |
| `npm run placeholders` | Regenera las imágenes de referencia |

## Páginas

| Español | Inglés | Contenido |
|---|---|---|
| `/` | `/en/` | Inicio: presentación y resumen de cada sección |
| `/nosotros/` | `/en/about/` | Historia y beneficios |
| `/servicios/` | `/en/services/` | Estadía, pasadía, talleres y servicios complementarios |
| `/instalaciones/` | `/en/facilities/` | Galería con filtros y recorrido virtual |
| `/experiencias/` | `/en/experiences/` | Publicaciones con filtros |
| `/bienestar/` | `/en/wellness/` | Historias, artículos y consejos; cada publicación tiene su página (`/bienestar/<direccion>/`) |
| `/testimonios/` | `/en/testimonials/` | Testimonios |
| `/preguntas-frecuentes/` | `/en/faq/` | Preguntas frecuentes |
| `/contacto/` | `/en/contact/` | Datos de contacto y formulario de visita |
| `/politica-de-privacidad/`, `/tratamiento-de-datos/` | `/en/privacy-policy/`, `/en/data-policy/` | Políticas |

El selector **ES / EN** del encabezado lleva a la misma página en el otro idioma.

## Cómo editar contenidos

Todo el contenido está en archivos JSON de `src/content/`, con los dos idiomas juntos:

```json
"title": { "es": "Un lugar para *disfrutar* cada etapa de la vida", "en": "A place to *enjoy* every stage of life" }
```

En los títulos, las palabras entre `*asteriscos*` se destacan en cursiva turquesa.

| Archivo | Contenido |
|---|---|
| `settings.json` | Nombre, dirección, teléfonos, WhatsApp, correo, horarios, redes sociales, dirección pública del sitio |
| `ui.json` | Menú, direcciones de las páginas y textos de botones, formularios y mensajes |
| `home.json` | Inicio (presentación, datos destacados, invitación final) y página Nosotros |
| `services.json` | Servicios principales y complementarios |
| `facilities.json` | Categorías, fotografías y espacios del recorrido virtual |
| `experiences.json` | Experiencias y sus categorías |
| `wellness.json` | Bienestar: tipos de publicación y publicaciones (el contenido admite formato HTML básico) |
| `testimonials.json` | Testimonios |
| `faq.json` | Preguntas frecuentes (también alimentan el chat) |
| `contact.json` | Formulario: horarios disponibles, texto de autorización y mensaje de confirmación |
| `legal.json` | Políticas de privacidad y de tratamiento de datos |

### Cambiar o agregar fotografías

1. Copia la foto (JPG, PNG o WebP) en `src/assets/images/`, por ejemplo `habitacion-1.jpg`.
2. En el archivo de contenido, cambia la ruta: `"image": "images/habitacion-1.jpg"`.
3. Al construir, la foto se convierte automáticamente a WebP en varios tamaños (480 a 1800 px) y cada dispositivo descarga solo el tamaño que necesita.

Para el recorrido virtual usa fotos panorámicas horizontales (proporción 3:1 o más amplia).
Las experiencias aceptan videos `.mp4` o `.webm` en el campo `media` (con `poster` como imagen de portada).

## Contacto: agendar visita y realizar pago

En la página de Contacto, junto a la información de contacto, hay dos botones que abren su formulario en una ventana. Las direcciones `/contacto/#agendar` y `/contacto/#pago` (en inglés `/en/contact/#agendar` y `#pago`) abren cada ventana directamente. Los botones «Agenda una visita» del resto del sitio llevan ahí.

### Agendar una visita (se envía por correo)

Se configura en `src/content/settings.json` → `form`:

- **`email`**: correo administrativo que recibirá las solicitudes. Se envían mediante [FormSubmit](https://formsubmit.co), sin cuenta. La primera solicitud llega con un enlace de activación: hay que abrirlo una vez desde ese correo para empezar a recibirlas.
- **`endpoint`** (opcional, tiene prioridad): dirección de otro servicio de formularios, como Formspree o Web3Forms.
- **Ambos vacíos (actual):** el formulario avisa que el envío por correo aún no está habilitado y ofrece enviar la solicitud por WhatsApp con los datos ya escritos.

El correo llega con asunto «Solicitud de visita · Seniors · nombre», los datos en tabla y la opción de responder directamente a la persona. La visita no se confirma automáticamente: el equipo verifica la disponibilidad y contacta a la familia.

### Realizar pago (solo interfaz por ahora)

El formulario pide concepto de pago, detalle (opcional), valor en COP, nombre del responsable, correo y método de pago (tarjeta, PSE, Nequi, Botón Bancolombia). Valida los datos y muestra un resumen, pero **todavía no cobra nada**: indica que los pagos en línea se habilitarán pronto y ofrece enviar los datos por WhatsApp.

- Conceptos, métodos y valores mínimo y máximo: `src/content/contact.json` → `payment`.
- Configuración para la integración con Wompi: `src/content/settings.json` → `payments` (`enabled`, `publicKey`, `currency`). El punto donde se conectará el checkout está marcado en `src/scripts/site.js` («Aquí se conectará Wompi»).

## Rendimiento

- HTML generado de antemano, sin consultas a servidor ni base de datos.
- Imágenes en WebP con varios tamaños, carga diferida y dimensiones fijas (sin saltos de diseño).
- Un solo CSS minificado y un solo JavaScript diferido, sin librerías. Los nombres llevan una huella para caché de larga duración.
- La imagen principal de Inicio se precarga. Las fuentes cargan con `display=swap`.

## Publicación

El flujo `.github/workflows/deploy.yml` construye el sitio y lo revisa con `npm run check` en cada pull request y en cada cambio de la rama `main`.

- **GitHub Pages:** si en *Settings → Pages* del repositorio **Source** es **GitHub Actions**, el mismo flujo publica el sitio después de cada cambio en `main`. Si la revisión encuentra un error, no publica.
- **Vercel:** `vercel.json` ya está configurado (`npm run build`, carpeta `dist`, caché y cabeceras de seguridad). Basta con conectar el repositorio en Vercel.

Otros hostings: `npm run build` y sube `dist/`. En una subcarpeta construye con `BASE_PATH=/carpeta npm run build`. Con dominio propio, ajusta `siteUrl` en `src/content/settings.json`. El archivo `_headers` configura la caché en Netlify y Cloudflare Pages.

## Estructura

```
src/
  content/     Textos e información en JSON (español e inglés)
  assets/      Logotipos, favicons e imágenes originales
  styles/      site.css (diseño)
  scripts/     site.js (menú, galerías, carrusel, formulario, chat, recorrido)
  lib/icons.js Iconos lineales
  templates.js Plantillas HTML de todas las páginas
scripts/       build, servidor local, revisión, marca e imágenes de referencia
dist/          Sitio generado (no se versiona)
```

## Pendiente por parte de Seniors

- **Fotografías reales:** el sitio usa imágenes de referencia.
- **Testimonios y experiencias reales:** los actuales son ejemplos y se muestran como «Ejemplo ilustrativo» (`example: true`).
- **Validar** las respuestas marcadas `pending: true` en `faq.js` (atención médica y costos).
- **Revisar las políticas legales** (textos de referencia).
- El chat es una **demostración** basada en las preguntas frecuentes.

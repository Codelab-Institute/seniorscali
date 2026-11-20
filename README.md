# Seniors · Sitio web

Sitio web **estático y bilingüe (español / inglés)** de **Seniors Hogar y Entretenimiento Gold**.
No usa servidor, base de datos ni panel administrativo: los contenidos se editan en archivos de código y el sitio se genera como HTML puro, listo para cualquier hosting estático (GitHub Pages, Netlify, Cloudflare Pages, Vercel o un hosting tradicional).

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
| `/testimonios/` | `/en/testimonials/` | Testimonios |
| `/preguntas-frecuentes/` | `/en/faq/` | Preguntas frecuentes |
| `/contacto/` | `/en/contact/` | Datos de contacto y formulario de visita |
| `/politica-de-privacidad/`, `/tratamiento-de-datos/` | `/en/privacy-policy/`, `/en/data-policy/` | Políticas |

El selector **ES / EN** del encabezado lleva a la misma página en el otro idioma.

## Cómo editar contenidos

Todo el contenido está en `src/content/`. Cada texto tiene sus dos idiomas juntos:

```js
title: { es: 'Un lugar para *disfrutar* cada etapa de la vida', en: 'A place to *enjoy* every stage of life' }
```

En los títulos, las palabras entre `*asteriscos*` se destacan en cursiva turquesa.

| Archivo | Contenido |
|---|---|
| `settings.js` | Nombre, dirección, teléfonos, WhatsApp, correo, horarios, redes sociales, dirección pública del sitio |
| `ui.js` | Menú, direcciones de las páginas y textos de botones, formularios y mensajes |
| `home.js` | Inicio (presentación, datos destacados, invitación final) y página Nosotros |
| `services.js` | Servicios principales y complementarios |
| `facilities.js` | Categorías, fotografías y espacios del recorrido virtual |
| `experiences.js` | Experiencias y sus categorías |
| `testimonials.js` | Testimonios |
| `faq.js` | Preguntas frecuentes (también alimentan el chat) |
| `contact.js` | Formulario: horarios disponibles, texto de autorización y mensaje de confirmación |
| `legal.js` | Políticas de privacidad y de tratamiento de datos |

### Cambiar o agregar fotografías

1. Copia la foto (JPG, PNG o WebP) en `src/assets/images/`, por ejemplo `habitacion-1.jpg`.
2. En el archivo de contenido, cambia la ruta: `image: 'images/habitacion-1.jpg'`.
3. Al construir, la foto se convierte automáticamente a WebP en varios tamaños (480 a 1800 px) y cada dispositivo descarga solo el tamaño que necesita.

Para el recorrido virtual usa fotos panorámicas horizontales (proporción 3:1 o más amplia).
Las experiencias aceptan videos `.mp4` o `.webm` en el campo `media` (con `poster` como imagen de portada).

## Formulario de visitas

Al no haber servidor, el formulario funciona de dos maneras (se configura en `src/content/settings.js` → `form.endpoint`):

- **Sin configurar (actual):** valida los datos y abre WhatsApp con la solicitud ya redactada para enviarla al número institucional.
- **Con un servicio de formularios** (por ejemplo, [Formspree](https://formspree.io)): pega la dirección del formulario en `form.endpoint` y las solicitudes llegarán por correo.

En ambos casos la visita no se confirma automáticamente: el equipo verifica la disponibilidad y contacta a la familia.

## Rendimiento

- HTML generado de antemano, sin consultas a servidor ni base de datos.
- Imágenes en WebP con varios tamaños, carga diferida y dimensiones fijas (sin saltos de diseño).
- Un solo CSS minificado y un solo JavaScript diferido, sin librerías. Los nombres llevan una huella para caché de larga duración.
- La imagen principal de Inicio se precarga. Las fuentes cargan con `display=swap`.

## Publicación

```bash
npm run build
```

Sube el contenido de `dist/` al hosting. Antes, revisa `siteUrl` en `src/content/settings.js` (se usa en el sitemap, las etiquetas canónicas y las vistas previas en redes sociales).

- **Subcarpeta** (por ejemplo, GitHub Pages de proyecto `usuario.github.io/seniors/`): construye con `BASE_PATH=/seniors npm run build`.
- **Netlify / Cloudflare Pages:** comando `npm run build`, carpeta `dist`. El archivo `_headers` ya configura la caché.
- `dist/404.html` es la página de error, y `sitemap.xml` y `robots.txt` se generan automáticamente.

## Estructura

```
src/
  content/     Textos e información (español e inglés)
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

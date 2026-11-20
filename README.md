# Seniors · Plataforma institucional

Sitio público nuevo de **Seniors Hogar y Entretenimiento Gold** con un **panel administrativo** para gestionar sus contenidos sin tocar el código. Se construyó desde cero; el sitio actual (seniorscali.co) no se modificó.

## Puesta en marcha

Requisitos: Node.js 22.13 o superior.

```bash
npm install
npm start
```

- Sitio público: http://localhost:3000/
- Panel administrativo: http://localhost:3000/admin (no aparece en el menú público)

### Páginas del sitio público

Cada opción del menú es una página independiente que muestra solo su propio contenido:

| Página | Dirección | Contenido |
|---|---|---|
| Inicio | `/` | Presentación principal y un resumen de cada sección con enlaces a su página |
| Nosotros | `/nosotros` | ¿Por qué elegir Seniors? |
| Servicios | `/servicios` | Servicios principales y complementarios |
| Instalaciones | `/instalaciones` | Galería por categorías y recorrido virtual |
| Experiencias | `/experiencias` | Publicaciones con filtros por categoría |
| Testimonios | `/testimonios` | Carrusel de testimonios |
| Preguntas frecuentes | `/preguntas-frecuentes` | Acordeón (enlazado desde Inicio, Contacto y el pie de página) |
| Contacto | `/contacto` | Datos de contacto y formulario de agendamiento (`/contacto#agendar` lleva directo al formulario) |

Desactivar una página en el panel («Página principal») la oculta del menú y del resumen de Inicio, y su dirección responde «no encontrada».

La primera vez se crea la base de datos con el contenido inicial y tres usuarios de prueba. **Prototipo:** los tres entran con la contraseña fija `1234567890`, definida en `server/auth.js` (la contraseña guardada en la base no se consulta al iniciar sesión):

| Rol | Correo |
|---|---|
| Administrador | `admin@seniorscali.co` |
| Editor de contenidos | `editor@seniorscali.co` |
| Gestor de solicitudes | `solicitudes@seniorscali.co` |

Antes de producción hay que volver a verificar contraseñas reales y definir `SESSION_SECRET`. Si ya tenías una base local de antes de este cambio, ejecuta `npm run reset` para crear los usuarios con estos correos.

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia el servidor y lo reinicia al modificar el código |
| `npm run reset` | Vuelve al contenido inicial (borra solicitudes, historial y archivos subidos). Detén el servidor antes |
| `npm run brand` | Regenera logotipos y favicons a partir de `Logo.png`, `Favicon 2.png` (sitio público) y `Favicon Admin.webp` (panel administrativo) |
| `node scripts/smoke-test.js` | Prueba de extremo a extremo (40 verificaciones) con el servidor en marcha |

## Arquitectura

```
server/        Backend Express: API, autenticación, subida de archivos, renderizado del sitio
  index.js     Rutas públicas, API administrativa, publicación, multimedia, solicitudes, usuarios
  db.js        Base de datos SQLite (data/seniors.db) y modelo de publicación
  auth.js      Contraseñas scrypt, sesiones HttpOnly, CSRF y límite de intentos
  render.js    HTML de la página pública generado en el servidor (SEO)
  validate.js  Validación y saneamiento de todo lo que llega del panel
  seed.js      Contenido inicial (datos tomados del sitio actual)
shared/        Esquema de contenidos e iconos (los usan el servidor y el panel)
public/        Estilos, JavaScript, logotipos e imágenes de referencia del sitio público
admin/         Panel administrativo (aplicación independiente, misma fuente de datos)
uploads/       Imágenes y videos subidos (optimizados a WebP)
data/          Base de datos, copias de seguridad automáticas y credenciales iniciales
```

### Cómo funciona la publicación

1. Lo que se edita en el panel se guarda en la **copia de trabajo** (borrador del sitio).
2. **Vista previa** muestra la copia de trabajo, o incluso cambios aún no guardados, en 7 tamaños de pantalla (320 a 1920 px).
3. **Publicar cambios** (solo el administrador) valida el contenido, guarda una versión y actualiza el sitio al instante, sin volver a desplegar.
4. Cada elemento tiene estado **Borrador**, **Publicado** o **Despublicado**. Solo los publicados aparecen en el sitio.
5. El **Historial** registra quién cambió qué y cuándo, y permite restaurar versiones publicadas anteriores.

### Roles

| Rol | Puede |
|---|---|
| Administrador | Todo: contenidos, enlaces, identidad visual, configuración, solicitudes, publicar, usuarios |
| Editor de contenidos | Textos, fotografías, servicios, experiencias, testimonios y preguntas (guarda borradores, no publica) |
| Gestor de solicitudes | Consultar solicitudes, cambiar estados y registrar observaciones |

Los permisos se verifican en la interfaz y también en el servidor.

## Seguridad

- Contraseñas con scrypt; sesiones en cookie HttpOnly y SameSite=Strict (Secure en producción); token CSRF en cada cambio.
- Bloqueo de 15 minutos tras 5 intentos fallidos. Recuperación de contraseña con enlace de un solo uso (en el prototipo el enlace se muestra en la consola del servidor; en producción hay que conectar un servicio de correo).
- Cabeceras CSP, HSTS (en producción), nosniff y protección contra iframes de otros sitios.
- Archivos: se verifica el tipo real (no solo la extensión). Imágenes de hasta 10 MB y videos de hasta 60 MB. Los SVG con scripts se rechazan. Las imágenes se re-codifican a WebP.
- El texto enriquecido se sanea en el servidor (solo negrita, cursiva, listas y enlaces).
- Formulario público: validación en el servidor, campo trampa contra bots y límite de envíos por IP. Las solicitudes solo las ve el personal autorizado.
- Copia diaria automática de la base de datos (se conservan 14) y descarga manual desde Configuración.

## Despliegue en producción

- Ejecutar con `NODE_ENV=production` detrás de un proxy con HTTPS (Nginx, Caddy o el del proveedor). Si el proxy no corre en la misma máquina, definir `TRUST_PROXY=1`.
- Variables opcionales: `PORT`, `DB_FILE`, `SESSION_SECRET` (clave para firmar la cookie de sesión).
- Respaldar las carpetas `data/` y `uploads/`.
- En el panel, en **Configuración → SEO**, indicar la dirección pública del sitio para el sitemap y los metadatos.

## Pendiente por parte de Seniors

- **Fotografías reales**: el sitio usa imágenes de referencia marcadas como «Reemplazar». Súbelas en *Imágenes y multimedia* y usa «Reemplazar»: se actualizan en todas las secciones.
- **Panorámicas** del recorrido virtual (fotografías horizontales amplias).
- **Validar** los textos de los beneficios y las respuestas marcadas como «Sin validar» (por ejemplo, costos y atención médica).
- **Testimonios reales** con autorización. Los actuales son ejemplos y el sitio los muestra como «Ejemplo ilustrativo».
- Revisar las **políticas de privacidad y de tratamiento de datos**, que son textos de referencia.
- El chat es una **demostración** con respuestas basadas en las preguntas frecuentes. Está preparado para integrar inteligencia artificial con información institucional verificada.

# kettellbro

Entrenador de pesas rusas (kettlebell) basado en evidencia. PWA mobile-first con **inicio de sesión obligatorio con Google**, una rutina distinta cada día, acompañante en vivo por serie y progreso en la nube.

**Estilo: "Lotería de Hierro".** Cada día es una carta de lotería coleccionable; el mes es una tabla que se marca con frijoles; la pantalla se tiñe con la tinta del enfoque del día.

## Arranque rápido (sin Firebase, solo para ver la interfaz)

Crea un archivo `.env.local` (texto plano UTF-8) con esta línea. **Solo desarrollo**: salta Google y guarda en el localStorage del navegador; en producción debe estar vacío.

```
NEXT_PUBLIC_DEMO_MODE=1
```

```bash
npm install
npm run dev     # http://localhost:3000
```

## Puesta en marcha real (Google + Firestore)

1. **Firebase Console** → crea un proyecto → *Authentication → Sign-in method* → activa **Google**.
2. *Configuración del proyecto → Tus apps → Web* → copia las claves a `.env.local` (ver `.env.example`). Deja `NEXT_PUBLIC_DEMO_MODE` vacío.
3. *Authentication → Settings → Authorized domains*: añade `localhost` y tu dominio de producción.
4. Activa **Firestore** (modo producción) y despliega las reglas: `npx firebase-tools deploy --only firestore:rules` (archivo `firestore.rules`).
5. `npm run build && npm start`, o despliega en Vercel con las mismas variables `NEXT_PUBLIC_FIREBASE_*`.

Detalles, modelo de datos, reglas y comparación con Supabase: [docs/ARQUITECTURA-DATOS-AUTH.md](docs/ARQUITECTURA-DATOS-AUTH.md).

## Estado de la configuración (publicado)

| Servicio | Detalle |
|---|---|
| Firebase | Proyecto `kettelbro` · app web `kettellbro` · Firestore `(default)` en `eur3` (Europa) con las reglas de `firestore.rules` desplegadas |
| Vercel | Equipo `ronegret` · proyecto `kettellbro` · producción: https://kettellbro.vercel.app |
| Variables | `NEXT_PUBLIC_FIREBASE_*` cargadas en Production, Preview y Development (valores en `.env.local`, que no se sube al repo) |
| Pendiente en la consola | Activar el proveedor **Google** en Authentication y añadir `kettellbro.vercel.app` a *Dominios autorizados* |

Comandos útiles: `npx firebase-tools deploy --only firestore --project kettelbro` (reglas) y `npx vercel@latest deploy --prod --yes --scope ronegret` (publicar). `.vercelignore` excluye los `.env*` y las carpetas de trabajo.

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/lib/engine/` | Motor de rutinas puro (calendario, ejercicios, generador, pasos, progresión, metas) + pruebas |
| `src/lib/data/`, `src/lib/firebase/` | Repositorio (Firestore y modo demo), auth con Google, `resume()` |
| `src/components/figure/` | Figuras animadas de cada ejercicio (cinemática 2D en SVG) |
| `src/components/session/` | Acompañante guiado por tiempo: preparación, repeticiones contadas por el reloj, descansos, voz, vibración, cierre y celebración |
| `src/components/landing/`, `src/app/ciencia`, `src/app/guias` | Portada pública renderizada en el servidor (con puerta de entrada según la sesión), La ciencia sin humo y guías en Markdown (`docs/SEO-GUIAS`) |
| `src/app/` | Rutas públicas: `/` (portada), `/ciencia`, `/guias`; de la app (con Google): `/bienvenida`, `/hoy`, `/progreso`, `/metas`, `/perfil`, `/pesas`, `/sesion`; además `sitemap.xml` y `robots.txt`. Las públicas no montan Firebase (`src/lib/publicRoutes.ts`) |
| `src/lib/brandArt.tsx`, `src/app/icon.tsx`, `src/app/opengraph-image.tsx` | Ícono de la app (192, 512, maskable, favicon, Apple) y portada para redes, generados en build desde un solo dibujo |
| `docs/` | Base científica, motor de rutinas, arquitectura de datos y la investigación completa |

## Sesiones exactas

Cada sesión dura **exactamente** los minutos elegidos (10, 15, 20 o 25): el generador cuadra el total con `fitExact` (±10 s, en la práctica ≤ 4 s) y todo paso se mide en segundos, sin botón «Hecho». Una prueba lo verifica en 1440 combinaciones de nivel, tiempo y día. Detalle en [docs/MOTOR-DE-RUTINAS.md](docs/MOTOR-DE-RUTINAS.md).

## Personajes 3D (en curso)

Instructores `bro` y `princess` en 3D con Blender → GLB → three.js, con vistas de lado, frente y 3/4. Contrato técnico: [docs/PERSONAJES-3D-CONTRATO.md](docs/PERSONAJES-3D-CONTRATO.md). La figura 2D de `src/components/figure/` es el respaldo.

## Ícono, portada e instalación

- **Íconos** (se generan solos en build): `/icon/192`, `/icon/512`, `/icon/maskable` (zona segura para máscaras de Android), `/icon/16|32|48` (favicon) y `/apple-icon` (iOS, a sangre completa). El manifest los declara con `purpose` correcto, más atajos y capturas para el instalador.
- **Portada para redes** (WhatsApp, X, Facebook, Slack): `/opengraph-image` y `/twitter-image` (1200×630). Define `NEXT_PUBLIC_SITE_URL` con tu dominio para que las URLs de og:image sean absolutas.
- **favicon.ico**: `node scripts/build-favicon.mjs http://localhost:3000` (con el servidor en marcha) lo regenera.
- Para cambiar el dibujo, edita `src/lib/brandArt.tsx`: todo se actualiza junto.

## Comandos

```bash
npm run dev         # desarrollo
npm test            # pruebas del motor y de la capa de datos
npm run typecheck   # TypeScript estricto
npm run build       # producción
node scripts/build-evidence.mjs   # regenera src/content/evidence.json desde docs/research/evidence.json
```

## Documentación

- [docs/BASE-CIENTIFICA.md](docs/BASE-CIENTIFICA.md) — protocolos, estudios y lo que la evidencia **no** respalda
- [docs/MOTOR-DE-RUTINAS.md](docs/MOTOR-DE-RUTINAS.md) — cómo se genera cada día, a largo plazo
- [docs/ARQUITECTURA-DATOS-AUTH.md](docs/ARQUITECTURA-DATOS-AUTH.md) — Firestore, Google OAuth, reglas, reanudar sesión
- [docs/CRECIMIENTO.md](docs/CRECIMIENTO.md) — retención, viralidad, métricas y backlog de crecimiento
- [docs/SEO-Y-CONTENIDO.md](docs/SEO-Y-CONTENIDO.md) — SEO, portada pública, guías y calendario editorial
- [docs/research/](docs/research/) — investigación con citas verificadas

> kettellbro no sustituye el consejo médico.

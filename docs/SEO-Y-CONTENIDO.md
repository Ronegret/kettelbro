# SEO y contenido de kettellbro

Estado: borrador de estrategia listo para ejecutar · Fecha: 16 de octubre de 2026 · Producción: https://kettellbro.vercel.app

Archivos hermanos: [`src/content/landing.es.json`](../src/content/landing.es.json) (contenido de la portada pública) y [`docs/SEO-GUIAS/`](SEO-GUIAS/) (tres guías listas para publicar).

> Regla de oro de este documento: **no hay volúmenes de búsqueda inventados**. Donde falta un dato, se dice "sin verificar" y se indica cómo obtenerlo. Todo lo marcado "verificado" se comprobó el 15 y 16 de octubre de 2026 (fuentes al final).

---

## 0. Resumen ejecutivo

### Diagnóstico verificado

| # | Hallazgo | Cómo se comprobó | Impacto |
|---|---|---|---|
| 1 | El HTML inicial de `/` casi no tiene contenido: el texto visible es la marca, un eslogan y «Abriendo kettellbro…». No aparecen el `h1` con «pesa rusa», los tres beneficios ni el botón de Google. | `WebFetch` de https://kettellbro.vercel.app/; en el código, `src/app/page.tsx` es `"use client"` y, mientras Firebase Auth resuelve (`status: loading`), devuelve `<Splash>`. | **Crítico.** Quien llega desde una red social o un buscador depende de que el JavaScript resuelva Auth. Los rastreadores que no ejecutan JS (y los que lo ejecutan, pero esperan poco) ven casi nada. |
| 2 | No existe sitemap: `/sitemap.xml` devuelve 404. | `WebFetch` (HTTP 404). No hay `src/app/sitemap.ts`. | Alto. Sin sitemap, el descubrimiento de páginas nuevas depende solo de enlaces. |
| 3 | `robots.txt` existe y permite `/`, pero **no declara el sitemap**: `robots.ts` solo añade la línea `Sitemap:` si `NEXT_PUBLIC_SITE_URL` está definida, y en producción no lo está. | `WebFetch` de `/robots.txt` (7 líneas, sin `Sitemap:`) + lectura de `src/app/robots.ts`. | Medio. Fácil de corregir con el mismo respaldo que ya usa `layout.tsx`. |
| 4 | La metadata global es genérica: título `kettellbro · entrenador de pesas rusas`, una descripción única para todo el sitio y una lista `keywords` que Google no usa. | Lectura de `src/app/layout.tsx`. | Medio. Cada página pública necesita su propio título, descripción y canónica. |
| 5 | Todas las rutas heredan `AppProviders` (Firebase) desde el layout raíz. Las páginas públicas cargarían el SDK de Firebase sin necesitarlo. | Lectura de `src/app/layout.tsx`. | Alto para Core Web Vitals (sección 9). |
| 6 | Los resultados enriquecidos de **preguntas frecuentes (FAQ) dejaron de mostrarse en Google el 7 de mayo de 2026**, y los de **HowTo se retiraron en 2023**. | Google Search Central, historial de cambios de documentación (`developers.google.com/search/updates`). | Cambia la recomendación de datos estructurados (sección 7): FAQPage y HowTo no dan lugar a resultados enriquecidos. |
| 7 | El resultado enriquecido de **app de software exige `offers.price` y `aggregateRating` o `review`**. kettellbro no tiene reseñas (y no se deben inventar) y su precio está **POR DEFINIR**. | Google Search Central, documentación de Software App. | La portada no es elegible a ese resultado enriquecido hoy; el marcado puede describir la app, pero sin precio ni calificaciones. |
| 8 | Para la **verificación de marca de la pantalla de consentimiento de Google (OAuth)**, la página principal «no puede ser solo una pantalla de inicio de sesión», debe describir la app y enlazar a la política de privacidad, alojada en el mismo dominio. | Ayuda de Google Cloud, «Verification requirements». | La portada pública y la política de privacidad no son solo SEO: son un requisito de producto si se quiere mostrar nombre y logo en el consentimiento de Google. |
| 9 | El service worker usa «caché primero» para `.png/.svg/.webp/.woff` sin versionar el nombre de la caché (`kb-v1`) y «red primero» para navegación. | Lectura de `public/sw.js`. | Bien para rastreadores y HTML (siempre fresco). Riesgo: imágenes estáticas de `public/` con el mismo nombre se quedan viejas en quien ya las visitó. |

### Qué hay que hacer primero (en una línea cada punto)

1. **Renderizar la portada en el servidor** con el contenido de `landing.es.json` y dejar solo el botón de Google y la redirección como código de cliente (P0).
2. **Metadata propia, sitemap y robots corregidos** (P0).
3. **Política de privacidad y términos** con texto del titular (P0; también destraba la verificación de marca de Google).
4. **Separar rutas públicas y de app** con grupos de rutas para no cargar Firebase en páginas públicas (P1).
5. **Publicar `/guias` con las tres guías ya escritas** y `/ciencia` (P1).
6. **Calendario de nueve artículos más** a ritmo semanal (P2), empezando por los que alimentan el reto de enero.

---

## 1. Método y límites

**Qué se hizo.** Lectura de `PRODUCT.md`, `README.md`, `docs/BASE-CIENTIFICA.md`, `docs/MOTOR-DE-RUTINAS.md`, `docs/ARQUITECTURA-DATOS-AUTH.md`, `docs/research/estudios.md`, `docs/research/protocolos.md`, `src/content/evidence.json` y el código relevante (`layout.tsx`, `page.tsx`, `LoginScreen.tsx`, `manifest.ts`, `robots.ts`, `sw.js`, `body.ts`, `exercises.ts`, `generator.ts`, `steps.ts`, `types.ts`). Se hicieron unas 14 búsquedas web el 15 y 16 de octubre de 2026 y se comprobaron fuentes de Google, Next.js, StrongFirst y NCBI.

**Qué NO se hizo, y por qué importa.**

- **No hay datos de volumen ni de posiciones.** El sitio es nuevo, no hay Search Console y no se usó ninguna herramienta de palabras clave. Por eso las tablas no traen cifras de búsquedas.
- **La búsqueda web usada solo cubre resultados de Estados Unidos.** Lo observado sobre «qué aparece hoy» es una foto puntual, no un seguimiento de posiciones, y puede diferir en México, Colombia, Argentina, Chile o España. Hay que repetirla desde cada país (ver sección 12).
- **No se ejecutó código.** Los ejemplos calculados de la guía de pesos se hicieron a mano con la fórmula de `body.ts`; conviene confirmarlos con una prueba unitaria.

**Cómo conseguir los datos que faltan (todo gratuito).**

| Dato | Herramienta | Cuándo |
|---|---|---|
| Demanda relativa: «pesa rusa» frente a «kettlebell» por país | Google Trends (comparar términos, filtrar por país y por 5 años) | Semana 0 |
| Volumen aproximado y variantes | Planificador de palabras clave de Google Ads (cuenta gratuita, sin gastar) | Semana 0 |
| Preguntas reales | Autocompletado, «Otras preguntas de los usuarios», búsquedas relacionadas, desde un navegador con país y idioma de cada mercado | Semana 0 y mensual |
| Consultas reales que ya llevan a kettellbro | Search Console (Rendimiento > Consultas) | Desde la primera semana indexada |
| Qué se rastrea y qué se indexa | Search Console (Páginas, Inspección de URL) y Bing Webmaster Tools | Desde la primera semana |

**Regla de decisión.** Una página nueva solo se aprueba si (a) hay una intención clara que ninguna otra página del sitio posee, (b) hay fuentes verificables y (c) aporta algo que los resultados de hoy no tienen (sección 2).

---

## 2. Panorama de búsqueda: qué aparece hoy y qué huecos hay

Foto del 15 y 16 de octubre de 2026, desde un buscador con resultados de EE. UU. (ver límites). «Quién aparece» es lo observado en esa consulta; no es un ranking.

| Consulta | Quién aparece (observado) | Formato dominante | Hueco | Ángulo de kettellbro |
|---|---|---|---|---|
| rutina de kettlebell para principiantes | Myprotein, Trendencias, Vitónica (varias rutinas), SensAI, y en inglés St James, Fit&Well, Aaptiv | Listas de ejercicios y circuitos | Pocas muestran una progresión por semanas, una puerta de seguridad para la bisagra o fuentes | Plan de 4 semanas con bisagra primero, esfuerzo percibido y fuentes (artículo 5) |
| qué peso de pesa rusa elegir según mi peso | Tiendas (Decathlon, Construex, Mercado Libre…), guía de compra de Vitónica (septiembre de 2024: 16–24 kg en hombres para balísticos y 8–20 kg para básicos; 8–16 y 6–12 kg en mujeres) | Páginas de producto y rangos por sexo | **Ninguno calcula por peso y estatura**; los rangos son por sexo | Método explicado, ejemplos, test de la pesa y tabla kg–lb (guía 1) |
| swing de kettlebell técnica | FitGeneration, Trendencias, Vitónica (variantes y errores), Body Solid, artículos de StrongFirst en inglés | Pasos y errores | Casi nada en español que conecte la técnica con lo que se sabe de las cargas | Técnica en seis pasos, cues, errores y ciencia con cautela (guía 2) |
| turkish get up cómo hacerlo | Vitónica, The Prehab Guys, Strengthlog, PDF universitarios (Monash, Sussex) | Guías en inglés y una nota de Vitónica | Pocas guías en español con las 7 etapas, regresiones y datos de demanda del hombro | Artículo 4 |
| rutina de 20 minutos con una pesa rusa | Vitamix (20 s / 10 s con 5 min de calentamiento y 5 de estiramiento), Vitónica (25 min en EMOM), Trendencias (10 min en HIIT) | Rutinas de 10 y 25 minutos | **Casi ninguna es exactamente de 20 minutos con una sola pesa, repartida en la semana** | Guía 3 |
| pesa rusa en casa | Tiendas (Decathlon, Costco México, Easy Argentina, Mercado Libre), Vitónica (10 ejercicios en casa) | Productos y una lista de ejercicios | Falta orientación de espacio, suelo y qué comprar primero, con libras y kilos | Artículo 7 |
| reto 30 días pesa rusa | Tiendas, un reto semanal de Vitónica; en inglés Refinery29, Marathon Handbook (100 swings al día), FitnessVolt, Kettlebell Workouts | Planes en inglés | **No apareció un plan de 30 días en español**; los planes populares empujan volúmenes altos | Reto reencuadrado a 3 sesiones por semana durante 4 semanas (artículo 6) |
| app de pesa rusa en español | My Kettlebell Workout (4,8 con 11 reseñas, suscripción PRO opcional), una app gratuita con una sola calificación de 1,0, KETLFIT (ficha en inglés), Freeletics, y «La Forja», un programa de pago | Fichas de tienda | Hay pocas opciones en español con rutina diaria generada y respaldo de estudios | Portada `/` |

**Lectura estratégica.** Los medios españoles (Vitónica, Trendencias) y las tiendas tienen la autoridad. kettellbro no va a ganar por autoridad de dominio en el corto plazo. Gana (si gana) por **especificidad y honestidad**: contestar la pregunta exacta que nadie contesta bien (por ejemplo, el cálculo por peso y estatura, la rutina de 20 minutos con una sola pesa, el reto de 30 días sin riesgos) y **citar fuentes verificables**. El mercado latinoamericano parece menos cubierto con contenido propio (las primeras páginas observadas son sobre todo tiendas), pero esto hay que confirmarlo con una búsqueda desde cada país.

**Nombre de marca.** «kettellbro» se parece a «kettlebell» y se puede escribir «kettlebro», «kettelbro» (el nombre de la carpeta del proyecto) o «kettelbro». En el marcado `WebSite` se añaden esas grafías como `alternateName` (sección 7) y se revisa en Search Console qué consultas de marca llegan.

---

## 3. Mapa de palabras clave e intención

Sin volúmenes. La prioridad sale de intención, hueco observado y cercanía con la app.

**Término principal.** «Pesa rusa» se usa en titulares y H1 para cubrir América Latina y España; «kettlebell» entra como sinónimo en subtítulos y en H1 donde la consulta lo usa (por ejemplo, «swing de kettlebell»). Validar con Google Trends por país antes de fijar los títulos del calendario.

| Palabra clave (es) | Variantes | Intención | Etapa | URL propietaria | Prioridad |
|---|---|---|---|---|---|
| entrenador de pesa rusa / app de pesa rusa | app kettlebell, rutinas pesa rusa app | Comercial / navegacional | Decisión | `/` | Alta |
| qué peso de pesa rusa elegir | peso de kettlebell según mi peso, qué kettlebell comprar | Informacional con intención de compra | Consideración | `/guias/que-peso-de-pesa-rusa-elegir` | Alta |
| swing de kettlebell técnica | swing pesa rusa, cómo hacer el swing | Informacional (cómo hacer) | Descubrimiento | `/guias/swing-kettlebell-tecnica` | Alta |
| rutina de 20 minutos con pesa rusa | rutina corta con una pesa rusa | Informacional (rutina) | Descubrimiento | `/guias/rutina-20-minutos-una-pesa-rusa` | Alta |
| rutina de kettlebell para principiantes | pesa rusa para principiantes, empezar con kettlebell | Informacional | Descubrimiento | `/guias/rutina-kettlebell-principiantes` | Alta |
| reto 30 días pesa rusa | kettlebell challenge, 30 días de swings | Informacional / hábito (estacional, por validar) | Descubrimiento | `/guias/reto-30-dias-pesa-rusa` | Alta |
| turkish get up cómo hacerlo | levantamiento turco | Informacional | Descubrimiento | `/guias/turkish-get-up-paso-a-paso` | Media |
| pesa rusa en casa | kettlebell en casa, entrenar en casa con pesa rusa | Informacional / comercial | Consideración | `/guias/pesa-rusa-en-casa` | Media |
| peso muerto con pesa rusa / sentadilla goblet | goblet squat, kettlebell deadlift | Informacional | Descubrimiento | `/guias/peso-muerto-y-sentadilla-goblet` | Media |
| pesa rusa espalda baja | kettlebell dolor lumbar, swing y espalda | Informacional (salud, delicado) | Consideración | `/guias/pesa-rusa-espalda-baja` | Media (después de `/sobre` y `/ciencia`) |
| cuántas calorías quema la pesa rusa | kettlebell calorías, 1.200 calorías por hora | Informacional | Descubrimiento | `/guias/calorias-pesa-rusa` | Media (activo enlazable) |
| pesa rusa o mancuernas | kettlebell vs mancuernas | Comercial / comparación | Consideración | `/guias/pesa-rusa-o-mancuernas` | Media |
| cómo calentar antes de entrenar con pesa rusa | calentamiento kettlebell | Informacional | Descubrimiento | `/guias/calentamiento-pesa-rusa` | Baja |
| qué dice la ciencia sobre la pesa rusa | evidencia kettlebell, estudios kettlebell | Informacional (confianza) | Consideración | `/ciencia` | Alta (pilar de confianza) |

**Duraciones de sesión.** La app ofrece 10, 15, 20 y 25 minutos. Es tentador crear una página por duración. **No se recomienda**: serían cuatro páginas casi iguales (riesgo de contenido duplicado y de canibalización). Primero se publica la de 20 minutos. Las de 10, 15 y 25 se crean solo si Search Console muestra demanda y solo con una rutina distinta, título propio y contenido sustancialmente diferente.

---

## 4. Auditoría de canibalización (Fase 2.5, bloqueante)

Antes de proponer títulos, H1 o textos se aplicó la auditoría **sin Search Console** (el sitio es nuevo y no hay acceso a datos de consultas por página). Cuando haya datos, se repite con el procedimiento del paso 5.

### Paso 1. Inventario de URLs que tocan el tema

Hoy solo existe **una URL pública indexable**: `/`. Todo lo demás es una propuesta. Es el caso que más canibaliza en sitios con página de inicio fuerte: la portada gana por autoridad y deja sin aire a las subpáginas. Por eso la portada **no** se asigna ninguna palabra clave de las guías.

### Paso 2. Propietario único por consulta

| Consulta principal | Propietario | Prohibido como palabra principal en título, H1 o ancla de otras páginas |
|---|---|---|
| entrenador / app de pesa rusa | `/` | «app» y «entrenador» en títulos de guías |
| qué peso de pesa rusa elegir | Guía 1 | «qué peso», «elegir» como verbo principal en otros títulos |
| swing de kettlebell técnica | Guía 2 | «swing» como palabra principal del título del artículo 9 |
| rutina de 20 minutos con pesa rusa | Guía 3 | «20 minutos» en el título de los artículos 5 y 6 |
| rutina de kettlebell para principiantes | Artículo 5 | «principiantes» en el título de las guías 1, 2 y 3 |
| reto de 30 días | Artículo 6 | «30 días» en cualquier otra página |
| qué dice la ciencia / evidencia | `/ciencia` (pilar) | «ciencia», «evidencia» y «estudios» en el título de los satélites |
| pesa rusa espalda baja | Artículo 9 | «espalda» en la guía 2 (puede aparecer como subtítulo, no en título ni H1) |
| calorías | Artículo 10 | «calorías» y «quemar» en otros títulos |

### Paso 3. Desconflicto de títulos y H1

| Página | Título de buscador (SERP) | H1 | Longitud del título | Conflicto |
|---|---|---|---|---|
| `/` | kettellbro · Entrenador de pesa rusa con rutinas diarias | Tu entrenador de pesa rusa, una carta nueva cada día | 56 | No |
| `/guias` | Guías de pesa rusa: técnica, pesos y rutinas · kettellbro | Guías de pesa rusa | 57 | No: concentrador, no compite con las guías |
| Guía 1 | Qué peso de pesa rusa elegir según tu peso y estatura | Igual | 53 | No |
| Guía 2 | Swing de kettlebell: técnica paso a paso · kettellbro | Swing de kettlebell: técnica paso a paso | 53 | No |
| Guía 3 | Rutina de 20 minutos con una sola pesa rusa · kettellbro | Rutina de 20 minutos con una sola pesa rusa | 56 | No |
| Art. 4 | Turkish get-up: cómo hacerlo paso a paso · kettellbro | Turkish get-up: cómo hacerlo paso a paso | 53 | No |
| Art. 5 | Rutina de kettlebell (pesa rusa) para principiantes | Rutina de kettlebell para principiantes: plan de 4 semanas | 51 | No (no usa «20 minutos») |
| Art. 6 | Reto de 30 días con pesa rusa: cómo hacerlo bien | Igual | 48 | No |
| Art. 7 | Pesa rusa en casa: espacio, suelo y qué comprar primero | Igual | 55 | Vigilar «qué comprar» frente a la guía 1 (distinta intención) |
| Art. 8 | Peso muerto y sentadilla goblet con pesa rusa · kettellbro | Peso muerto y sentadilla goblet con pesa rusa | 58 | No |
| Art. 9 | Pesa rusa y espalda baja: qué se sabe y qué no · kettellbro | Pesa rusa y espalda baja: qué se sabe y qué no | 59 | No (evita «swing» y «ciencia») |
| Art. 10 | ¿Cuántas calorías quema la pesa rusa? El mito de las 1.200 | Igual | 58 | No |
| Art. 11 | Pesa rusa o mancuernas: diferencias y cuándo usar cada una | Igual | 58 | No |
| Art. 12 | Cómo calentar antes de entrenar con pesa rusa · kettellbro | Igual | 58 | No |
| `/ciencia` | La ciencia detrás de la pesa rusa, sin humo · kettellbro | La ciencia detrás de la pesa rusa, sin humo | 56 | Pilar de evidencia |

Notas: Google reescribe títulos largos y mide en píxeles; 60 caracteres es una guía. El sufijo « · kettellbro» (13 caracteres) se añade solo cuando el título cabe; si no, usar `title: { absolute: ... }`.

### Paso 4. Reglas de contenido entre páginas

- La portada **resume y enlaza**, no responde a fondo. Por ejemplo, la pregunta «¿Qué pesas necesito?» da una respuesta corta y enlaza a la guía 1.
- La guía 3 enlaza a la guía 1 para «qué peso» y a la guía 2 para la técnica del swing, en lugar de repetirlas.
- **Política de anclas**: un ancla que contiene la palabra clave de una página siempre apunta a su propietaria. Nunca se enlaza «swing de kettlebell técnica» a otra URL.
- El artículo 9 (espalda baja) resume lo que dice la guía 2 sobre cargas en dos frases y enlaza; no reescribe la sección.
- `/ciencia` lista referencias y niveles de evidencia; los satélites (calorías, espalda, mancuernas) explican un tema concreto y enlazan a `/ciencia` con ancla descriptiva, no repiten la lista.

### Paso 5. Higiene de canónicas e idioma

- Cada URL tiene canónica **autorreferente** (`alternates.canonical`). Sin canónicas cruzadas.
- Idioma: un solo español para América Latina y España. `<html lang="es">` ya está. **No** se recomienda separar por país ni crear `hreflang` regional sin datos que lo justifiquen; con una sola versión no hace falta `hreflang`.
- Contenido monolingüe: sin mezcla de idiomas en una misma URL (los nombres propios y términos técnicos como «swing» o «kettlebell» son normales).
- `/hoy`, `/progreso`, `/metas`, `/perfil`, `/sesion` y `/bienvenida` quedan fuera del índice (sección 8).

### Paso 6. Procedimiento cuando haya Search Console (obligatorio antes de cada optimización)

1. En Rendimiento, dimensiones **Página + Consulta**, filtrado por cada palabra clave objetivo.
2. Señal de canibalización activa: dos páginas del sitio en el top 20 para la misma consulta, con clics repartidos.
3. Asignar un propietario por consulta (la página con más clics e impresiones, o la más cercana semánticamente).
4. Reducir en las demás páginas la presencia de esa palabra clave, añadir enlaces internos hacia la propietaria y comprobar que los títulos no se pisan.
5. Registrar el resultado en este documento (tabla del paso 2).

**Aprobación.** Mapa limpio para el lanzamiento inicial (sin datos). La primera auditoría real con Search Console queda marcada para 4 semanas después de indexar las tres primeras guías.

---

## 5. Arquitectura de páginas públicas propuesta

### Mapa de URLs

| URL | Qué contiene | Palabra clave propietaria | Fase |
|---|---|---|---|
| `/` | Portada: héroe con el botón de Google, cómo funciona, por qué es distinto, personajes, «La ciencia sin humo», preguntas frecuentes, instalación y llamada a la acción. Contenido en `landing.es.json`. | entrenador / app de pesa rusa | P0 |
| `/guias` | Concentrador con tarjetas de las guías, ordenadas por tema (técnica, pesos, rutinas, seguridad). | guías de pesa rusa | P1 |
| `/guias/[slug]` | Artículos (12 en el calendario). Plantilla común: respuesta corta, esquema H2/H3, errores comunes, aviso de salud, «Fuentes» y llamada a la acción discreta. | Una por artículo | P1 y P2 |
| `/ciencia` | Pilar de evidencia: tabla de afirmaciones con nivel A–D, lista de referencias generada desde `src/content/evidence.json`, «lo que no afirmamos» (resumen de los 21 puntos de `estudios.md`) y método de verificación. | qué dice la ciencia sobre la pesa rusa | P1 |
| `/privacidad` | Qué datos se guardan, dónde, quién los ve, cómo pedir el borrado. **Texto del titular.** | n/a | P0 |
| `/terminos` | Condiciones de uso y aviso de salud. **Texto del titular.** | n/a | P0 |
| `/sobre` | Quién está detrás, política editorial (cómo se eligen y verifican las fuentes, cómo se corrigen errores), contacto. **Datos reales del titular; no inventar equipo ni credenciales.** | n/a | P1 |
| `/instalar` (opcional) | Versión corta de los pasos de instalación como enlace directo para bios y mensajes. | n/a | P2 |

Rutas de la app (`/hoy`, `/progreso`, `/metas`, `/perfil`, `/sesion`, `/bienvenida`) no son públicas.

### Implementación con grupos de rutas (sin tocar el código hoy, solo la propuesta)

```
src/app/
  (public)/            layout sin AppProviders: solo fuentes, estilos y JSON-LD
    page.tsx           Server Component: contenido de landing.es.json + <AuthIsland/>
    guias/page.tsx
    guias/[slug]/page.tsx
    ciencia/page.tsx
    privacidad/page.tsx
    terminos/page.tsx
    sobre/page.tsx
  (app)/               layout con AppProviders, noindex
    hoy/ progreso/ metas/ perfil/ sesion/ bienvenida/
  sitemap.ts
  robots.ts
```

Detalle de la portada: `page.tsx` deja de ser `"use client"`. La parte estática (héroe, secciones, FAQ) se renderiza en el servidor. El botón «Continuar con Google» y la redirección de quien ya tiene sesión viven en una isla de cliente (`AuthIsland`). Mientras Firebase resuelve, el héroe sigue visible (no se sustituye por `Splash`); el `Splash` se muestra solo a quien ya está autenticado y será redirigido. El manifest (`start_url: /hoy`) hace que quien ya instaló la app rara vez pase por `/`.

### Enlazado interno

```
                    ┌────────────────────────────┐
                    │  /  (portada)              │
                    └──────┬─────────┬───────────┘
        3 guías destacadas │         │ "Ver todas las referencias"
                           ▼         ▼
                 ┌──────────────┐  ┌───────────┐
                 │   /guias     │  │ /ciencia  │◄──────────────┐
                 └──────┬───────┘  └─────┬─────┘               │
        tarjetas        │                │ ancla descriptiva   │
      ┌───────┬─────────┼─────────┐      │                     │
      ▼       ▼         ▼         ▼      ▼                     │
   Guía 1  Guía 2    Guía 3   Arts. 4–12 (satélites) ──────────┘
      ▲       ▲  ▲      │   ▲
      └───────┴──┴──────┴───┘  (enlaces entre guías relacionadas)
```

| Desde | Hacia | Ancla (ejemplos) |
|---|---|---|
| Portada: FAQ «¿Qué pesas necesito?» | Guía 1 | «Cómo elegir el peso de tu pesa rusa» |
| Portada: sección de la ciencia | `/ciencia` | «Ver todas las referencias» |
| Portada: pie de página | `/guias`, `/ciencia`, `/privacidad`, `/terminos` | nombres de página |
| Guía 1 | Guía 3, Art. 7 (casa), Art. 8 | «rutina de 20 minutos con una pesa», «entrenar con pesa rusa en casa» |
| Guía 2 | Art. 8 (peso muerto), Guía 1, Art. 9 | «peso muerto con pesa», «elegir tu pesa», «pesa rusa y espalda baja» |
| Guía 3 | Guía 1, Guía 2, Art. 5, Art. 12 | «qué peso elegir», «técnica del swing», «plan para principiantes», «cómo calentar» |
| Cada guía | Portada | Llamada discreta: «Prueba kettellbro» (nunca como muro de conversión) |
| Cada guía | `/ciencia` | «qué evidencia respalda esto» cuando cite estudios |

**Reglas.** Cada URL del sitemap recibe al menos dos enlaces internos de HTML rastreable (no solo JavaScript). Las guías incluyen migas de pan (`BreadcrumbList`) y enlace a `/guias`. Nada de páginas huérfanas.

---

## 6. Plan de metadatos

Next.js: `generateMetadata` por página, `alternates.canonical`, `openGraph`, `twitter`. `metadataBase` ya existe en `layout.tsx`.

| Página | Título (SERP) | Descripción (≈ caracteres) | OG título | OG descripción | OG imagen |
|---|---|---|---|---|---|
| `/` | kettellbro · Entrenador de pesa rusa con rutinas diarias | Rutinas de pesa rusa (kettlebell) de 10 a 25 minutos, una carta nueva cada día, con respaldo en estudios y un acompañante que te guía serie por serie. (≈ 150) | kettellbro: tu entrenador de pesa rusa en el bolsillo | Una carta nueva cada día. Sesiones de 10 a 25 minutos con pesa rusa, respaldo en estudios y un acompañante en cada serie. | `/opengraph-image` (ya existe) |
| `/guias` | Guías de pesa rusa: técnica, pesos y rutinas · kettellbro | Guías de pesa rusa: técnica paso a paso, cómo elegir el peso y rutinas cortas. Cada una cita fuentes verificables y avisos de seguridad. (≈ 140) | Guías de pesa rusa | Técnica, pesos y rutinas cortas, con fuentes verificables. | Imagen genérica de guías |
| Guía 1 | Qué peso de pesa rusa elegir según tu peso y estatura | Guía de coaching para elegir tu primera pesa rusa según tu peso, estatura y nivel, con ejemplos, tabla kg–lb y un test de 10 swings para comprobarla. (149) | Igual al título | Igual a la descripción | Dinámica por guía |
| Guía 2 | Swing de kettlebell: técnica paso a paso · kettellbro | Aprende el swing de kettlebell paso a paso: bisagra de cadera, postura, agarre y errores comunes, con lo que dice la ciencia sobre la carga lumbar. (147) | Igual | Igual | Dinámica por guía |
| Guía 3 | Rutina de 20 minutos con una sola pesa rusa · kettellbro | Rutina de pesa rusa de 20 minutos con una sola pesa: calentamiento, tres bloques, tres días por semana y progresión. Incluye aviso de salud y fuentes. (150) | Igual | Igual | Dinámica por guía |
| `/ciencia` | La ciencia detrás de la pesa rusa, sin humo · kettellbro | Qué dice la ciencia sobre la pesa rusa, con estudios verificados, su nivel de evidencia (A a D) y lo que no afirmamos: sin humo ni promesas. (≈ 141) | La ciencia detrás de la pesa rusa | Estudios verificados y lo que no prometemos. | Genérica |
| `/privacidad` | Política de privacidad · kettellbro | POR DEFINIR por el titular. Debe resumir qué datos se guardan, dónde, quién los ve y cómo pedir su borrado. | Igual | Igual | Genérica |
| `/terminos` | Términos de uso · kettellbro | POR DEFINIR por el titular. | Igual | Igual | Genérica |
| `/sobre` | Sobre kettellbro · cómo verificamos las fuentes | POR DEFINIR (equipo y contacto reales). | Igual | Igual | Genérica |

Los títulos y descripciones de los artículos 4 a 12 están en las secciones 4 (títulos) y 11 (calendario). Las descripciones deben escribirse con la verdad del artículo: nada de «quema grasa» ni «tonifica».

**Detalles técnicos.**

- Portada: `title: { absolute: ... }` para no heredar la plantilla del layout (`%s · kettellbro`).
- Guías: `openGraph.type = "article"`, `publishedTime`, `modifiedTime` y `authors`. Imagen OG por guía con `opengraph-image.tsx` por ruta (el proyecto ya genera una portada con `ImageResponse`).
- Mantener `twitter.card = "summary_large_image"`.
- Eliminar `keywords` del layout: Google no lo usa y no aporta.
- `openGraph.locale: "es_MX"` está bien para empezar; si se quiere cubrir España, añadir `alternateLocale`. Verificar los códigos válidos de Open Graph antes de cambiar (prioridad baja).
- Verificación de propiedad en Search Console con `metadata.verification.google` (en `vercel.app` no se puede verificar por DNS).
- Importante: `/` debe devolver `200` con `Cache-Control` normal de Vercel. Evitar redirecciones de `/` a `/hoy` en el servidor: la redirección de quien tiene sesión debe ser del lado del cliente, para que los rastreadores vean la portada.

---

## 7. Datos estructurados (JSON-LD)

### Qué sirve hoy y qué no (verificado)

| Tipo | ¿Resultado enriquecido en Google? | Recomendación |
|---|---|---|
| FAQPage | **No.** Desapareció el 7 de mayo de 2026; la documentación se retiró el 15 de junio de 2026. | Opcional y sin efecto garantizado. Bajo costo porque el texto ya existe. Excluir preguntas pendientes («¿Cuánto cuesta?», «¿Qué pasa con mis datos?»). |
| HowTo | **No.** Se retiró en 2023. | No priorizar. Si se incluye en las guías 2 o 3, que sea solo por legibilidad para máquinas. |
| SoftwareApplication / MobileApplication / WebApplication | Solo con `name`, `offers.price` y `aggregateRating` o `review`. | **No es elegible hoy** (sin reseñas, precio por definir). Se puede publicar una descripción de la app **sin precio y sin calificaciones**. Nunca inventar `aggregateRating` ni `review`. |
| Organization | Sí (logo, nombre, contacto). | Recomendado en la portada. |
| WebSite (nombre del sitio) | Sí. Google lo usa para el nombre del sitio, solo en la página principal. | Recomendado, con `alternateName`. |
| Article / BlogPosting | Sí (fecha, autor, imagen). | Recomendado en guías. |
| BreadcrumbList | Sí. | Recomendado en guías. |

### Portada (`/`): `@graph`

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://kettellbro.vercel.app/#org",
      "name": "kettellbro",
      "alternateName": ["Kettlebro", "Kettelbro"],
      "url": "https://kettellbro.vercel.app/",
      "logo": "https://kettellbro.vercel.app/icon/512"
    },
    {
      "@type": "WebSite",
      "@id": "https://kettellbro.vercel.app/#website",
      "name": "kettellbro",
      "alternateName": ["Kettlebro", "Kettelbro"],
      "url": "https://kettellbro.vercel.app/",
      "inLanguage": "es",
      "publisher": { "@id": "https://kettellbro.vercel.app/#org" }
    },
    {
      "@type": "WebApplication",
      "@id": "https://kettellbro.vercel.app/#app",
      "name": "kettellbro",
      "url": "https://kettellbro.vercel.app/",
      "description": "Entrenador de pesa rusa (kettlebell) con una rutina distinta cada día, sesiones de 10 a 25 minutos y un acompañante en cada serie.",
      "applicationCategory": "HealthApplication",
      "operatingSystem": "Cualquiera con un navegador moderno (app web instalable)",
      "inLanguage": "es",
      "screenshot": [
        "https://kettellbro.vercel.app/screenshots/hoy.png",
        "https://kettellbro.vercel.app/screenshots/login.png"
      ]
    }
  ]
}
```

Notas: no incluir `offers` hasta definir el precio; no incluir `aggregateRating` ni `review`; `alternateName` con grafías habituales de error de la marca; el `logo` debe ser una imagen rastreable y estable (comprobar que `/icon/512` cumple); los `screenshot` deben existir en `public/screenshots/`.

### Guías: `Article` + `BreadcrumbList` (ejemplo para la guía 1)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": "https://kettellbro.vercel.app/guias/que-peso-de-pesa-rusa-elegir#article",
      "headline": "Qué peso de pesa rusa elegir según tu peso y estatura",
      "description": "Guía de coaching para elegir tu primera pesa rusa según tu peso, estatura y nivel, con ejemplos, tabla kg–lb y un test de 10 swings para comprobarla.",
      "inLanguage": "es",
      "datePublished": "2026-10-16",
      "dateModified": "2026-10-16",
      "mainEntityOfPage": "https://kettellbro.vercel.app/guias/que-peso-de-pesa-rusa-elegir",
      "author": { "@type": "Organization", "name": "kettellbro", "url": "https://kettellbro.vercel.app/" },
      "publisher": { "@id": "https://kettellbro.vercel.app/#org" },
      "image": "https://kettellbro.vercel.app/guias/que-peso-de-pesa-rusa-elegir/opengraph-image",
      "citation": [
        { "@type": "ScholarlyArticle", "name": "Kettlebell training in clinical practice: a scoping review", "url": "https://pubmed.ncbi.nlm.nih.gov/31497302/" },
        { "@type": "ScholarlyArticle", "name": "The Role of Kettlebells in Strength and Conditioning: A Review of the Literature", "url": "https://doi.org/10.1519/SSC.0000000000000048" }
      ]
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Inicio", "item": "https://kettellbro.vercel.app/" },
        { "@type": "ListItem", "position": 2, "name": "Guías", "item": "https://kettellbro.vercel.app/guias" },
        { "@type": "ListItem", "position": 3, "name": "Qué peso de pesa rusa elegir" }
      ]
    }
  ]
}
```

Notas: el autor es la organización mientras no haya una persona real con nombre y credenciales verificables. No atribuir revisión médica (`reviewedBy`) a nadie hasta que ocurra. `citation` es una propiedad válida de `CreativeWork` y deja la bibliografía legible por máquinas; el valor para Google no está garantizado. Las fechas deben coincidir con las del contenido visible.

### FAQPage (opcional) para la portada

Generar desde `landing.es.json` > `structuredData.faqItemIdsForSchema`; la respuesta del esquema debe ser el mismo texto visible, sin HTML añadido. Seis preguntas; se excluyen `precio` y `datos` mientras estén pendientes.

### Componente seguro (patrón recomendado por Next.js)

```tsx
// src/components/seo/JsonLd.tsx (propuesta)
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
```

Next.js recomienda renderizar el JSON-LD como una etiqueta `<script>` en `layout.js` o `page.js` y sustituir `<` por `<` para evitar inyecciones. Validar con la Prueba de resultados enriquecidos de Google y con validator.schema.org.

**Reglas.** El marcado refleja el contenido visible. Sin calificaciones, premios, usuarios ni testimonios inventados (Google añadió el 24 de julio de 2026 una pauta específica sobre reseñas falsas o con incentivo no declarado).

---

## 8. Sitemap y robots

### Sitemap (`src/app/sitemap.ts`, propuesta)

```ts
import type { MetadataRoute } from "next";

const SITE =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://kettellbro.vercel.app");

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = getAllGuides(); // lee el frontmatter: slug, date, updated
  return [
    { url: `${SITE}/`, lastModified: LANDING_LAST_UPDATED },
    { url: `${SITE}/guias`, lastModified: newest(guides) },
    ...guides.map((g) => ({ url: `${SITE}/guias/${g.slug}`, lastModified: g.updated ?? g.date })),
    { url: `${SITE}/ciencia`, lastModified: EVIDENCE_LAST_UPDATED },
    { url: `${SITE}/privacidad` },
    { url: `${SITE}/terminos` },
    { url: `${SITE}/sobre` },
  ];
}
```

- **Solo URLs públicas e indexables.** Ninguna ruta de la app.
- **`lastModified` real**, tomada de la fecha del contenido, no `new Date()` en cada compilación. Google usa `lastmod` solo si es consistente y verificable, y lo entiende como «la última actualización significativa».
- No hace falta `priority` ni `changeFrequency`: Google los ignora.
- Límite de 50 MB o 50.000 URLs por archivo: irrelevante aquí.
- Enviar `https://kettellbro.vercel.app/sitemap.xml` en Search Console y en Bing Webmaster Tools.

### Robots (`src/app/robots.ts`, cambios)

1. Declarar siempre el sitemap, con la misma lógica de URL del layout (hoy solo si `NEXT_PUBLIC_SITE_URL` existe):

```ts
sitemap: `${SITE}/sitemap.xml`,
```

2. Añadir `/__/` a `disallow` si se aplica el proxy de `/__/auth` descrito en `ARQUITECTURA-DATOS-AUTH.md`.
3. Mantener los `disallow` de la app (ahorran rastreo) **y** añadir `robots: { index: false, follow: false }` en la metadata del layout `(app)`. Aclaración importante de Google: `robots.txt` **no** es un mecanismo para sacar páginas de Google; para eso sirve `noindex` o proteger la página. Si Search Console informara «Indexada, aunque bloqueada por robots.txt» en alguna ruta de la app, se quita el `disallow` de esa ruta y se deja solo el `noindex` para que Google pueda leerlo.
4. No bloquear `/_next/static/` ni las imágenes: Google necesita CSS y JS para renderizar.

```
User-agent: *
Allow: /
Disallow: /hoy
Disallow: /progreso
Disallow: /metas
Disallow: /perfil
Disallow: /sesion
Disallow: /bienvenida
Disallow: /__/

Sitemap: https://kettellbro.vercel.app/sitemap.xml
```

---

## 9. Rendimiento (Core Web Vitals) para páginas públicas

**Umbrales (web.dev, percentil 75, verificado):** LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Un sitio nuevo probablemente no tenga datos de campo (CrUX) al principio: medir con Lighthouse (laboratorio) y, cuando haya tráfico, con Search Console (Core Web Vitals) y PageSpeed Insights.

| # | Acción | Dónde | Por qué | Criterio de aceptación |
|---|---|---|---|---|
| 1 | Renderizar `/` en el servidor | `src/app/page.tsx` | El LCP debe ser texto del HTML inicial, no esperar a Auth | `curl` devuelve el `h1` y el FAQ |
| 2 | Grupos de rutas: `(public)` sin `AppProviders` | `src/app/layout.tsx` | Evita cargar el SDK de Firebase (Auth y Firestore) en cada página pública | El análisis del paquete de una guía no incluye `firebase` |
| 3 | Isla de autenticación con carga diferida | `AuthIsland` | El SDK solo se descarga al tocar el botón o en reposo | INP del botón ≤ 200 ms |
| 4 | Elemento LCP sin animación de entrada | `LoginScreen.tsx` hoy anima las cartas desde `opacity: 0` | Una animación sobre el elemento LCP retrasa su pintado | El `h1` y el subtítulo no se animan; las cartas pueden hacerlo |
| 5 | Imagen del héroe con `next/image` (`priority`, ancho y alto, AVIF/WebP) | Portada | LCP e CLS | Imagen del héroe ≤ ~100 KB (objetivo interno) |
| 6 | Reservar espacio de cartas y figuras | Ya hay un contenedor de 346 × 244 | Evita saltos de diseño | CLS ≤ 0,1 |
| 7 | Fuentes: tres familias (`Alfa Slab One`, `Anybody` con eje de ancho, `Bricolage Grotesque`) | `layout.tsx` | `next/font` ya autoaloja y usa `swap` con ajuste de tamaño. `Anybody` (números de datos) no es necesaria en artículos | En `(public)` cargar solo las que se usen; medir antes y después |
| 8 | JavaScript de animación (`motion/react`) solo donde haga falta | Cartas del héroe | Reduce el paquete inicial | JS inicial de la portada ≤ ~100 KB comprimido (objetivo interno) |
| 9 | Guías generadas de forma estática | `generateStaticParams`, contenido en Markdown | Sin JS en el cuerpo del artículo | Páginas servidas desde CDN |
| 10 | Preguntas frecuentes e instalación con `<details>` | Portada | Sin JS y accesibles | Navegación por teclado |
| 11 | Imágenes de guías sin versionar nombre | `public/` + `sw.js` (caché primero) | Imágenes viejas en quien ya visitó | Usar `next/image` (ruta `/_next/image`, no caché primero) o nombres con hash; subir la versión de la caché al cambiar |
| 12 | Respetar `prefers-reduced-motion` | Ya contemplado | Accesibilidad y rendimiento | Sin animaciones forzadas |

**Medición.** Lighthouse en móvil emulado en cada despliegue de prueba; `useReportWebVitals` para enviar LCP, INP y CLS a un servicio sin cookies cuando haya tráfico; revisar Search Console (Core Web Vitals) cada mes. Los presupuestos de ~100 KB son metas internas razonables, **no** umbrales de Google.

---

## 10. Imágenes y personajes ilustrados

**Dato aportado por el coordinador (16/10/2026):** hay dos personajes ilustrados elegibles (un hombre calvo con barba y brazos tatuados; una mujer de pelo rojo rizado con coleta) con vistas de lado, de frente y en tres cuartos. No pude verificarlo en el código ni en la documentación que leí; el componente `ExerciseFigure` que sí vi dibuja figuras de trazo. Confirmar antes de publicar.

Si es así, es un diferenciador visual para SEO y para compartir en redes:

- **Héroe de la portada:** ilustración estática de los personajes (con `alt` descriptivo, ancho y alto fijos) como imagen de LCP o como imagen secundaria.
- **Imágenes sociales (OG):** una por guía con el título y el personaje haciendo el ejercicio; sirven en WhatsApp, X, Facebook y Slack.
- **Ilustraciones dentro de las guías:** `ExerciseFigure` admite una `phase` fija («muestra ese fotograma y no anima»), útil para fotogramas estáticos del swing y del peso muerto en las tres vistas; el SVG se pinta en la pose representativa también en el servidor. Eso permite figuras sin JavaScript en los artículos.
- **Texto alternativo:** describe la acción, no el cuerpo del personaje. Ejemplo: «Swing de kettlebell, posición alta: cuerpo en plancha vertical y pesa a la altura del pecho». Evitar descriptores de cuerpo en `alt`.
- **No usar** fotos de stock con «antes y después» ni testimonios. Marcar las imágenes ilustradas como ilustraciones.

---

## 11. Calendario editorial: 12 artículos y guías

### Cronograma

| Semana | Fecha de inicio | Entrega |
|---|---|---|
| 0 | 19 de octubre | **Sprint técnico P0**: portada en servidor, metadata, sitemap, robots, privacidad y términos, Search Console y Bing, grupos de rutas |
| 1 | 26 de octubre | Publicar portada + `/guias` + guías 1, 2 y 3 (ya escritas) + `/ciencia` |
| 2 | 2 de noviembre | Artículo 4 (get-up) |
| 3 | 9 de noviembre | Artículo 5 (principiantes) |
| 4 | 16 de noviembre | Artículo 6 (reto de 30 días): antes de enero para que esté indexado (hipótesis estacional, **por validar** con Google Trends) |
| 5 | 23 de noviembre | Artículo 7 (en casa) |
| 6 | 30 de noviembre | Artículo 8 (peso muerto y goblet) |
| 7 | 7 de diciembre | Artículo 10 (calorías) |
| 8 | 14 de diciembre | Artículo 11 (mancuernas) |
| 9 | 21 de diciembre | Artículo 12 (calentamiento) |
| 10 | 11 de enero | Artículo 9 (espalda baja), después de `/sobre` y de la política editorial; si hay un profesional de la salud real que lo revise, indicarlo |
| 11 | Primera auditoría con Search Console | Canibalización, consultas reales y reordenar |

Ritmo semanal, ajustable según capacidad. Un ritmo menor con calidad es mejor que uno alto con relleno.

### Artículos 1 a 3 (ya escritos)

| # | Título (H1) | Intención | Esquema H2 | Evidencia |
|---|---|---|---|---|
| 1 | Qué peso de pesa rusa elegir según tu peso y estatura | Informacional con intención de compra | Lo esencial · Lo que la ciencia no puede decirte · La regla en una frase · Cómo se calcula (4 pasos) · Ejemplos · Qué pesa en cada ejercicio · Test de la pesa correcta · Kilos y libras · Cuántas pesas comprar · Cuándo subir · Errores · Cuándo no basta · Cómo lo aplica kettellbro · Preguntas rápidas · Fuentes | `meigh2019`, `beardsley2014`, `lake2012a`, `acsm2009`; heurística de `body.ts` |
| 2 | Swing de kettlebell: técnica paso a paso | Informacional (cómo hacer) | Lo esencial · Antes de tu primer swing · Técnica en seis pasos · Qué revisar desde cada ángulo · Cuántos swings y cómo progresar · Qué dice la ciencia · Errores · Seguridad · Cómo trabaja kettellbro el swing · Fuentes | `mcgill2012`, `lake2012a`, `lake2012b`, `jay2011`, `lyons2017`, `levine2025`, `fradkin2006`, `karthik2013`, `coffey2026` |
| 3 | Rutina de 20 minutos con una sola pesa rusa | Informacional (rutina) | Aviso de salud · Lo esencial · Qué necesitas · Reparto de los 20 minutos · Calentamiento · Sesiones A, B y C · Semana · Esfuerzo · Progresión · Errores · Ciencia sobre sesiones cortas · Cómo lo hace kettellbro · Fuentes | `currier2026`, `androulakis2020`, `iversen2021`, `bull2020`, `lake2012a`, `hulsey2012`, `thomas2014`, `fortner2014`, `halperin2022`, `grgic2018`, `bell2023` |

### Artículos 4 a 12

**Artículo 4. Turkish get-up: cómo hacerlo paso a paso** · slug `turkish-get-up-paso-a-paso` · Intención: informacional (cómo hacer).
- H2: Qué es y para qué sirve · Antes de empezar (sin pesa, o con un zapato sobre el puño) · Las siete etapas (H3 por etapa, con los textos de `stagesEs` de `exercises.ts`) · Las dos etapas que más exigen al hombro · Regresiones (por partes, sin carga, descenso) · Errores comunes · Progresión (más peso, escaleras 1-2-3 por etapa, molino) · Seguridad · Cómo lo programa kettellbro (el principiante empieza con la pesa más ligera).
- Evidencia: `stonge2019` (mayor demanda de hombro en la etapa 2, apoyo en el codo, y en la 5, barrido de pierna; n = 12); `isiklar2026` (solo si se menciona el press boca abajo); `meigh2019`. Externas verificadas: StrongFirst, «The Turkish Get-Up—A Clinician's Perspective»; StrongFirst, «Sinister» (estándar de 1 get-up por minuto).
- Enlaces: guía 1 (pesa ligera), guía 3, artículo 12.

**Artículo 5. Rutina de kettlebell para principiantes: plan de 4 semanas** · slug `rutina-kettlebell-principiantes` · Intención: informacional.
- H2: Para quién es y aviso de salud · Qué necesitas · Semanas 1 y 2: aprender la bisagra (peso muerto, goblet, acarreo, press en media rodilla, remo) · Semana 3: entran los swings con rampa · Semana 4: semana ligera · Cómo medir el esfuerzo (RPE y repeticiones en reserva) · Errores comunes · Cuándo pasar al nivel intermedio · Preguntas frecuentes.
- Evidencia: `currier2026`, `acsm2009`, `mcgill2012`, `zourdos2016`, `halperin2022`, `bell2023`, `bull2020`, `garber2011`.
- Guarda de canibalización: no usar «20 minutos» en título ni en H1; enlazar a la guía 3 para la rutina corta.

**Artículo 6. Reto de 30 días con pesa rusa: cómo hacerlo bien** · slug `reto-30-dias-pesa-rusa` · Intención: informacional / hábito.
- H2: Qué respalda y qué no un reto de 30 días (ningún ensayo prueba el formato «reto») · Por qué 3 sesiones por semana durante 4 semanas · Plan semanal y semana de prueba · Lo que conviene evitar (100 swings al día, 50 swings por hora) · Cómo medir el progreso (repeticiones, pesa, esfuerzo; pesaje semanal opcional) · Después del reto · Preguntas frecuentes.
- Evidencia: `falatic2015`, `jay2011`, `lake2012a`, `currier2026`, `garber2011`, `meigh2019`, `viana2019`, `madigan2015`, `zheng2015`, `steinberg2014`; `protocolos.md` §9. Los enlaces a retos populares (Marathon Handbook, FitnessVolt, Refinery29) aparecieron en búsqueda pero no se abrieron: **verificar antes de citar**.
- Mensaje clave del documento base: «La ciencia respalda 3 sesiones por semana durante 4 semanas o más; no necesitas swings todos los días ni cientos por hora».

**Artículo 7. Pesa rusa en casa: espacio, suelo y qué comprar primero** · slug `pesa-rusa-en-casa` · Intención: informacional / comercial.
- H2: Cuánto espacio necesitas · Suelo y ruido · Qué comprar primero (set de tres: ligera, referencia y siguiente) · Criterios al comprar (asa, base plana, acabado; sin marcas ni precios) · Seguridad (zona libre, no soltar la pesa) · Cuidado de manos · Una rutina mínima para casa.
- Evidencia: `coffey2026` (lesiones por equipo caído y golpes; no hay tasa específica de kettlebell), `karthik2013`; enlaces a StrongFirst (agarre). Fuentes de moretones y callos de `protocolos.md` §8.3 y §8.4 (BarBend, Breaking Muscle): **verificar antes de citar**.
- Enlaces: guía 1 (el peso), guía 3.

**Artículo 8. Peso muerto y sentadilla goblet con pesa rusa** · slug `peso-muerto-y-sentadilla-goblet` · Intención: informacional.
- H2: Por qué primero la bisagra · Peso muerto con pesa en cuatro pasos · Sentadilla goblet · Sentadilla con apertura de cadera · Progresión · Errores · Qué sigue (el swing).
- Evidencia: `mcgill2012`, `currier2026`, `acsm2009`, `fradkin2006`, `behm2016`. StrongFirst, «Kettlebell Simple & Sinister: tips for heavy goblet squats»: **verificar antes de citar**.
- Cues: los de `exercises.ts` (peso muerto y goblet).

**Artículo 9. Pesa rusa y espalda baja: qué se sabe y qué no** · slug `pesa-rusa-espalda-baja` · Intención: informacional (salud; sensible).
- H2: Respuesta corta · Qué midió McGill y qué no puede decir · El ensayo de Jay (dolor leve a moderado; no es un tratamiento) · Efectos inmediatos en personas sanas · Fatiga y técnica · Cuándo consultar a un profesional · El modo de cuidado de espalda baja de kettlebell · Preguntas frecuentes.
- Evidencia: `mcgill2012`, `jay2011`, `keilman2017`, `hanney2024`, `levine2025`, `meigh2019`.
- Cautela: no prometer alivio ni protección; incluir el aviso médico; publicar después de `/sobre`. Valorar la revisión por un profesional de la salud real y declararla solo si ocurre.

**Artículo 10. ¿Cuántas calorías quema la pesa rusa? El mito de las 1.200** · slug `calorias-pesa-rusa` · Intención: informacional (mito).
- H2: Respuesta corta · De dónde sale el mito (la cifra de 20,2 kcal/min suma una estimación anaeróbica; la medida aeróbica fue 13,6 kcal/min en 10 personas, en un informe sin revisión por pares) · Qué dice el Compendio de 2024 (9,8 METs para swings) y cómo se convierte en un rango · Comparación con correr · El «efecto postcombustión» (≈ 55 kcal) · Tabata y pérdida de peso · Qué hacer con estos números.
- Evidencia: `schnettler2010`, `herrmann2024`, `farrar2010`, `hulsey2012`, `thomas2014`, `sturdy2024`, `viana2019`.
- Regla: mostrar siempre rangos y la palabra «estimación»; nada de cifras exactas por persona. Es un activo enlazable por su tema.

**Artículo 11. Pesa rusa o mancuernas: diferencias y cuándo usar cada una** · slug `pesa-rusa-o-mancuernas` · Intención: comercial / comparación.
- H2: Respuesta corta · Qué hace distinta a la pesa rusa (movimientos balísticos) · Qué dice la evidencia (la halterofilia dio más fuerza en un ensayo; el tipo de equipo no marcó diferencias consistentes en la posición de la ACSM) · Cuándo conviene cada una · Espacio y presupuesto · Cómo combinarlas.
- Evidencia: `otto2012`, `beardsley2014`, `currier2026`, `meigh2019`, `lyons2017`.
- No afirmar que la pesa rusa sea «mejor que» nada.

**Artículo 12. Cómo calentar antes de entrenar con pesa rusa** · slug `calentamiento-pesa-rusa` · Intención: informacional.
- H2: ¿Hace falta calentar? (la evidencia de prevención de lesiones es insuficiente) · El método RAMP en cinco minutos · Cinco movimientos (halo, sentadilla con apertura de cadera, puente de glúteos, bisagra, repeticiones ligeras) · Qué evitar antes de la potencia (estiramientos estáticos largos) · Versión de tres minutos · Errores comunes.
- Evidencia: `fradkin2006`, `behm2016`. Jeffreys 2007 (RAMP) y Van Hooren y Peake 2018 aparecen en `protocolos.md`: **verificar antes de citar**.

**Banco de reserva (si la demanda lo confirma):** esfuerzo percibido y repeticiones en reserva explicados (`zourdos2016`, `helms2016`, `halperin2022`); cuidado de manos (callos y ampollas); halo; swing a una mano; rutinas de 10, 15 y 25 minutos (solo con contenido distinto).

### Plantilla de artículo

1. Respuesta corta en las primeras 100 palabras · 2. Aviso de salud en artículos de ejercicio · 3. «Lo esencial en 30 segundos» · 4. Desarrollo con H2/H3 · 5. Lista de errores comunes · 6. «Qué dice la ciencia (sin exagerar)» con niveles de evidencia · 7. «Cómo lo hace kettellbro» (una nota breve, no un anuncio) · 8. Fuentes con PubMed y DOI · 9. Fecha de publicación y actualización · 10. Enlaces internos según la sección 5.

**Reglas de contenido.** Cero testimonios, cifras de usuarios, premios o promesas de salud. Las afirmaciones científicas salen de `docs/BASE-CIENTIFICA.md` y `docs/research/estudios.md`, con lenguaje prudente («puede», «en estudios pequeños»). No prometer quemar grasa, tonificar ni curar la espalda. Registrar en cada artículo el nivel de evidencia (A–D).

---

## 12. Medición e iteración

**Montaje (semana 0).**

- Propiedad de URL con prefijo en Search Console para `kettellbro.vercel.app` (verificación con la etiqueta HTML o `metadata.verification`); si se compra un dominio propio, pasar a propiedad de dominio por DNS y mantener redirecciones 301 desde `vercel.app`.
- Bing Webmaster Tools (importar desde Search Console).
- Enviar el sitemap; inspeccionar `/` y una guía con «Inspeccionar URL > Ver página rastreada» para confirmar que el HTML renderizado contiene el contenido.
- Analítica sin cookies de terceros. Si se añade, **actualizar la política de privacidad y la respuesta «¿Qué pasa con mis datos?»** (hoy la respuesta enumera solo los datos de la cuenta de Google, los ajustes y las sesiones).

**Indicadores (sin líneas base inventadas: se miden desde cero).**

| Nivel | Indicador | Meta inicial |
|---|---|---|
| Técnico | URLs del sitemap indexadas / URLs enviadas | 100 % de las públicas |
| Técnico | Core Web Vitals en móvil (LCP, INP, CLS) | Todos en «Bueno» |
| Visibilidad | Impresiones, clics y posición media por URL propietaria (no de marca) | Tendencia creciente mes a mes |
| Visibilidad | Consultas de marca («kettellbro», «kettlebro») | Registrar la línea base en el mes 1 |
| Conversión | Clics en «Continuar con Google» desde páginas públicas; inicios de sesión completados | Registrar la línea base y mejorar |
| Producto | Eventos `appinstalled` y primera sesión completada tras llegar por búsqueda | Registrar |

**Cadencia.** Semanal: indexación y errores. Mensual: auditoría de canibalización con Search Console (Página + Consulta), decisión de qué actualizar y qué publicar. Trimestral: revisar el calendario, las duraciones de sesión con demanda real y las fuentes nuevas.

**Plazos realistas.** Es un dominio nuevo, en un tema donde medios y tiendas tienen autoridad. La indexación puede tardar de días a semanas; el posicionamiento estable se mide en meses. No hay atajos honestos.

**Autoridad (solo prácticas aceptables).** Activos enlazables propios: la tabla kg–lb y el método de pesos (guía 1), el artículo de calorías (mito de las 1.200), la página de referencias verificadas y «lo que no afirmamos» (de `estudios.md`). Divulgación con entrenadores y blogs de fitness en español, aportando datos verificables. Sin compra de enlaces, sin intercambios masivos, sin reseñas falsas.

**Riesgos.** Contenido de salud (tema sensible para Google): mitigar con fuentes, avisos, política editorial y, si es posible, revisión de un profesional real. Autoridad baja del dominio. Dependencia de que la activación del proveedor de Google en Firebase esté hecha (el README la lista como pendiente): si el botón falla, la conversión desde SEO es cero.

---

## 13. Coherencias detectadas en el repositorio (para corregir o confirmar)

1. **Duración de la sesión.** El coordinador indica que las sesiones se guían por tiempo y duran exactamente 10, 15, 20 o 25 minutos. `docs/MOTOR-DE-RUTINAS.md` y las pruebas describen una duración estimada «±35 %» y `types.ts` documenta `durationMin` como «estimada». El texto público dice «la rutina se arma para ese tiempo, calentamiento incluido». Si la duración exacta queda confirmada, actualizar la documentación y reforzar el texto.
2. **Personajes y vistas** (sección 10): sin verificar en el código que leí.
3. **Rampa de swings.** `docs/MOTOR-DE-RUTINAS.md` §6 dice que desde la semana 3 el volumen de swings «entra en rampa (4 series, +2 por semana)»; el comentario de `generator.ts › rampSwings` habla de 4 series «la primera semana de swings» y su fórmula (`4 + 2 × (weekIndex − 1)`) daría 8 series en la semana 3 si `weekIndex` cuenta semanas de programa. Confirmar cuál es la intención. Las guías proponen una rampa conservadora propia (4 series y +2 por semana) y lo señalan como criterio de coaching.
4. **`robots.ts` sin `Sitemap:`** en producción (sección 8).
5. **Cifras de ejemplo de la guía 1** calculadas a mano; añadir una prueba que fije esos seis casos.

---

## 14. Fuentes consultadas

**Verificadas el 15 y 16 de octubre de 2026 (se abrieron y se comprobó el contenido citado):**

- Google Search Central, historial de documentación (FAQ y HowTo; reseñas falsas): https://developers.google.com/search/updates
- Google, galería de resultados enriquecidos: https://developers.google.com/search/docs/appearance/structured-data/search-gallery
- Google, datos estructurados de aplicaciones de software: https://developers.google.com/search/docs/appearance/structured-data/software-app
- Google, nombres de sitio: https://developers.google.com/search/docs/appearance/site-names
- Google, sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google, introducción a robots.txt: https://developers.google.com/search/docs/crawling-indexing/robots/intro
- Google Cloud, requisitos de verificación de marca (OAuth): https://support.google.com/cloud/answer/13464321
- Next.js, JSON-LD: https://nextjs.org/docs/app/guides/json-ld
- Next.js, `sitemap.ts`: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- web.dev, Core Web Vitals: https://web.dev/articles/vitals
- PAR-Q+: https://eparmedx.com/
- StrongFirst: https://www.strongfirst.com/sinister/ · https://www.strongfirst.com/is-there-a-perfect-swing-or-the-quest/ · https://www.strongfirst.com/power-rhythm-kettlebell-swing/ · https://www.strongfirst.com/proper-swing-grip-kettlebell-halo/ · https://www.strongfirst.com/the-turkish-get-up-a-clinicians-perspective/
- Vitónica: https://www.vitonica.com/ecommerce/kettlebell-pesa-rusa-cual-mejor-comprar-consejos-recomendaciones · https://www.vitonica.com/entrenamiento/entrena-reloj-prueba-tu-forma-fisica-esta-sesion-25-minutos-pesas-rusas
- Referencias científicas (comprobadas con la API de NCBI, autores, revista, año y DOI): PMID 21997449, 22580981, 21107513, 41843416, 31797219, 34125411, 31497302, 33239350, 22207261, 28394829, 20300022, 24345977, 27182402, 30691756, 23731737, 34542869, 28933024, 16679062, 26642915, 22395274, 27766131, 26102260, 22344061, 21694556, 19204579, 26049792, 41118234, 37730925, 36334240, 33497853. Beardsley y Contreras 2014 comprobado en Crossref (DOI 10.1519/SSC.0000000000000048). Las páginas web de PubMed muestran un aviso de cookies a este tipo de lector; los enlaces `pubmed.ncbi.nlm.nih.gov/PMID/` de las guías funcionan para lectores normales.
- Producción: https://kettellbro.vercel.app/ (texto visible), `/robots.txt` (contenido), `/sitemap.xml` (404).

**Observadas en resultados de búsqueda pero no abiertas (usar solo como pista; verificar antes de citar):** Myprotein, Trendencias, SensAI, FitGeneration, Basic-Fit, Refinery29, Marathon Handbook, FitnessVolt, las fichas de tiendas y de aplicaciones.

**No verificadas:** etiquetas exactas de los menús de instalación en Android (Chrome) y en iPhone (Safari) en la ayuda oficial, que `landing.es.json` marca como pendientes de comprobar en dispositivos reales; los códigos de configuración regional de Open Graph para América Latina.

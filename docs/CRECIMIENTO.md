# Plan de crecimiento y retención de kettellbro

Fecha: 2026-10-16. Estado: propuesta para decisión del dueño del producto. Sin cifras de mercado inventadas y sin metas numéricas prometidas.

## 0. Cómo leer este documento

**Qué es.** Un plan concreto para llegar a más público y retener mejor, apoyado en lo que el producto ya tiene (carta del día, Tabla con frijoles, ¡LOTERÍA!, mazo, racha con escudos, rangos, tarjeta compartible, acompañante en vivo, respaldo científico).

**Qué leí.** `PRODUCT.md`, `DESIGN.md`, `README.md`, `docs/BASE-CIENTIFICA.md`, `docs/MOTOR-DE-RUTINAS.md`, `docs/ARQUITECTURA-DATOS-AUTH.md` y el código relevante: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/opengraph-image.tsx`, `next.config.ts`, `public/sw.js`, `LoginScreen`, `Onboarding`, `Hoy`, `Progreso`, `Metas`, `Perfil`, `Celebration`, `FinishView`, `SessionPlayer`, `shareCard.ts`, `cues.ts`, `useCountdown.ts`, `progression.ts`, `goals.ts`, `steps.ts`, `types.ts`. También pedí a producción `/`, `/robots.txt`, `/sitemap.xml` y `/manifest.webmanifest`.

**Etiquetas de evidencia.**
- **[VERIFICADO]** lo comprobé en una fuente que abrí o que apareció en una búsqueda; va con enlace.
- **[OBSERVADO]** lo vi en el código o en producción hoy.
- **[HIPÓTESIS]** es mi inferencia; hay que medirla.
- **[NO VERIFICADO]** no pude confirmarlo; no lo uso como base de nada o lo marco para probar en dispositivo.

**Esfuerzo (S/M/L), por alcance y no por días.**
- **S**: un componente o archivo, sin cambios de datos.
- **M**: varios archivos, o un campo nuevo en un documento ya existente.
- **L**: infraestructura o colección nueva.

**"Backend nuevo"** significa colección nueva, reglas de Firestore nuevas, Cloud Functions, rutas de servidor o cron, o un plan de pago. Un campo extra en un documento existente no cuenta, porque `ARQUITECTURA-DATOS-AUTH.md` §7 permite campos extra. Aun así se prueba con el emulador (`scripts/test-firestore-rules.mjs`).

### 0.1 Cambio de producto incorporado (aviso del coordinador, 2026-10-16)

| Hecho nuevo | Consecuencia para crecimiento |
|---|---|
| Todas las sesiones son guiadas por tiempo: cuenta atrás por serie, repeticiones marcadas por cadencia, sin preguntar "¿ya terminaste?" | Diferenciador demostrable ("tú levantas, la app cuenta"), pero el audio y la pantalla pasan a ser críticos (§1.3, B6). Cambia qué significan los kg, los récords y "sesión completada" (§1.5, §5). |
| La duración es exactamente la elegida (10/15/20/25 min) | Promesa de marca muy clara ("10 minutos son 10 minutos"). **Antes de publicarla hay que probarla en el motor** (§1.6). |
| Dos personajes ilustrados (hombre calvo con barba y brazos tatuados; chica delgada de pelo rojo rizado con coleta) | Identidad elegible, tarjeta compartible personalizada y contenido propio para video. También riesgos de representación y de exportación del SVG (§1.5, §3.2). |
| Vistas de lado, frente y 3/4 | Contenido de técnica único para SEO y video (§3.4, §3.7). |
| Portada pública pendiente | Es la mayor palanca de adquisición que falta. Especifico qué debe llevar en B4. |

**Discrepancia que debes saber.** En el código que leí hoy, `SessionPlayer.tsx` aún tiene pasos `mode: "reps"` con botón "Hecho" y contador +/-, y `UserSettings` no tiene campo de personaje. Y `docs/MOTOR-DE-RUTINAS.md` §7–§8 todavía dice "con botón Hecho" y "duración ±35 %". O el cambio no está fusionado, o está en otra rama. Los ítems que dependen de él (B5, B6, B8, B10) están escritos para el producto nuevo. **Verifica la fusión antes de implementarlos, y actualiza el doc del motor para que lo que afirmamos en público siga siendo cierto.**

---

## Resumen: las cinco palancas y la fila de espera

| # | Palanca | Por qué | Backend nuevo |
|---|---|---|---|
| 1 | **Portada pública + guardia de navegador integrado** | Hoy lo único que ve un buscador o un visitante es un splash. Y el tráfico de TikTok/Instagram puede chocar con el bloqueo de Google OAuth en webviews. | No |
| 2 | **Tarjeta compartible v2** | El enlace está en la zona que tapa la interfaz de historias y el texto compartido no lleva URL. Es el bucle viral ya construido. | No |
| 3 | **Recordatorio por calendario ahora, Web Push después** | Hoy no hay ningún recordatorio. El calendario cubre iOS y Android sin servidor. | Calendario: no. Web Push: sí |
| 4 | **Hacer visible lo que ya existe** (escudos, mazo "k de M", Lotería semanal) | Hoy los escudos no se ven y el mazo no tiene total ni "carta nueva". | No |
| 5 | **Medir sin vigilar** (pageviews sin cookies + script de cohortes sobre datos que ya guardas) | Sin medición no hay experimentos. | No |

**Prerrequisitos (P0) antes de gastar un minuto en campañas** (detalle en §1.6):
1. Probar el login real en cinco entornos.
2. Confirmar que la pantalla de consentimiento de Google está "En producción".
3. Publicar política de privacidad y términos.
4. Definir un proceso de borrado de cuenta.
5. Poner alertas de presupuesto y decidir el plan de Firebase.

---

## 1. Diagnóstico honesto del producto hoy

### 1.1 Recorrido real y dónde se puede caer

| Paso | Qué ocurre [OBSERVADO] | Fricción o riesgo |
|---|---|---|
| 1. Visita a `/` | `src/app/page.tsx` es un componente cliente: con `status = loading` muestra `Splash` ("Abriendo kettellbro…"). **En producción, el HTML que recibí contiene solo "KETTELLBRO / Una carta nueva cada día. / Abriendo kettellbro…".** | Sin contenido indexable ni explicación del producto para quien llega desde un buscador o un bot. `/sitemap.xml` devuelve 404. |
| 2. `LoginScreen` | Mano de 3 cartas, titular "Una carta nueva cada día.", 3 viñetas y botón "Continuar con Google". | El valor vivo del producto (el acompañante) no se ve antes de pedir cuenta. |
| 3. Google | Popup, con respaldo a redirección (`auth.ts`). | Ver §1.2 F2: riesgos de redirección, navegadores integrados y estado de la pantalla de consentimiento. |
| 4. `resume()` | Seis lecturas en paralelo. Un usuario nuevo recibe perfil + Día 1 en un `writeBatch`. | El usuario ya existe en Firestore **antes** de terminar el onboarding: sirve para medir abandono de onboarding (§5). |
| 5. Onboarding | **7 pantallas**: seguridad, nivel, meta, tiempo, cuerpo (opcional), pesas, acompañante. | Mínimo 7 toques más las decisiones. El valor (la carta) aparece al final. |
| 6. `/hoy` | Hero con la carta, "Empezar" y una página larga. | Bien. La carta aparece con animación de reparto. |
| 7. `/sesion` | Cuenta 3-2-1 y primer ejercicio. | Con sesiones por tiempo y sin toques, un fallo de audio o de pantalla es silencioso (§1.3). |

### 1.2 Fricciones de activación, de mayor a menor severidad

**F1. No hay portada pública.** [OBSERVADO]
- `robots.ts` permite `/` y bloquea las rutas de la app, pero `/` no tiene texto que indexar.
- Verifiqué `/sitemap.xml` y devuelve 404.
- La línea `Sitemap:` en `robots.txt` solo se emite si existe `NEXT_PUBLIC_SITE_URL`. En la respuesta resumida que obtuve no vi esa línea.
- Es el cuello de botella de adquisición orgánica y de cualquier enlace que se comparta fuera de la tarjeta.

**F2. El login es el punto de fallo técnico más grave, y no lo he podido probar.**
- **Redirección en dominio no-Firebase.** El propio doc dice que el rewrite de `/__/auth` **no está aplicado** y que no se probó en móvil real. Confirmé que `next.config.ts` no tiene `rewrites()`. [OBSERVADO]
- **Pendientes de consola.** El README lista como pendiente activar el proveedor Google y autorizar `kettellbro.vercel.app`. Puede estar resuelto ya; verifícalo.
- **Estado de la pantalla de consentimiento.** Si el proyecto de Google Cloud está en "Testing", solo pueden entrar hasta 100 usuarios de prueba; en "In production" entra cualquier cuenta de Google. Las apps que piden solo ámbitos básicos (nombre, correo, perfil, OpenID) están exentas de la caducidad de 7 días. [VERIFICADO: [Google Cloud, estado de publicación](https://support.google.com/cloud/answer/15549945)]
- **Navegadores integrados.** Google bloquea OAuth en webviews embebidos ("disallowed_useragent"). [VERIFICADO como política: [Google Developers Blog 2021](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/), vía resultados de búsqueda; no abrí la página.]
  - Si Instagram, TikTok o Facebook abren tus enlaces en su navegador integrado, el login puede fallar. **Qué apps lo hacen y cómo exactamente: [NO VERIFICADO]; prueba con teléfonos reales.**
  - Es crítico porque casi todo el plan de video (§3.4) manda gente desde esas apps. Ver B1.
- **PWA instalada en iPhone.** La app instalada puede no compartir la sesión con Safari, y el login ocurre dentro de la app instalada [HIPÓTESIS, probar en dispositivo]. Mensaje sugerido si pasa: "Entra con Google otra vez: tu historial te espera."

**F3. Onboarding de 7 pasos.** Se puede acortar sin tocar seguridad (§1.3).
- `defaultSettings()` precarga pesas `[8, 12, 16]`, y el botón "Siguiente" de pesas ya está habilitado. Un usuario que toca todo sin leer recibe la primera rutina con una pesa que quizá no tiene. Es un riesgo de seguridad y de mala primera impresión, no solo de velocidad.

**F4. Sin vista previa del producto vivo antes del muro de login.**
- El diferenciador (el acompañante serie a serie) no se ve.
- La regla "login obligatorio" no se rompe con una demostración estática (§1.3-D), pero **eso lo debe decidir el dueño**.

**F5. La primera sesión por tiempo depende del audio y de la pantalla encendida.**
- La cuenta atrás usa marcas de tiempo (`performance.now`), así que no se desfasa aunque el navegador la frene. [OBSERVADO en `useCountdown.ts`]
- Los pitidos y la voz solo suenan si la página sigue activa.
- `keepAwake()` falla en silencio: si `navigator.wakeLock` no existe o rechaza, devuelve una función vacía y la UI no avisa. [OBSERVADO en `cues.ts`]
- **Wake Lock en PWA instalada de iPhone.** Una guía lo da por roto hasta iOS 18.4 ([Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock), fuente secundaria). La tabla de MDN anota "16.4–18.4: no funciona en web apps standalone" según el resumen que obtuve, y el [bug de WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545) está cerrado sin confirmar versión. Conclusión: **probar en dispositivo**.
- **Vibración.** MDN marca la Vibration API como "disponibilidad limitada" (no Baseline). No pude ver la tabla de compatibilidad. En iPhone no cuentes con ella [NO VERIFICADO].
- Si en iPhone la pantalla se bloquea a mitad de sesión, se pierde la guía. Eso es abandono en la primera sesión, la más cara de perder. Ver B6.

**F6. Un dato de calidad cambia con las sesiones por tiempo.**
- El tonelaje y los "récords" salen de las repeticiones **prescritas por cadencia**, no de repeticiones confirmadas por el usuario. `docs/MOTOR-DE-RUTINAS.md` §9 ya admitía esto para EMOM e intervalos y ahora aplica a todo.
- La tarjeta compartible y `Celebration` muestran "kg movidos" y "Récord". Si esos números se vuelven estimaciones, el principio 5 de `PRODUCT.md` ("Progreso visible y honesto") queda en riesgo.
- Recomendación en B5: priorizar "series completas" y llamar a los kg "según tu plan", o dejar de compartirlos.

### 1.3 Cómo acortar el tiempo al primer valor sin romper Google-only ni la seguridad

**A. Camino rápido de onboarding (7 → 4 o 5 pantallas).** No se toca ninguna puerta de seguridad.

| Pantalla | ¿Imprescindible antes de la primera sesión? | Decisión |
|---|---|---|
| Seguridad (cribado) | Sí. Puerta de seguridad (`MOTOR` §6). | Se queda, idéntica. |
| Nivel | Sí. Define qué ejercicios salen. | Se queda. |
| Tiempo | Sí. Define el presupuesto de la sesión. | Se queda. |
| Pesas | Sí. El motor solo programa con las pesas del usuario. | Se queda, **sin pesas marcadas de antemano**. |
| Meta | No. "Equilibrado" es el valor recomendado. | Se difiere a "Afina tu plan". |
| Cuerpo (peso y estatura) | No, es opcional. Sin él se usa la pesa según nivel. | Se difiere. |
| Acompañante (sonido/voz/vibración) | No como pantalla. Sirve más una **prueba de sonido** al empezar (B6). | Se difiere; valores por defecto activos. |
| Personaje (nuevo) | Un toque y es emocional. | **[HIPÓTESIS]** ponerlo primero. Variante B: asignar uno por defecto y ofrecer cambio en Hoy. Medir ambas (E03). |

Lo diferido se ofrece como tarjeta "Afina tu plan" **después de la primera sesión**, en el momento de éxito. El mecanismo ya existe: `dueCheckIns` pone "Pendiente en tu plan" en Hoy.

**B. Esperar menos mientras Google responde.** Mientras `resume()` corre, mostrar en el splash una cuenta honesta de lo que viene: "Ahora, {n} preguntas rápidas y tu primera carta", con `n` leído del largo real de `steps` (así nunca miente). Sin prometer segundos: no los he medido.

**C. Google One Tap / FedCM.**
- Reduciría toques en Android con cuenta de Google ya abierta. Sigue siendo Google-only.
- Pasaría el token a Firebase con `signInWithCredential`.
- **[NO VERIFICADO]**: requisitos actuales de Google Identity Services y su interacción con Firebase Auth. Compruébalo en su documentación antes de implementarlo. Es experimento E22, no ítem inmediato.

**D. Vista previa sin cuenta (decisión del dueño).**
- Un bucle animado de 15 a 20 s en la portada: el personaje haciendo la serie con la cuenta atrás y la voz, más una carta de muestra.
- Es contenido de marketing: sin persistencia, sin rutina generada y sin datos de nadie. No es acceso anónimo a la app.
- Si el dueño lee la regla de forma estricta, se omite y el resto del plan sigue en pie.

### 1.4 Puntos fuertes virales y de retención (con evidencia en el código)

- **Carta del día coleccionable** con nombre, enfoque y canto (verso): ya es contenido compartible por sí mismo.
- **Cada usuario recibe una rotación propia de ejercicios** (`MOTOR` §1): "misma app, distinta carta" es un gancho de comparación natural.
- **Tarjeta Wrapped diaria** con Web Share de archivos y respaldo de descarga (`shareCard.ts`).
- **Sin castigo por perder un día:** el Día N avanza al completar, no por calendario. El descanso cuenta y mantiene la racha. Esto diferencia a kettellbro de las apps de racha rígida y permite un tono sin culpa.
- **Honestidad científica:** 71 citas verificadas y una lista explícita de lo que no se afirma (`BASE-CIENTIFICA` §3). En una búsqueda puntual de hoy, los resultados en español eran sobre todo tiendas (Decathlon, Carrefour, Rogue, MediaMarkt, Ripley) y medios (Vitónica, Trendencias). **Eso es una observación de una sola búsqueda, no una medición de volumen ni de competencia.**
- **Novedad:** sesiones por tiempo con duración exacta, personajes y vistas múltiples. Contenido propio que no depende de cámara.
- **Competidores en español** que vi en una búsqueda (no los evalué a fondo): My Kettlebell Workout (app), La Forja de Bells and Gains (suscripción), Efecto Kettlebell (programa escrito), KETLFIT (en inglés).

### 1.5 Huecos

| Hueco | Evidencia [OBSERVADO] | Cura |
|---|---|---|
| Los **escudos no se ven** | En Hoy, Progreso, Metas, Perfil y el cierre solo aparece la llama y el número de racha. `finishSession` recibe `usedShield` de `updateStreak` y lo ignora. | B3 |
| Racha cae a 0 sin ritual de regreso | `liveStreak` devuelve 0; solo hay una nota pequeña de "Volviste tras unos días". | B10 |
| Mazo sin total ni "carta nueva" | `Progreso` lista cartas jugadas con `×n` y dice "Cada día puede traer una nueva". | B11 |
| La **tarjeta tiene el enlace en zona tapada** | `shareCard.ts`: marca a y=150, rango/lema/host a y=1700/1790/1850. Los márgenes de historias (§3.2) son ~250 px arriba y 250–340 px abajo. | B5 |
| **El texto compartido no lleva URL** | `Día N en kettellbro: TÍTULO` sin enlace. Con archivos adjuntos muchos destinos descartan el texto. | B5 |
| No se distingue compartir de cancelar | `shareOrDownload` devuelve `"shared"` también en `AbortError`, así que ni se cuenta bien ni se puede iterar. | B5 |
| La tarjeta no celebra la ¡LOTERÍA! | `ShareCardData` no incluye `weekDone`. | B5 |
| Invitar está enterrado | Solo en Perfil (4.ª pestaña). Sin atribución ni recompensa. Y dice "Entrenar acompañado engancha más", **afirmación sin respaldo que no he podido verificar**. | B12 |
| Sin recordatorios, sin guía de instalación, sin analítica | No hay handler `beforeinstallprompt`, no hay `push` en `public/sw.js`, no hay `sitemap.ts` ni analítica (no los encontré en los archivos revisados). | B2, B7, B9 |
| **"¡Lotería!" no significa lo mismo** en el cierre y en la meta | El cierre dispara con `dayIndex % 7 === 0` (cartas del programa, sin importar días naturales). La meta `streak-7` dice "7 días seguidos. ¡Lotería!". | Copy: compartir "7 cartas, una fila completa", **nunca** "7 días seguidos". |
| **"Lotería" en España** | [HIPÓTESIS] puede evocar los sorteos del Estado y no solo el juego de cartas mexicano; los frijoles también remiten a México. Mitigación honesta: aquí **no hay azar**, tu carta sale de tu plan. | E10 |
| **Representación de los personajes** | [HIPÓTESIS] dos personajes cubren pocos tipos de cuerpo y de piel. `PRODUCT.md` pide inclusión y lenguaje neutral en género. Presentarlos como "quién te acompaña" (instructores), no como "tu avatar", y planificar variantes. | §2.9, E10 |
| Los datos de contacto y la privacidad no están a la vista | No encontré política de privacidad, términos ni vía de borrado (el doc admite que el cliente no puede borrar el historial). | §1.6 |

### 1.6 Techo técnico y legal antes de crecer

- **Cuota de Firestore.** El propio doc estima ~1.500 arranques/día o ~400 usuarios activos/día en el plan gratuito. Son estimaciones sin medir (`ARQUITECTURA` §9). Antes de una campaña: alertas de presupuesto en Google Cloud y decidir si pasar a Blaze.
  - Cloud Functions exige Blaze. [VERIFICADO: [Firebase](https://firebase.google.com/docs/functions/get-started)]
  - Palancas ya identificadas por el doc: guardar `completedGoalIds` dentro de `meta/program` (una lectura menos por meta) y mantener los borradores limitados.
- **App Check.** El doc lo sugiere "más adelante"; es sensato activarlo antes de tráfico masivo.
- **Privacidad y datos de salud.** La app recoge un cribado de salud, peso y estatura. [HIPÓTESIS, no es asesoría legal] Estos datos suelen tratarse con más cuidado (en el RGPD los datos de salud son una categoría especial). Antes de captar usuarios de España: política de privacidad, términos y proceso de borrado/exportación. Consulta con un abogado.
- **Duración exacta:** antes de usar "10 minutos exactos" en la portada, el motor debe tener una prueba que verifique que la suma de pasos es igual a `minutes × 60` (hoy el doc de pruebas habla de ±35 %). Si no es cierto, la promesa es publicidad engañosa.

---

## 2. Bucles de retención (con la mecánica ya existente)

### 2.0 Reglas éticas (aplican a todos los bucles)

1. **Sin culpa.** Ningún texto de pérdida ("no pierdas", "tu Bro está triste", "te extrañamos"). El Bro duerme o guiña, nunca llora.
2. **La salud manda sobre la racha.** El descanso cuenta. Hay "Pausa" y "Saltar" siempre a la vista. Nada empuja a entrenar con dolor, enfermo o lesionado. Se mantiene el aviso de salud de Perfil.
3. **Honestidad.** Los logros salen de datos reales (principio 5). No se infla el número de una tarjeta para que luzca mejor.
4. **Control del usuario.** Cada recordatorio o notificación se apaga en dos toques, sin pantallas de culpa ni cuentas atrás falsas.
5. **Topes de frecuencia.** Máximo un aviso al día y silencio automático (§2.2).
6. **Sin azar monetizable.** La carta es determinista; no hay cajas de recompensa.
7. **Competencia sana.** Nada de rankings por kilos (empuja a sobrecargar). Si hay comparación entre amigos, solo "cartas cerradas", con descansos contando.
8. **Guardrail de salud medible** (§5): la proporción de sesiones con sensación "Durísima" y de series saltadas no debe subir tras lanzar mecánicas de racha. Si sube, se revierte.

### 2.1 Evidencia que sí usamos (y sus límites)

- **Planes de "cuándo y dónde".** Un meta-análisis de intenciones de implementación (Gollwitzer y Sheeran 2006; 94 pruebas en 63 informes) halló un efecto medio de d = 0,65 sobre el logro de metas ([resumen](https://stafforini.com/works/gollwitzer-2006-implementation-intentions-and/)). Es general, **no específico de ejercicio ni de pesa rusa**; d no es un porcentaje.
  - Uso: pedir al usuario que elija hora y días, no un recordatorio genérico.
- **Formación de hábito.** Lally et al. 2010: mediana de 66 días, rango 18–254 ([resumen](https://bps.org.uk/research-digest/how-form-habit)). Solo 39 participantes ajustaron bien el modelo y la automaticidad se midió por autoinforme.
  - Uso: no prometer "hábito en 30 días". Consistente con `BASE-CIENTIFICA` §4: la ciencia respalda 3 sesiones por semana durante 4 semanas o más, no un reto de 30 días seguidos.
- **Gamificación.** Mazeas et al. 2022, revisión sistemática y meta-análisis de ensayos aleatorizados: prometedora para la actividad física, con efecto que parece de corta duración y volátil a largo plazo ([JMIR](https://jmir.org/2022/1/e26779)).
  - Uso: no apostar todo a la racha. Ofrecer relevo hacia motivación intrínseca: progresión de pesas, técnica, ciencia visible.
- **Un ejemplo de otra empresa.** En una prueba A/B, Duolingo reportó que quienes tuvieron el "Weekend Amulet" volvían 4 % más una semana después y perdían su racha 5 % menos; su lectura fue que dar la opción de pausar lleva a hacer más a largo plazo ([blog de Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals)). Son datos de **sus** usuarios; no se extrapolan a kettellbro. Sirve como respaldo cualitativo del diseño con escudo.

### 2.2 Recordatorios (hora y días elegidos por el usuario)

| | |
|---|---|
| **Disparador** | Hora y días que el usuario elige al cerrar su primera sesión ("¿A qué hora entrenas mañana?"). No se pide al instalar ni antes de haber entrenado. |
| **Acción** | Abrir la app y tocar Empezar. |
| **Recompensa** | Ver la carta del día. El texto adelanta el nombre y la duración, no una amenaza: "Hoy: EL GRANJERO · 15 min". |
| **Cómo funciona, fase A (sin backend)** | Evento de calendario descargable (archivo .ics) con la **duración exacta** de la sesión elegida y alarma. Detalle y límites en B7 y §4.3. |
| **Fase B (backend nuevo)** | Web Push opt-in (§4.3). Reglas: máximo un aviso por día; no avisar si ya entrenó hoy; tras 3 avisos sin abrir, parar y enviar uno final: "Pausamos los avisos. Los reactivas en Perfil."; botones "Hoy no puedo" (silencia el día) y "Pausar 7 días". |
| **Textos** | "Hoy te toca el Día {N}: {CARTA}. {min} minutos." · Día de recuperación: "Hoy toca recuperación. Puedes descansar del todo: también cuenta." |
| **Riesgos éticos** | Fatiga de avisos; presión en días de enfermedad o dolor; mensajes de pérdida. Salvaguardas: tope, pausa fácil, silencio automático, prohibido cualquier texto de pérdida o de culpa. |

### 2.3 Racha y escudos

| | |
|---|---|
| **Disparador** | El cambio de día: entrenar, o marcar descanso en los días de recuperación (`restDayAllowed`). |
| **Acción** | Completar la carta o registrar el descanso. |
| **Recompensa** | La llama crece; cada 7 de racha llega un escudo (máx. 2). Un escudo cubre **un** día perdido de forma automática. No cubre dos seguidos. (Regla real de `progression.ts`.) |
| **Qué añadir** | (1) Mostrar los escudos junto a la llama. (2) Avisar cuando se gana y cuando se usa. (3) Banner de "día en riesgo" sin culpa. (4) Pantalla de ayuda "¿Qué es un escudo?". (5) **Pausa de salud** (§2.9). Ver B3. |
| **Riesgos éticos** | Ansiedad por la racha y entrenar lesionado. Salvaguardas: el descanso cuenta, la mejor racha se conserva, y nada de apostar o pagar por salvar la racha. Con la racha en 0, se muestra "Nueva racha" junto a la mejor racha, no un cero vacío. |

### 2.4 Mazo coleccionable

| | |
|---|---|
| **Disparador** | Aparece un título de carta que nunca se jugó. |
| **Acción** | Entrenar. |
| **Recompensa** | Sello "¡CARTA NUEVA!" en el cierre y "k de M" en Progreso, con siluetas de las cartas aún no jugadas. |
| **Cómo funciona** | M se calcula con el motor (puro): títulos distintos que el usuario puede recibir en los próximos meses con **su nivel y su cuidado de espalda**. Con `deck: string[]` en `meta/program` se evita leer todo el historial (B11). La lotería tradicional tiene 54 cartas, según Vanguardia ([fuente](https://vanguardia.com.mx/noticias/la-chalupa-y-buenas-como-surgio-la-loteria-mexicana-y-sus-54-versos-para-cantarla-YG9190054)); el mazo de kettellbro no necesita igualarlo. `CANTOS` tiene 31 entradas (una es EL BRO); el número real sale del código. |
| **Riesgos éticos** | Perseguir cartas fuera del nivel o contra la seguridad. **Nunca mostrar siluetas de cartas que el usuario no puede recibir** (nivel o espalda baja). Si se cambia el nivel en Perfil solo para "desbloquear", el cribado y la rampa de principiantes deben seguir mandando. |

### 2.5 Semana ¡LOTERÍA! (ritual semanal)

| | |
|---|---|
| **Disparador** | Completar la carta 7, 14, 21… del programa (`dayIndex % 7 === 0`). |
| **Acción** | Cerrar la fila de la Tabla. |
| **Recompensa** | Sello ¡Lotería! (ya existe) más **resumen semanal compartible**: fila de 7 frijoles, series completas, minutos y cartas nuevas. Cosmético opcional: marco de caléndula por cada Lotería. |
| **Cómo funciona** | Variante "Lotería" de la tarjeta (B5), con datos de las últimas 7 sesiones (`listSessions`). |
| **Texto** | "¡LOTERÍA! 7 cartas, una fila completa." Evitar "7 días seguidos" (§1.5). |
| **Riesgos éticos** | Presión por cerrar la fila a toda costa. La fila no depende del calendario, así que perder un día no la rompe. |

### 2.6 Retos

- **Reto de la Tabla** (28 cartas = un mesociclo, 4 ¡Loterías!). Es el reencuadre honesto del "reto de 30 días" que traen los usuarios (`PRODUCT.md`), alineado con `BASE-CIENTIFICA` §4: 3 sesiones por semana por 4 semanas o más.
  - **Relevo:** al cerrar la Tabla 1, el Wrapped del mes y la Tabla 2 con el nuevo tema. Mazeas 2022 sugiere que el efecto de la gamificación decae; el relevo evita el "final de reto".
- **Retar a un bro** (§3.3): cerrar una fila en 10 días, con descansos contando. Los 10 días son una decisión de diseño, no un dato.
- **Riesgos:** comparación que se vuelve presión. Reglas: grupos pequeños, sin kilos, sin avisos tipo "tu amigo ya entrenó y tú no".

### 2.7 Regreso tras días sin entrenar

| | |
|---|---|
| **Disparador** | Al abrir tras 3 o más días sin sesión (`daysSinceLast`). Si hay Web Push: un aviso a los 3 días, otro a los 7, uno a los 21 y silencio. |
| **Acción** | Tocar "Empezar" o "Solo 10 minutos". |
| **Recompensa** | Bro con guiño, "Tu Día {N}, tu mazo y tus frijoles siguen aquí" y volumen reducido (`reentry`, ya existe y se justifica con Mujika 2000 y Bosquet 2013). |
| **Seguridad** | Con 14 días o más, repetir las tres preguntas del cribado antes de Empezar. |
| **Riesgos éticos** | Culpa. Prohibido "Tu Bro te extraña". Se mantiene el tono "cuando quieras". |

### 2.8 "Solo 10 minutos" (día difícil)

- **Disparador:** poca energía o poco tiempo. **Acción:** elegir 10 min para hoy. **Recompensa:** la carta cuenta completa, con su frijol.
- Como la duración es exacta, la promesa es creíble. Es el reflejo de la evidencia de que volumen bajo ya da ganancias (Androulakis 2020, en `BASE-CIENTIFICA`).
- Esa sesión no progresa la carga (como en `reentry`); se requiere cambio de motor (B10).
- **Riesgo:** quedarse siempre en 10. Se mide (§5) y no se castiga.

### 2.9 Pausa de salud

- Disparador: enfermedad, viaje o lesión. El usuario activa "Pausa" hasta N días; la racha no se rompe y no hay avisos.
- Campo nuevo `pausedUntil` en `meta/program` (sin colección nueva).
- Es una salvaguarda ética y una decisión de retención: evita que un resfriado destruya una racha larga y empuje a entrenar enfermo.
- Texto: "Pausa activada hasta el {fecha}. Tu racha y tu tabla te esperan."

---

## 3. Bucles virales y de adquisición

### 3.1 Cómo medir el bucle (sin inventar K)

K = invitaciones por usuario × conversión de cada invitación. **No tengo datos para estimarlo.** Primero se instrumenta (§5); después se decide. No hay objetivo de K en este documento.

### 3.2 Tarjeta compartible: auditoría y diseño v2

**Márgenes de historias.** No encontré una página oficial de Meta con la zona segura de historias. Las fuentes de la industria coinciden en ~250 px arriba (perfil y cerrar) y dan 250 o 340 px abajo ([Inro](https://www.inro.social/blog/instagram-story-size), [Make Tech Easier](https://maketecheasier.com/instagram-story-reel-safe-zone)). La cifra de 340 px se atribuye a la guía de anuncios de Meta, pero no pude confirmarla en su Centro de Ayuda. **Es una convención, no una especificación.** Usa 340 px abajo como objetivo prudente.

**Auditoría de `src/lib/shareCard.ts` (1080×1920).**

| Elemento | Hoy | Problema | Cambio |
|---|---|---|---|
| Marca | y=150 | Cae en la franja superior tapada | Mover a la banda inferior o dentro de la carta; dejar la franja superior solo con rayos decorativos |
| Carta | y=230–1310, 760 px de ancho | Ocupa la franja superior | Carta de ~720×1010 entre y≈270 y y≈1280 |
| Estadísticas | y=1500–1556 | Dentro de la zona segura, pero hay que subirlas al reducir la carta | Fila de datos entre y≈1330 y y≈1440 |
| Rango | y=1700 | Zona tapada | Quitar o integrar al banner |
| Lema | y=1790: "Una carta nueva cada día · entrena con ciencia" | Genérico y tapado | Sustituir por el gancho (abajo) |
| Host | y=1850, 36 px al 70 % de opacidad | **La llamada a la acción está tapada y es ilegible** | CTA en una pastilla de papel entre y≈1470 y 1560 |
| Texto de `share` | Sin URL | Se pierde en destinos que descartan texto | URL con UTM dentro del texto, y también visible en la imagen |

**Reglas de contenido de la tarjeta.**
- **Tercera estadística.** En vez de "kg movidos" (ahora estimado por cadencia, §1.2 F6), usa **"series completas {a}/{b}"** con racha y minutos. Los kg, si se muestran, como "≈ {kg} kg según tu plan" en letra pequeña.
- **Personaje.** La figura de la carta es el personaje elegido en vista 3/4. El SVG se exporta con `XMLSerializer` y se dibuja como imagen, así que **el arte nuevo debe usar colores hex en línea, sin `var()` ni fuentes externas ni referencias externas** (como el código ya exige para la figura actual).
- **Variantes:** normal, ¡LOTERÍA!, carta nueva, y "teaser" antes de entrenar.
- **Nunca** aparecen calorías, cuerpo, ni correo. Alias opcional.

**Ganchos (texto exacto en español neutro, tuteo).**

| Situación | Texto sobre la imagen | Texto de compartir |
|---|---|---|
| Normal | "Día {N} · {CARTA}" y pastilla "¿Qué carta te toca a ti?" | "Día {N} en kettellbro: {CARTA}. ¿Qué carta te toca a ti? {url}" |
| Lotería | "¡LOTERÍA!" y "7 cartas. Una fila completa." | "¡LOTERÍA en kettellbro! Cerré una fila de 7 cartas. {url}" |
| Carta nueva | "Carta nueva: {CARTA}" y "{k} de {M} en mi mazo" | "Nueva carta en mi mazo: {CARTA} ({k} de {M}). {url}" |
| Teaser | "Hoy me toca {CARTA}" y "{min} minutos" | "Hoy me toca {CARTA}, {min} minutos. ¿Y a ti? {url}" |
| Reto | "Te reto: cierra una fila" | "Te reto a cerrar una fila de tu tabla en 10 días. Los descansos cuentan. {url}" |

Notas:
- `{url}` = `https://kettellbro.vercel.app/?utm_source=share-card&utm_medium={tipo}`.
- La palabra "minutos" en el teaser es verdad solo si la duración exacta está probada (§1.6).

**Formatos.**
- **1080×1920** (historias, Reels, Estados): el actual, rehecho.
- **1200×630** (vista previa de enlaces): ver abajo.
- **Opcional:** 4:5 (1080×1350) para feed. Es una práctica común, pero no la verifiqué en una fuente oficial; pruébalo en la app.

**1200×630 (`src/app/opengraph-image.tsx`).**
- Hoy el titular mide 54 px y la descripción 31 px sobre un lienzo de 1200. En la miniatura de un chat eso se vuelve ilegible. [HIPÓTESIS, pégalo en WhatsApp y Telegram para comprobarlo.]
- Cambio: titular de al menos 64 px, dos líneas como máximo, un chip "10 a 25 min", los dos personajes junto a una carta. Gancho a probar: "¿Qué carta te toca hoy?"
- **Dinámico por carta o reto:** Next.js documenta que `opengraph-image` recibe `params` de segmentos dinámicos ([docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)); no encontré que reciba `searchParams`. Por eso usa **segmentos**, no query strings: `/carta/[slug]`, `/reto/[codigo]`. Verifica en la versión instalada (Next 16).
- Mantén el PNG ligero. Los límites de tamaño de `og:image` de WhatsApp [NO VERIFICADO]; prueba con el enlace real.

**Web Share con archivos.**
- web.dev lista soporte en Chrome 128, Edge 93 y Safari 12.1 y Firefox tras una bandera ([web.dev](https://web.dev/articles/files/share-files)); no confirmé Chrome en Android. El respaldo de descarga ya existe.
- Añade "Copiar enlace" como respaldo y corrige `AbortError`: debe devolver `"cancelled"`, no `"shared"`.
- Botón explícito de WhatsApp con `https://wa.me/?text=…` [NO VERIFICADO: no logré abrir la FAQ de WhatsApp; pruébalo]. Sirve para medir qué canal se usa, porque Web Share no dice a qué app se envió.

### 3.3 "Retar a un bro" por enlace

**Nivel 0, sin backend (primero).**
- Enlace `https://kettellbro.vercel.app/reto/{codigo}`. `codigo` = base64url de `{v:1, a: alias (≤16, solo texto), d: día, c: slug de carta, t: "fila"}`.
- Página pública `/reto/[codigo]` renderizada en servidor: "{alias} te reta a cerrar una fila (7 cartas) en 10 días. Los descansos cuentan." Botón "Aceptar el reto" que **guarda `kb:ref` en `localStorage` antes de abrir Google**, porque la redirección descarga la página (§1.2 F2).
- Tras la primera sesión, `Celebration` muestra "Reto aceptado: {alias} te retó. Vas {x}/7".
- OG dinámico por segmento (§3.2).
- Seguridad y privacidad:
  - El enlace es falsificable, así que **no otorga nada de valor**; solo texto y un frijol cosmético.
  - El alias se muestra como texto plano, con límite de longitud y filtrado.
  - Sin correo, sin foto, sin nombre completo.
  - Sin analítica del payload: en Vercel Web Analytics redáctalo con `beforeSend` ([docs](https://vercel.com/docs/analytics/privacy-policy)) para que quede `/reto/[codigo]`.
- Límite: nadie ve el progreso del otro. Es un reto "por honor" con tarjeta compartible al terminar.

**Nivel 1, con Firestore (BACKEND NUEVO: colección y reglas).**
- Colección `retos/{retoId}` con ID aleatorio (la capacidad es el enlace):
  `{ creadoPor, creadoEn, tipo: "fila", meta: 7, venceEn, miembros: { [uid]: { alias, avance, actualizadoEn } } }`
- **Boceto de reglas (no probado):**
  - `read`: solo si `request.auth.uid in resource.data.miembros.keys()`.
  - `create`: `creadoPor == auth.uid` y `miembros` con una sola entrada, la propia.
  - `update`: solo cambia `miembros`; puede unirse quien aún no está (tope de 5 miembros) o actualizar **su propia** entrada con `avance` monótono ≤ `meta`.
  - Sin borrado desde el cliente.
- Pruébalo con el emulador (el repositorio ya trae `scripts/test-firestore-rules.mjs`).
- Sin `onSnapshot`: una lectura al abrir la pantalla de retos, más recarga manual, para cuidar la cuota.
- Se muestra solo alias y frijoles. Sin kilos ni racha.
- Para borrar a un usuario (RGPD) hay que quitar su entrada de los retos: entra en el proceso de borrado.

**Atribución de invitaciones (BACKEND NUEVO: reglas).**
- `users/{uid}.referredBy` inmutable tras crear, y contador opcional `invitesSent` en `meta/program`.
- Las recompensas del invitador deben ser cosméticas (un frijol dorado) para que no valga la pena manipularlas.
- El conteo se hace con un script local del Admin SDK (§5), sin Cloud Functions.

### 3.4 Diez ideas de video (TikTok / Reels / Shorts)

Reglas de producción: usar el arte propio (personajes, vistas lado/frente/3-4, cartas) con grabación de pantalla; sin cámara obligatoria. Sin cifras de calorías ni promesas de cuerpo. Los enlaces en bio llevan `utm_source=tiktok|instagram|youtube`. **Antes de grabar, resuelve B1:** el enlace en bio abre un navegador integrado.

| # | Título | Guion corto (≤30 s) |
|---|---|---|
| 1 | **El reparto** | Gancho: "Mi entrenador es una lotería… sin azar." La carta del día se reparte con animación. Texto en pantalla: el nombre y los minutos. Se ve el canto (verso). Cierre: "Mañana, otra carta." |
| 2 | **28 cartas, 4 loterías** | Timelapse de la Tabla llenándose de frijoles. Sonido de sello en cada fila. Cierre: "Un mes en una tabla." |
| 3 | **Manos libres** | Teléfono apoyado a metros. Se ve a la persona levantar y la app contar. Gancho: "Mi app no me pregunta ¿ya terminaste?" Cierre: "Tú levantas, la app cuenta." |
| 4 | **10 minutos son 10 minutos** | Cronómetro de 10:00 en pantalla dividida con la sesión. Termina justo en 0:00. **Solo si la duración exacta está probada** (§1.6). |
| 5 | **Mito o evidencia** | "¿La pesa rusa quema 1.200 kcal por hora?" Texto: "Lo que revisamos no lo respalda." Mostrar la cita. (`BASE-CIENTIFICA` §3.) Cierre: "Aquí cada rutina cita su estudio." |
| 6 | **La técnica en 3 ángulos** | El personaje hace el swing de frente, de lado y en 3/4. Texto: "La cadera dispara, los brazos solo guían." Serie: una carta por video. |
| 7 | **El cantor** | Voz en off con el verso de la carta, como el cantor de la lotería. Subtítulos. Serie "Canto del día". |
| 8 | **El test de la pesa correcta** | "10 swings: la última igual que la primera." Si el agarre falla o la espalda se redondea, una pesa menos. Cierre: "La app lo ajusta con tu esfuerzo." |
| 9 | **Misma app, otra carta** | Dos amigos enseñan su carta del mismo día. Invitación a dúos: "Enséñame la tuya." (Cada usuario tiene su rotación.) |
| 10 | **Fallé un día y mi racha sigue** | Se ve el escudo protegiendo el día perdido. Texto: "El descanso también cuenta." Requiere B3. |

Extra de baja inversión: pedir en comentarios que la comunidad bautice a los dos personajes, y usar los nombres ganadores en el siguiente video. Sirve para engagement y no cuesta nada.

### 3.5 Comunidades y nichos

- **Hallazgo honesto:** en una búsqueda no encontré una comunidad de pesa rusa en español en Reddit, Facebook ni Telegram. r/kettlebell existe pero es en inglés y el foro de StrongFirst pidió mantener la conversación en inglés. **No nombro grupos que no verifiqué.**
- **Cómo encontrarlas:** buscar a mano en Reddit, grupos de Facebook, Telegram y Discord por "pesa rusa", "kettlebell", "calistenia en casa", "entrenar en casa", "reto 30 días". Antes de publicar, registrar tamaño, actividad y reglas de cada una.
- **Cómo participar:**
  1. Aportar valor primero (la calculadora de pesa, guías de técnica, el mito de las calorías).
  2. Decir que eres el creador.
  3. Respetar las reglas de cada comunidad.
  4. No hacer spam.
- **Mensaje base (editar por comunidad):** "Armé una app gratuita para entrenar con pesa rusa..." — **solo si el dueño confirma que es gratuita**; hoy `PRODUCT.md` no define precio. Alternativa: "Armé una app de pesa rusa en español; cada rutina cita el estudio que la respalda. ¿Me ayudan a probarla?"
- **Nicho del "reto de 30 días":** es justo el público de `PRODUCT.md` ("vienen de un reto de 30 días"). Ofrecerles el "Reto de la Tabla" (28 cartas) como siguiente paso, con el reencuadre científico.

### 3.6 Alianzas con coaches

- **Oferta sin backend (fase 1):** el coach comparte su propio enlace de reto (`/reto/…` con su alias) y recibe una página `/c/{coach}` estática con su nombre. Atribución por `utm_source=coach-{slug}`.
- **Qué gana el coach:** una herramienta de seguimiento entre sesiones, con respaldo científico citado y rutinas que no tiene que armar. **No prometo ingresos ni comisiones.**
- **Piloto cualitativo:** 3 a 5 coaches, entrevistas, ver qué piden. Cualquier acuerdo comercial lo decide el dueño.
- **Fase 2 (BACKEND NUEVO, L):** panel de coach con acceso a datos de alumnos solo con consentimiento explícito. `ARQUITECTURA` §11 ya marca "entrenadores que ven a sus alumnos" como motivo para reconsiderar Supabase.
- No cito certificaciones concretas porque no las verifiqué.

### 3.7 SEO

**Realidad actual.** Un bot ve el splash y `/sitemap.xml` da 404 [OBSERVADO]. El SEO no empieza hasta que exista la portada pública (B4) y haya contenido real indexable.

**Observación de una sola búsqueda hoy** (no es medición de volumen ni de dificultad):
- "rutina de pesa rusa en casa para principiantes": mayormente tiendas y blogs de equipamiento, además de medios de salud.
- "reto 30 días pesa rusa kettlebell": no apareció un reto de 30 días específico de pesa rusa; sí tiendas y un reto semanal de un medio.
- "cómo hacer swing con pesa rusa": medios y guías, con pasos de técnica.

**Consultas candidatas** (volumen **no verificado**; validar con Search Console y con la planificación de palabras clave de Google antes de decidir):

| Intención | Consultas candidatas | Página |
|---|---|---|
| App / descubrir | "app de pesa rusa", "app kettlebell en español", "rutina de pesa rusa", "plan de entrenamiento con pesa rusa" | `/` (portada) |
| Principiante | "pesa rusa para principiantes", "rutina de pesa rusa en casa" | `/pesa-rusa-para-principiantes`, `/rutina-pesa-rusa-en-casa` |
| Elegir pesa | "qué peso de pesa rusa elegir", "cuántos kilos debe tener mi pesa rusa" | `/calculadora-pesa-rusa` (herramienta) |
| Técnica | "cómo hacer swing con pesa rusa", "sentadilla goblet", "levantada turca / turkish get-up", "peso muerto con pesa rusa", "press con pesa rusa" | `/ejercicios/[slug]` |
| Reto | "reto 30 días pesa rusa", "reto 28 días en casa" | `/reto-28-cartas-pesa-rusa` |
| Ciencia / mitos | "beneficios de la pesa rusa", "calorías pesa rusa", "pesa rusa vs correr" | `/ciencia/[tema]` |
| Marca | "kettellbro" | portada |

Notas:
- "Kettlebell" y "pesa rusa" conviven en español; mide cuál usan tus visitantes.
- No aplicar "tonificar" ni "quemar grasa".

**Páginas que hacen falta, por prioridad.**
1. **`/` portada** (B4), con SSR de verdad.
2. **`/calculadora-pesa-rusa`.** Usa `recommendBells` (motor puro) en el cliente, sin guardar datos. Cierra con "Guarda tu plan con Google". Debe decir que es una **heurística de coaching**, no un dato de estudio (`MOTOR` §5c).
3. **`/ejercicios/[slug]`**, empezando por las 6 a 8 de mayor intención (swing, goblet, get-up, peso muerto, press, clean, remo, acarreo). Datos reales de `exercises.ts` (indicaciones, error común, músculos, regresión y progresión, evidencia) **más** texto propio y las **tres vistas del personaje**. Un solo `EL SWING` cubre swing a dos manos y a una mano (comparten carta). **No publiques páginas finas.**
4. **`/ciencia`** y `/ciencia/[tema]`, con las citas verificadas y los límites honestos. Es el activo enlazable que otros no pueden copiar.
5. **`/reto-28-cartas-pesa-rusa`** con el reencuadre de `BASE-CIENTIFICA` §4.
6. **`/privacidad`, `/terminos`, `/sobre`.**

**Técnica.**
- `sitemap.ts`, y definir `NEXT_PUBLIC_SITE_URL` para que `robots` lo anuncie.
- Metadatos y canónica por página; `lang="es"` único (no dupliques por país).
- Registrar la propiedad en Google Search Console.
- JSON-LD (`SoftwareApplication` o `WebApplication`): sirve para claridad, pero **no esperes resultados enriquecidos**. Google limitó los de FAQ a sitios gubernamentales y de salud conocidos y los de HowTo a escritorio en agosto de 2023 ([Google Search Central](https://developers.google.com/search/blog/2023/08/howto-faq-changes)); reportes posteriores sobre su retirada total no los pude confirmar.
- **Rendimiento:** el layout raíz monta `AuthProvider` y `ProgramProvider` para todo. En páginas públicas conviene no cargar el SDK de Firebase hasta que el usuario toque "Continuar con Google" (importación dinámica o grupo de rutas sin proveedores). Verifícalo con Lighthouse.

---

## 4. Instalación de la PWA y recordatorios

### 4.1 Estado actual

- **Manifest** [OBSERVADO en producción]: nombre, `start_url: /hoy`, `display: standalone`, íconos 192/512/maskable, capturas y atajos.
- **Criterios de Chrome para disparar `beforeinstallprompt`** [VERIFICADO: [web.dev](https://web.dev/articles/install-criteria)]:
  - HTTPS.
  - Manifest con `name` o `short_name`, `icons` con 192 y 512 px, `start_url` y `display` válido.
  - `prefer_related_applications` ausente o falso.
  - El usuario debe haber hecho clic o toque al menos una vez y pasado 30 segundos en la página.
  - Otros navegadores tienen "criterios similares con diferencias menores".
  - La página no menciona un service worker.
- **Cumple todo lo anterior.** Además existe `public/sw.js` con manejador `fetch`, registrado solo en producción.
- **Lo que falta:** no encontré ningún componente que capture `beforeinstallprompt`, ni guía manual para iPhone. El service worker no tiene manejador `push`.

### 4.2 Cuándo y cómo pedir "Añadir a pantalla de inicio"

**Cuándo (ambas plataformas).**
- Nunca antes de la primera sesión completada. El mejor momento no es el cierre (ahí compite con Compartir) sino **la segunda apertura**, en Hoy.
- Condiciones: ≥1 sesión completada, ≥2 días distintos de apertura (contador funcional en `localStorage`), no instalada, no descartada en los últimos 14 días, máximo 3 veces en total.
- Se oculta con `display-mode: standalone`, con `navigator.standalone === true` y tras `appinstalled`.

**Android (Chrome).**
```ts
// módulo que se importa una sola vez; el evento llega antes de que cargue la UI
let deferred: BeforeInstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify(); });
window.addEventListener("appinstalled", () => { deferred = null; localStorage.setItem("kb:installed", "1"); notify(); });
export async function promptInstall() {
  if (!deferred) return "unavailable";
  await deferred.prompt();                // solo dentro de un clic del usuario
  const { outcome } = await deferred.userChoice;
  deferred = null;                        // no asumas que el evento volverá
  return outcome;
}
```
- Tarjeta propia en Hoy: título "Ten kettellbro en tu pantalla de inicio"; texto "Se abre a pantalla completa, sin la barra del navegador."; botones "Instalar" y "Ahora no".
- No prometas "más rápido" ni "sin conexión total": no lo medí.

**iPhone (no existe `beforeinstallprompt`; es manual).**
- Detección: Safari de iOS, no standalone. Si es un navegador integrado, primero "Ábrelo en Safari" (B1).
- Hoja "Instalar en tu iPhone":
  1. "Toca Compartir. En iOS 26 puede estar detrás del menú de tres puntos."
  2. "Elige «Agregar a pantalla de inicio»" (en España: «Añadir a pantalla de inicio»).
  3. "Deja activado «Abrir como app web» y toca Agregar."
- El interruptor "Abrir como app web" y el cambio de iOS 26 (cualquier sitio añadido se abre como app web salvo que lo desactives) están en fuentes secundarias que citan al blog de WebKit ([iThinkDiff](https://www.ithinkdiff.com/add-web-app-bookmark-iphone-home-screen-ios-26/), [heise](https://heise.de/-10749652)). No encontré la página oficial de Apple Soporte; verifica los textos en un iPhone real y ajusta.
- Tras instalar, **puede pedir login otra vez** (§1.2 F2).

### 4.3 Recordatorios: qué es viable y qué no

| Opción | Android (Chrome) | iPhone | Backend | Veredicto |
|---|---|---|---|---|
| **Evento de calendario (.ics) o enlace a Google Calendar** | Sin permisos | Sin permisos | No | **Hacer ya** (B7). Probar la descarga del archivo desde la app instalada en iPhone [NO VERIFICADO]. |
| **Web Push** (Push API + Notifications + service worker) | Sí, estándar [la guía de FCM exige un navegador con Push API](https://firebase.google.com/docs/cloud-messaging/js/client) | Sí, desde iOS/iPadOS 16.4, **solo para web apps añadidas a la pantalla de inicio**; el permiso solo se puede pedir tras una acción directa del usuario; el manifest debe tener `display: standalone` o `fullscreen`; la entrega es por APNs [VERIFICADO: [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Firebase](https://firebase.blog/posts/2023/08/fcm-for-safari)] | **Sí** | Fase 2 (BE1). |
| **Programar notificaciones desde el cliente (Notification Triggers)** | No viable | No | n/a | **Descartada.** Chrome indica que el desarrollo de la API terminó ([Chrome](https://developer.chrome.com/docs/web-platform/notification-triggers)). |
| **Correo** | n/a | n/a | Sí (proveedor, baja, consentimiento) | Aplazar; el correo de Google no equivale a consentimiento de marketing. |
| **Avisos solo con la app abierta** | Sí | Sí | No | No reactivan a nadie. |

**Qué exige Web Push (BE1).**
1. Manejador `push` y `notificationclick` en `public/sw.js` (hoy no existe).
2. Un servicio de envío. FCM trabaja con Push API; en iOS solo con la app instalada.
3. Guardar el token del dispositivo (`users/{uid}/devices/{id}` con token, zona horaria y hora elegida).
4. Un programador para enviar a la hora local de cada usuario:
   - Cloud Functions programadas exigen Blaze y Cloud Scheduler cobra por tarea después de las tres gratuitas ([Firebase](https://firebase.google.com/docs/functions/schedule-functions)).
   - Vercel Cron en Hobby solo corre **una vez al día con precisión de ±59 min**; en Pro, una vez por minuto ([Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing)). **Para "a la hora que tú eliges" necesitas Pro o Blaze.**
5. Pre-permiso propio: "¿Quieres un aviso a las 7:00?" y solo si dice que sí se llama `Notification.requestPermission()` dentro del toque. Si lo deniega, no se vuelve a pedir; se explica cómo reactivarlo.
6. Limpieza de tokens inválidos, topes (§2.2) y baja inmediata.
7. Hay reportes de proveedores sobre intermitencias de las notificaciones web en iOS [NO VERIFICADO]. Nunca dependas de ellas para algo crítico.

---

## 5. Métricas

### 5.1 Métrica estrella

**Bros activos de 3 (BA3):** usuarios con **al menos 3 sesiones completadas (sin contar descansos) en fechas locales distintas dentro de los últimos 7 días.**

- **Por qué:** el umbral de 3 por semana es una decisión de producto alineada con `BASE-CIENTIFICA` §4 (la ciencia respalda 3 sesiones por semana durante 4 semanas o más). No es un resultado de investigación sobre hábito.
- **Límite:** infravalora a quien entrena 2 veces por semana, que según la literatura que citas (Androulakis 2020) también obtiene ganancias. Registra **BA2** como secundaria y revisa el umbral una vez; no lo muevas cada semana.
- **Contraejemplo de vanidad que se evita:** "usuarios que abren la app".

### 5.2 Embudo y definiciones exactas

| Etapa | Definición | Fuente |
|---|---|---|
| Visita | Vistas de `/` (portada o login) | Vercel Web Analytics |
| Clic en entrar | Botón "Continuar con Google" | Evento (requiere Pro) o aproximación por rutas |
| Login | Documento `users/{uid}` creado | Firestore (`createdAt`) |
| Onboarding terminado | `meta/settings.onboardedAt` presente | Firestore |
| Primera sesión iniciada | Existe `meta/draft` o sesión con `startedAt` | Firestore |
| Primera sesión completada | `meta/program.totals.sessions ≥ 1` | Firestore |
| D7 | ≥1 sesión completada con fecha entre los días 6 y 8 desde `createdAt` | Firestore |
| D30 | ≥1 sesión completada entre los días 28 y 32 | Firestore |
| BA3 / BA2 | Definición de §5.1 | Firestore |

Lo que más cuesta, ya medible: **usuarios con `createdAt` pero sin `onboardedAt`** son quienes entraron con Google y abandonaron el onboarding (`resume()` los crea antes).

### 5.3 Eventos a medir

| Grupo | Evento | Propiedades permitidas |
|---|---|---|
| Entrada | `landing_view`, `cta_login_click`, `login_error` | código de error de Firebase (sin texto libre), tipo de entorno (navegador integrado sí/no) |
| Onboarding | `onb_step_view`, `onb_done` | número de paso |
| Activación | `session_start`, `session_complete`, `session_exit_early`, `wake_lock_failed`, `audio_test_played` | fase de sesión, duración elegida |
| Retención | `shield_earned`, `shield_used`, `return_after_lapse` | días de ausencia en tramos |
| Social | `share_open`, `share_completed`, `share_cancelled`, `invite_created`, `invite_landing_view`, `invite_accept` | tipo de tarjeta, canal (WhatsApp/copiar) |
| PWA | `install_prompt_shown`, `install_accepted`, `install_dismissed`, `appinstalled`, `ios_install_sheet_view` | plataforma |
| Avisos | `reminder_ics_downloaded`, `push_preprompt_view`, `push_granted`, `push_denied` | hora elegida en tramos |

### 5.4 Cómo medir respetando la privacidad

**Tres capas, de menos a más intrusiva.**

1. **Vercel Web Analytics** para páginas públicas y rutas. Sin cookies de terceros: el visitante se identifica con un hash de la petición que se descarta a las 24 horas, y los datos son agregados ([Vercel](https://vercel.com/docs/analytics/privacy-policy)). **Los eventos personalizados solo están en los planes Pro y Enterprise** ([Vercel](https://vercel.com/docs/analytics/custom-events)). Con el plan gratuito sí tienes vistas por ruta: `/` → `/bienvenida` → `/hoy` → `/sesion` ya describe buena parte del embudo. Redacta las URLs con datos personales con `beforeSend`.
2. **Script de cohortes sobre datos que ya guardas** (Admin SDK, local, solo conteos de salida). Entrega registros nuevos, abandono de onboarding, primera sesión, D7, D30, BA3 y BA2 sin instalar ningún SDK de seguimiento. Las credenciales del Admin SDK **no van al repositorio**. Cuidado con las lecturas: cuentan contra la cuota.
3. **Opcional, si Pro no es viable:** analítica propia y sin cookies. Plausible y Umami se describen como sin cookies; las fuentes que vi se contradicen sobre si Umami incluye embudos y Plausible podría reservarlos a su plan Business ([comparativa](https://www.pkgpulse.com/guides/vercel-analytics-vs-plausible-vs-umami-privacy-first-2026), fuente secundaria). **Verifica en sus páginas oficiales antes de decidir.**

**Qué NO recoger, nunca.**
- Correo, nombre, foto o `uid` en herramientas de analítica.
- Peso, estatura, pesajes, pesa de referencia.
- Respuestas del cribado de salud (dolor de pecho, indicación médica, espalda baja).
- RPE, sensación y notas por usuario fuera de Firestore.
- Reproducciones de sesión o mapas de calor (capturarían datos del cuerpo y de salud).
- Píxeles publicitarios (Meta, TikTok) dentro de la app.
- Huellas digitales del dispositivo, IP, o texto libre.
- El alias de los enlaces de reto.

**Segmentos permitidos:** país (Vercel lo da agregado), tipo de dispositivo, standalone sí/no, `utm_source`/`utm_medium`.

**Aviso legal.** [HIPÓTESIS, no es asesoría] Si añades cualquier almacenamiento o cookies no esenciales, en España y la UE puede hacer falta consentimiento. Consúltalo.

### 5.5 Guardrails de salud (revisión semanal)

- Porcentaje de sesiones con sensación "Durísima" (`feel = 3`) y RPE ≥9.
- Series saltadas por sesión y sesiones terminadas antes de tiempo. **No son fracaso**; son una señal de que la prescripción o el ritmo no encajan.
- Porcentaje de usuarios que pasan de 6 sesiones por semana.
- Porcentaje de usuarios que desactivan avisos.
- Si se lanzan mecánicas de racha y esos números empeoran, se revierte.

### 5.6 Cómo experimentar con poco tráfico

- Con pocos usuarios, una prueba A/B no tiene potencia. No declares ganador por una diferencia pequeña.
- Antes de cada prueba: hipótesis, métrica principal, guardrail y duración mínima de dos semanas completas.
- Reparto estable por usuario con el hash del `uid` (sin rastreo); guarda la variante en `meta/settings.exp` y compara con el script de cohortes.
- Para la portada pública: dos titulares en secuencia y no en paralelo, o una ruta por variante, y comparar sesiones por ruta.
- Complementa con 5 a 8 entrevistas por hallazgo grande (por ejemplo, "Lotería" en España).

---

## 6. Experimentos priorizados

**Cómo leer.** El impacto esperado es mi juicio (alto, medio, bajo), no una medición. "BE" indica backend nuevo. Cada experimento enlaza a su ítem del backlog (§7) cuando existe.

### 0 a 30 días: abrir las fugas

| ID | Hipótesis | Cambio | Métrica de éxito | Guardrail | Esfuerzo |
|---|---|---|---|---|---|
| E00 | (Prerrequisito, no experimento.) El login funciona de punta a punta. | Probar en iPhone/Safari, iPhone con PWA instalada, Android/Chrome, Android con PWA instalada y desde navegadores integrados de Instagram/TikTok/Facebook. Confirmar consentimiento "En producción" y dominio autorizado. | Los cinco entornos terminan en `/bienvenida` o `/hoy` | n/a | S |
| E01 | Si medimos, podemos iterar. | B2 | Embudo visible por rutas y cohortes por script | Ninguna cookie nueva | S |
| E02 | Si detectamos navegadores integrados y explicamos cómo abrirlos, más visitas de redes sociales llegan al login, porque Google bloquea OAuth en webviews. | B1 | Razón de visitas a `/bienvenida` entre visitas a `/` para tráfico con `utm_source` social, antes y después | Clics en "Intentar de todos modos" que fallan | S |
| E03 | Si el onboarding pasa de 7 a 4 o 5 pantallas, más usuarios empiezan su primera sesión, porque se retrasa lo opcional hasta después del éxito. | B8 (con y sin pantalla de personaje) | Usuarios que visitan `/sesion` entre los que visitan `/bienvenida` | Cambios de pesa de referencia en las primeras 3 sesiones; "Durísima" en sesiones 1 a 3 | M |
| E04 | Una portada pública con contenido real genera visitas orgánicas y más inicios de login. | B4 | Impresiones y clics en Search Console; visitas orgánicas a `/` | Rendimiento (LCP) | M |
| E05 | Con URL visible en zona segura y gancho, la tarjeta trae más visitas. | B5 | Visitas a `/` con `utm_source=share-card` por tarjeta compartida | Tarjetas "canceladas" | M |
| E06 | Si el usuario ve su escudo, vuelve tras un día perdido en vez de abandonar. | B3 | Porcentaje que entrena dentro de las 24 h siguientes a un día perdido con escudo disponible, antes y después | "Durísima" no sube | S |
| E07 | Instalar tras la primera sesión mejora la retención de quienes lo hacen. | B9 | Tasa de aceptación; D7 de instalados frente al grupo de control (50 % con hash de `uid`) | Instalados se autoseleccionan: no atribuir causalidad sin el grupo de control | M |
| E08 | Pedir hora y ofrecer recordatorio de calendario tras la sesión 1 aumenta la sesión 2. | B7 | Porcentaje con ≥1 sesión en los días 2 y 3 | Descargas que nunca se abren | S |
| E09 | Una prueba de sonido y un aviso de pantalla reducen abandonos de la primera sesión. | B6 | Sesiones completadas entre iniciadas (sesiones 1 a 3) | Tiempo hasta `session_start` | S |
| E10 | "Lotería" y los frijoles se leen distinto en España que en LatAm. | Variante de titular sin la palabra en la portada para `country=ES`, más entrevistas | Entrevistas cualitativas; clics en el CTA por país | Sin cifras prometidas | S |

### 31 a 60 días: retención y contenido

| ID | Hipótesis | Cambio | Métrica | Guardrail | Esfuerzo |
|---|---|---|---|---|---|
| E11 | Ver el mazo "k de M" y la "carta nueva" sostiene la constancia de quienes entrenan 2 o 3 veces por semana. | B11 | Paso de BA2 a BA3 en la cohorte | Cambios de nivel en Perfil sin cribado (posible manipulación para desbloquear cartas) | M |
| E12 | El resumen de ¡LOTERÍA! semanal se comparte más que la tarjeta diaria. | B5 (variante) | Compartidos por Lotería; visitas con `utm_medium=loteria` | Cancelados | M |
| E13 | Un regreso sin culpa y "Solo 10 minutos" recuperan a quienes pararon 3 días o más. | B10 | Porcentaje con sesión dentro de 48 h del reingreso | "Durísima" no sube | M |
| E14 | Retar a un bro por enlace (nivel 0) trae usuarios nuevos. | B12 | Visitas a `/reto/[codigo]` y logins; `invitesSent` por usuario activo | Quejas o abuso | M |
| E15 | Páginas SEO de alta intención (calculadora y 6 a 8 ejercicios) atraen visitas cualificadas. | §3.7 | Clics en Search Console; logins orgánicos | Contenido fino | M |
| E16 | Videos con la mecánica de cartas generan visitas que se convierten. | §3.4 | Logins con `utm_source` de la red | Tasa de rebote | M |
| E17 | Coaches locales traen alumnos que se quedan. | §3.6 piloto | Logins con `utm_source=coach-*`; entrevistas | n/a | M |
| E18 | Web Push opt-in mejora el retorno frente a calendario solamente. | BE1 | Aceptación del permiso; D7 frente al grupo de control | Desactivaciones; "Hoy no puedo" | L |

### 61 a 90 días: social y relevo

| ID | Hipótesis | Cambio | Métrica | Guardrail | Esfuerzo |
|---|---|---|---|---|---|
| E19 | Retos de 2 a 5 personas con progreso compartido (solo alias y frijoles) retienen mejor que el reto por honor. | BE2 | Retención de quienes están en un reto frente al resto | Presión social, quejas | L |
| E20 | El "Reto de la Tabla" con relevo a la Tabla 2 reduce el abandono al terminar el mes. | §2.6 | Porcentaje que empieza la Tabla 2 | "Durísima" | M |
| E21 | La pausa de salud evita que un resfriado rompa a un usuario largo. | §2.9 | Retorno tras pausa | Uso excesivo de la pausa | M |
| E22 | Google One Tap reduce toques de login en Android. | §1.3-C (factibilidad no verificada) | Éxito de login / clics en entrar | Errores de login | M |
| E23 | La atribución de invitaciones con recompensa cosmética aumenta invitaciones enviadas. | BE3 | Invitaciones aceptadas por usuario activo | Abuso, manipulación de reglas | M |

**Criterio de decisión.** Un experimento "gana" solo si mejora su métrica principal **sin empeorar el guardrail** y se repite en una segunda cohorte. Con poco tráfico, aprende de forma cualitativa y no declares victoria por una diferencia pequeña.

---

## 7. Backlog implementable ya

Orden por impacto sobre esfuerzo (juicio mío). Todos van **sin backend nuevo**; los que añaden un campo a un documento existente lo indican y deben probarse con el emulador. La lista de backend nuevo viene al final.

### B1. Guardia de navegador integrado y errores de login claros
- **Impacto:** alto. **Esfuerzo:** S. **Backend nuevo:** No.
- **Dónde:** `src/components/screens/LoginScreen.tsx` y un helper nuevo `src/lib/inAppBrowser.ts`.
- **Qué hacer:**
  - Detectar navegadores integrados por el user agent. Heurística a validar en teléfonos reales [NO VERIFICADO]: `Instagram`, `FBAN`, `FBAV`, `FB_IAB`, `TikTok`, `musical_ly`, `BytedanceWebview`, `Snapchat`, `Line/`; en Android, WebView suele incluir `; wv)`.
  - Si se detecta, mostrar encima del botón una tarjeta (no bloquea el botón):
    - Título: "Abre kettellbro en tu navegador"
    - Texto: "Google no permite iniciar sesión dentro de este navegador integrado. Toca ••• o el menú y elige «Abrir en Safari» o «Abrir en Chrome»."
    - Botón principal: "Copiar enlace". Después: "Enlace copiado. Pégalo en Safari o Chrome."
    - Botón fantasma: "Intentar de todos modos".
  - El enlace copiado lleva `?utm_source=inapp`. No se guarda el user agent.
- **Aceptación:** solo aparece con user agent coincidente; no rompe el modo demo; el botón de Google sigue disponible; accesible (rol `note`, foco visible).
- **Medir:** `inapp_browser_shown`, `inapp_copy_link`.

### B2. Analítica mínima y respetuosa
- **Impacto:** alto (habilita todo lo demás). **Esfuerzo:** S. **Backend nuevo:** No.
- **Dónde:** `src/app/layout.tsx` (`@vercel/analytics`) y `scripts/cohortes.mjs` (nuevo).
- **Qué hacer:**
  - Añadir `<Analytics beforeSend={…}>` que reescriba `/reto/<código>` a `/reto/[codigo]` y borre los parámetros que no sean `utm_*`.
  - Escribir `scripts/cohortes.mjs` (Admin SDK, ejecución local, credenciales fuera del repo) que imprima **solo conteos**: registros por semana, con y sin `onboardedAt`, con primera sesión, D7, D30, BA3, BA2 y guardrails de §5.5. Sin exportar filas por usuario.
  - Crear `/privacidad` (parte de B4) describiendo qué se mide y qué no (§5.4).
- **Aceptación:** sin cookies nuevas; ninguna página envía correo, nombre ni `uid`; el script no escribe nada.
- **Nota:** los eventos personalizados requieren Pro. Con el plan gratuito, el embudo sale por rutas más el script.

### B3. Escudos visibles y mensajes de racha
- **Impacto:** alto. **Esfuerzo:** S. **Backend nuevo:** No.
- **Dónde:** `Hoy` (cabecera junto a la llama), `Celebration`, `Perfil`, `src/lib/engine/progression.ts` (devolver `usedShield` y `earnedShield` desde `finishSession` y `finishRestDay`), `Icon.tsx` (ícono de trazo `shield`; el diseño prohíbe emoji).
- **Comportamiento:**
  - Junto a la llama, mostrar el escudo con el número (0 a 2). Si hay 0, ícono apagado.
  - Cierre, escudo ganado: "Escudo ganado. Cubre un día perdido. Tienes {n} de 2."
  - Cierre, escudo usado: "Un escudo cubrió tu día de ayer. Tu racha sigue en {n}. Te quedan {m}."
  - Hoy, cuando `diff === 2` y hay escudo: "Ayer fue día libre. Si entrenas hoy, un escudo cubre ese día y tu racha sigue."
  - Hoy, sin escudo y racha en 0: "Empieza una racha nueva hoy. Tu mejor racha ({mejor}) y tu tabla siguen aquí."
  - Toque en el escudo abre una hoja "¿Qué es un escudo?": "Cada 7 días de racha ganas un escudo (máximo 2). Si un día no entrenas, un escudo cubre ese día de forma automática. No cubre dos días seguidos. El descanso también cuenta."
- **Aceptación:** los textos coinciden con la regla real de `updateStreak`; pruebas unitarias para ganar, usar y ganar-y-usar en la misma sesión.
- **Medir:** `shield_earned`, `shield_used`.

### B4. Portada pública con contenido real
- **Impacto:** alto. **Esfuerzo:** M. **Backend nuevo:** No.
- **Dónde:** `/` y rutas públicas nuevas, en un grupo de rutas sin `AuthProvider`/`ProgramProvider`; `sitemap.ts`; `robots.ts`; `/privacidad`, `/terminos`.
- **Estructura (renderizada en servidor):**
  1. **Cabecera:** logo y "Entrar".
  2. **Titular (probar A/B en secuencia):**
     - A: "Una carta nueva cada día."
     - B: "Pesa rusa en 10 a 25 minutos. Tú levantas, la app cuenta."
  3. **Subtítulo:** "Rutinas con respaldo científico que te guían serie por serie, con cuenta atrás y voz. No tienes que marcar nada: la app cuenta por ti." (El segundo enunciado depende de la fusión del cambio de producto.)
  4. **CTA principal:** "Continuar con Google". Microtexto: "Solo con Google: tu historial viaja contigo a cualquier teléfono. Después, {n} preguntas rápidas y tu primera carta." (`n` real.)
  5. **Cómo funciona en 3 pasos:** "Elige tu tiempo" · "Recibe tu carta" · "Levanta: la app cuenta".
  6. **Vista previa:** bucle del personaje con cuenta atrás (el dueño decide §1.3-D) y las capturas ya existentes en `/screenshots`.
  7. **La Tabla, la Lotería y el mazo** en un solo visual.
  8. **Ciencia sin humo:** tres afirmaciones prudentes y "Lo que no prometemos: calorías garantizadas, «tonificar»". Enlace a `/ciencia`.
  9. **Preguntas frecuentes** con respuestas cortas y ciertas:
     - ¿Necesito experiencia? "No. Empiezas en nivel Novato: las dos primeras semanas no incluyen swings ni ejercicios balísticos."
     - ¿Qué pesa necesito? "Una sola sirve para empezar. Te sugerimos una según tu peso y estatura; es una guía de coaching, no una fórmula científica."
     - ¿Cuánto dura una sesión? "Tú eliges 10, 15, 20 o 25 minutos." (Añade "exactos" solo con la prueba de §1.6.)
     - ¿Es seguro? "Hacemos un cribado de salud al empezar y nunca te pedimos llegar al fallo. kettellbro no sustituye el consejo médico."
     - ¿Por qué solo con Google? "Para que tu historial viaje contigo sin crear otra contraseña."
     - ¿Qué datos guardan? (Completar con la política real de privacidad; no inventar.)
     - ¿Cuántas calorías quema? "No prometemos calorías. Explicamos lo que dice la evidencia." Enlace a `/ciencia`.
  10. **CTA final** y pie con Privacidad, Términos y el aviso de salud.
- **Reglas:**
  - **No mostrar testimonios ni cifras de usuarios**: `PRODUCT.md` dice que no existen.
  - **No decir "gratis"** hasta que el dueño defina el modelo.
  - En modo standalone (PWA instalada y sin sesión) debe verse el login actual, no la portada. Resolverlo con la media query CSS `display-mode: standalone` para ocultar secciones, con `navigator.standalone` como alternativa [probar en iPhone].
  - Importar el SDK de Firebase solo al tocar el botón.
  - Metadatos, canónica, Open Graph de §3.2 y JSON-LD `SoftwareApplication` (sin esperar resultados enriquecidos).
- **Aceptación:** el HTML de `/` contiene el texto de la portada sin JavaScript; `sitemap.xml` responde 200 y `robots.txt` lo declara; Lighthouse de SEO y accesibilidad sin errores graves.

### B5. Tarjeta compartible v2 (y Lotería semanal)
- **Impacto:** alto. **Esfuerzo:** M. **Backend nuevo:** No.
- **Dónde:** `src/lib/shareCard.ts`, `Celebration.tsx`, `Hoy` (botón de teaser) y `src/app/opengraph-image.tsx`.
- **1080×1920:** nueva composición de §3.2 (franja superior e inferior sin texto; carta ~720×1010 entre y≈270 y 1280; datos y≈1330–1440; pastilla CTA y≈1470–1560).
  - `ShareCardData` añade: `loteria: boolean`, `seriesDone`, `seriesTotal`, `deck?: {k, m, isNew}`, `character`, `url`.
  - Sustituir "kg movidos" por "series completas {a}/{b}".
  - Pastilla CTA: "Tu carta de hoy te espera en {host}".
- **Texto de compartir:** el de §3.2 con `{url}`. `shareOrDownload` devuelve `"shared" | "cancelled" | "downloaded"` (hoy `AbortError` cuenta como compartido).
- **Botones:**
  - `Celebration` conserva "Compartir"; si Web Share no admite archivos, ofrecer "Copiar enlace".
  - Botón de WhatsApp (`wa.me/?text=`) [probar].
- **Lotería (cierre con `weekDone`):** botón "Compartir mi Lotería" con la fila de 7 frijoles, series, minutos y cartas nuevas de la semana (`listSessions` de los últimos 14 días). Texto: "¡LOTERÍA! 7 cartas, una fila completa."
- **Teaser desde Hoy:** botón de ícono de compartir (44 px, esquina de la carta) con `aria-label="Compartir la carta de hoy"`. Imagen sin estadísticas.
- **Aceptación:** ningún texto crítico fuera de la zona segura; colores hex en el SVG del personaje; cancelar no cuenta como compartido; nunca aparecen correo ni nombre completo.
- **Medir:** `share_open`, `share_completed`, `share_cancelled`, visitas con `utm_source=share-card`.

### B6. Prueba de sonido y aviso de pantalla (sesiones manos libres)
- **Impacto:** medio-alto. **Esfuerzo:** S-M. **Backend nuevo:** No.
- **Dónde:** `Hoy` (hoja antes de Empezar), `SessionPlayer.tsx`, `src/lib/cues.ts`.
- **Comportamiento:**
  - En la primera sesión, y cuando antes falló el bloqueo de pantalla, mostrar una hoja "Sesión manos libres": "La app te cuenta cada serie. Apoya el teléfono a un par de metros y sube el volumen." Botones "Probar sonido" (suena `countBeep` y dice "Listo, bro") y "Empezar".
  - `keepAwake()` devuelve `{ release, ok }`. Si `ok` es falso, un aviso fijo en el player: "Tu pantalla puede apagarse. Pon el bloqueo automático en «Nunca» durante la sesión."
  - Texto de vibración en onboarding y Perfil: "La vibración depende de tu teléfono."
  - **Voz:** usar `es-ES` cuando el idioma del dispositivo lo sea (hoy `speak()` prefiere `es-MX`).
- **Aceptación:** no aparece tras la tercera sesión salvo fallo; funciona con `prefers-reduced-motion`; probado en iPhone en Safari y en PWA instalada.
- **Medir:** `audio_test_played`, `wake_lock_failed`.

### B7. Recordatorio por calendario tras la primera sesión
- **Impacto:** medio-alto. **Esfuerzo:** S-M. **Backend nuevo:** No.
- **Dónde:** `Hoy`, estado `doneToday` y primera sesión completada. Un módulo nuevo para generar el archivo.
- **Comportamiento:** tarjeta "Mañana, Día {N}: ponle hora." con chips de hora (6:00, 7:00, 12:00, 18:00, 20:00, "Otra"), días ("Todos los días" por defecto, "Lunes a viernes", "Elegir") y botón "Añadir a mi calendario".
  - Genera un `.ics` en el navegador: hora flotante local, `DURATION:PT{minutes}M`, `RRULE:FREQ=DAILY` (o `BYDAY`), alarma a 0 min, resumen "kettellbro · tu carta del día", y la URL. En Android se ofrece además el enlace de Google Calendar [NO VERIFICADO: formato de URL].
  - Texto honesto: "Es un recordatorio de tu calendario, no una notificación de la app."
- **Aceptación:** descarga y alta probadas en iPhone (Safari y PWA instalada) y Android [NO VERIFICADO hasta probar]. Si la descarga no funciona en la PWA de iPhone, mostrar "Ábrelo en Safari".
- **Medir:** `reminder_ics_downloaded`.

### B8. Onboarding rápido, personaje y "Afina tu plan"
- **Impacto:** alto. **Esfuerzo:** M. **Backend nuevo:** No (campo `character` en `meta/settings`; verificar reglas con el emulador).
- **Dónde:** `Onboarding.tsx`, `Hoy` (tarjeta nueva), `defaults.ts`, `types.ts`.
- **Comportamiento:**
  - Pasos de primera vez: **Personaje → Seguridad → Nivel → Tiempo → Pesas** (5), o 4 sin personaje (variante B de E03). Meta, Cuerpo y Acompañante pasan a "Afina tu plan".
  - **Pesas sin preselección:** en modo onboarding, `bells` empieza vacío; "Siguiente" se habilita con ≥1 pesa. Mostrar una sugerencia punteada ("Para tu nivel te sugerimos 10 kg") sin aplicarla hasta tocar.
  - Pantalla de personaje: título "Elige quién te acompaña", dos mosaicos con subtítulos provisionales "Barba y tatuajes" y "Rizos rojos y coleta" (el equipo creativo decide los nombres), con el personaje haciendo un movimiento corto. **Presentarlos como instructores, no como "tu avatar".** Cambiable en Perfil.
  - Tarjeta en Hoy tras la primera sesión: "Afina tu plan" / "Tu Día 1 ya está listo. Cuando quieras, dinos tu meta, tu cuerpo y cómo te guía el acompañante." / botones "Afinar ahora" y "Más tarde".
  - El cribado de seguridad no cambia en nada.
- **Aceptación:** `OnboardingFlow` en modo `edit` sigue mostrando todos los pasos; pruebas del motor intactas; el Día 1 se genera con el nivel y las pesas elegidos.
- **Medir:** `onb_step_view`, `onb_done`; usuarios con `createdAt` sin `onboardedAt`.

### B9. Instalación guiada (Android y iPhone)
- **Impacto:** medio. **Esfuerzo:** M. **Backend nuevo:** No.
- **Dónde:** módulo `src/lib/install.ts`, tarjeta en `Hoy`, hoja de instrucciones.
- **Comportamiento:** reglas de §4.2 (≥1 sesión, ≥2 días de apertura, 14 días de enfriamiento, máximo 3 veces).
  - Android: "Ten kettellbro en tu pantalla de inicio" / "Se abre a pantalla completa, sin la barra del navegador." / "Instalar" / "Ahora no".
  - iPhone: hoja "Instalar en tu iPhone" con los tres pasos de §4.2.
  - Si es navegador integrado: "Primero ábrelo en Safari".
- **Aceptación:** no aparece en standalone ni tras `appinstalled`; el evento se captura al inicio de la app; textos verificados en un iPhone real.
- **Medir:** `install_prompt_shown`, `install_accepted`, `install_dismissed`, `appinstalled`, `ios_install_sheet_view`.

### B10. Regreso sin culpa y "Solo 10 minutos"
- **Impacto:** medio. **Esfuerzo:** M. **Backend nuevo:** No.
- **Dónde:** `Hoy`, `planForToday` (parámetro `minutesOverride`), `progression.ts` (sin progresión con override).
- **Comportamiento:** con `daysSinceLast ≥ 3`, sustituir la nota por una tarjeta:
  - Título: "Bienvenido de vuelta"
  - Texto: "Tu Día {N}, tu mazo y tus frijoles siguen aquí. Hoy retomamos con menos volumen."
  - Botones: "Empezar" y "Solo 10 minutos".
  - Bro en estado `wink` o `idle`, nunca triste.
  - Con ≥14 días: antes de Empezar, repetir las tres preguntas del cribado ("¿Hay algo nuevo que debamos saber?").
  - Racha en 0 se muestra como "Nueva racha" con "Mejor racha: {n}".
- **Aceptación:** la sesión con override cuenta como carta completa (frijol y XP), no progresa pesas (como `reentry`) y el borrador guarda el plan; duración exacta de 10 min.
- **Medir:** `return_after_lapse`, completar en 48 h.

### B11. Mazo "k de M" y "¡CARTA NUEVA!"
- **Impacto:** medio. **Esfuerzo:** M. **Backend nuevo:** No (campo `deck: string[]` en `meta/program`; verificar reglas).
- **Dónde:** `Progreso`, `Celebration`, `finishSession`.
- **Comportamiento:**
  - M = títulos distintos alcanzables con el nivel y el cuidado de espalda del usuario, calculado con el motor puro sobre un horizonte de varios meses y cacheado en memoria.
  - En `Progreso`: "Tu mazo: {k} de {M} cartas" y siluetas solo de cartas alcanzables.
  - En el cierre, si el título no estaba en `deck`: sello "¡CARTA NUEVA!" y "Ya tienes {k} de {M}."
  - Actualizar `deck` en `finishSession`.
- **Aceptación:** nunca se muestran cartas fuera del nivel; si el usuario cambia a "Avanzado" en Perfil, M cambia pero el cribado y la rampa de principiantes siguen aplicando; pruebas del motor.
- **Medir:** distribución de `k` en cohortes (script).

### B12. "Reta a un bro" (nivel 0) y atribución
- **Impacto:** medio. **Esfuerzo:** M. **Backend nuevo:** No (el nivel 1 sí: ver abajo).
- **Dónde:** `Perfil` (sección "Invita a un bro"), `Celebration` (rama `weekDone`), ruta pública `/reto/[codigo]` con `generateMetadata` y `opengraph-image` por segmento.
- **Comportamiento:**
  - Sustituir el texto de Perfil por: "Entrena con un amigo: cada uno juega su propia carta del día." Se elimina "Entrenar acompañado engancha más", afirmación sin respaldo verificado.
  - Botón "Retar a un bro": abre la hoja de alias (opcional, máximo 16 caracteres) y comparte `https://kettellbro.vercel.app/reto/{codigo}` con el texto de §3.2.
  - `/reto/[codigo]`: renderizado en servidor, con "{alias} te reta a cerrar una fila (7 cartas) en 10 días. Los descansos cuentan." y botón "Aceptar el reto" que guarda `kb:ref` en `localStorage` antes de iniciar sesión.
  - Tras la primera sesión del invitado: "Reto aceptado: {alias} te retó."
  - Contador local `invitesSent` en `meta/program` (campo extra).
- **Seguridad:** el alias se renderiza como texto plano; se valida longitud y caracteres; el enlace no otorga nada de valor; el payload se redacta en la analítica (B2).
- **Aceptación:** la vista previa del enlace en WhatsApp y Telegram muestra el alias y la carta; probada con payloads maliciosos.

---

### Backlog B: requiere backend nuevo (fuera de las 12)

| ID | Qué | Qué hace falta | Esfuerzo |
|---|---|---|---|
| BE1 | **Web Push** (recordatorios y regreso) | Manejador `push` en el service worker; token en `users/{uid}/devices/{id}`; envío por Cloud Functions programadas (Blaze) o Vercel Cron en Pro; pre-permiso propio; topes de frecuencia | L |
| BE2 | **Retos con progreso compartido** | Colección `retos` y reglas (boceto en §3.3); pruebas en el emulador | L |
| BE3 | **Atribución de invitaciones y recompensa cosmética** | `users/{uid}.referredBy` inmutable; reglas | M |
| BE4 | **Borrado y exportación de datos** | Proceso de administrador o Cloud Function; quitar al usuario de los retos | M |
| BE5 | **Modo coach** | Reconsiderar Supabase (`ARQUITECTURA` §11); consentimiento explícito | L |
| BE6 | **App Check y alertas de presupuesto** | Configuración de Firebase y Google Cloud | S |

---

## 8. Registro de verificación

| Afirmación | Estado | Fuente |
|---|---|---|
| El HTML de `/` en producción es solo un splash; `/sitemap.xml` da 404 | OBSERVADO hoy | Petición a `kettellbro.vercel.app` |
| Web Push en iOS: 16.4, solo web app añadida a pantalla de inicio, permiso tras acción del usuario, `display` standalone o fullscreen, APNs | VERIFICADO | [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| FCM funciona en Safari/iOS; hay que añadir a pantalla de inicio y pedir permiso en una acción del usuario | VERIFICADO | [Firebase blog](https://firebase.blog/posts/2023/08/fcm-for-safari) |
| Criterios de instalación de Chrome | VERIFICADO | [web.dev](https://web.dev/articles/install-criteria) |
| Notification Triggers: desarrollo terminado | VERIFICADO | [Chrome](https://developer.chrome.com/docs/web-platform/notification-triggers) |
| Vercel Cron: Hobby una vez al día con ±59 min; Pro por minuto | VERIFICADO | [Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing) |
| Eventos personalizados de Vercel solo en Pro y Enterprise | VERIFICADO | [Vercel](https://vercel.com/docs/analytics/custom-events) |
| Vercel Web Analytics: sin cookies de terceros, hash que se descarta a las 24 h, agregado | VERIFICADO | [Vercel](https://vercel.com/docs/analytics/privacy-policy) |
| Cloud Functions requieren Blaze | VERIFICADO | [Firebase](https://firebase.google.com/docs/functions/get-started) |
| Funciones programadas requieren Blaze; Cloud Scheduler cobra tras tres tareas gratuitas | VERIFICADO (vía búsqueda) | [Firebase](https://firebase.google.com/docs/functions/schedule-functions) |
| Pantalla de consentimiento: "Testing" limitada a 100 usuarios; "In production" para cualquier cuenta | VERIFICADO | [Google Cloud](https://support.google.com/cloud/answer/15549945) |
| Google bloquea OAuth en webviews embebidos | VERIFICADO (vía búsqueda) | [Google Developers Blog](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/) |
| Qué apps sociales fallan y cómo | NO VERIFICADO | Probar con teléfonos reales |
| Wake Lock roto en PWA instalada de iPhone hasta iOS 18.4 | Fuente secundaria | [Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock), [WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545) |
| Vibración en Safari de iPhone | NO VERIFICADO | MDN solo dice "disponibilidad limitada" |
| Márgenes de historias (250 px arriba; 250 o 340 px abajo) | Convención de la industria, sin página oficial de Meta | [Inro](https://www.inro.social/blog/instagram-story-size), [Make Tech Easier](https://maketecheasier.com/instagram-story-reel-safe-zone) |
| Google limitó resultados enriquecidos de FAQ y HowTo (agosto de 2023) | VERIFICADO | [Google Search Central](https://developers.google.com/search/blog/2023/08/howto-faq-changes) |
| iOS 26: todo sitio añadido se abre como app web salvo que lo desactives | Fuentes secundarias que citan a WebKit | [heise](https://heise.de/-10749652), [iThinkDiff](https://www.ithinkdiff.com/add-web-app-bookmark-iphone-home-screen-ios-26/) |
| Implementaciones de intención: d = 0,65, 94 pruebas | Resumen secundario | [Resumen](https://stafforini.com/works/gollwitzer-2006-implementation-intentions-and/) |
| Hábitos: mediana 66 días, rango 18 a 254, 39 con buen ajuste | Resumen secundario | [BPS](https://bps.org.uk/research-digest/how-form-habit) |
| Gamificación y actividad física: prometedora, efecto corto y volátil | VERIFICADO (resumen) | [JMIR](https://jmir.org/2022/1/e26779) |
| Duolingo: +4 % de vuelta a la semana, −5 % de pérdida de racha (sus usuarios) | VERIFICADO | [Duolingo](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals) |
| La lotería tradicional tiene 54 cartas (otras fuentes dicen 54 o 56) | Fuente periodística | [Vanguardia](https://vanguardia.com.mx/noticias/la-chalupa-y-buenas-como-surgio-la-loteria-mexicana-y-sus-54-versos-para-cantarla-YG9190054) |
| Web Share de archivos: soporte | Parcial | [web.dev](https://web.dev/articles/files/share-files) |
| `opengraph-image` recibe `params`; `searchParams` no confirmado | Parcial | [Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image) |
| Volúmenes de búsqueda de cualquier consulta | NO VERIFICADO | Validar con Search Console |
| Formato `wa.me/?text=`; límites de `og:image` de WhatsApp; formato de URL de Google Calendar; ICS desde PWA de iPhone; One Tap con Firebase | NO VERIFICADO | Probar antes de implementar |
| Plausible y Umami: funnels | Fuentes se contradicen | Verificar en sus sitios |
| Comunidades de pesa rusa en español | No encontradas | Búsqueda manual pendiente |
| Duración exacta de sesión y modo por tiempo en todas las sesiones | Dicho por el coordinador; no visto en el código leído | Verificar y añadir prueba |

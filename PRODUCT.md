# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
PWA mobile-first en Next.js (App Router, TypeScript) + Firebase (Auth con Google como único método de acceso + Firestore con caché offline). Elegido por el usuario. Idioma: solo español.

## Users
Personas hispanohablantes que entrenan (o quieren empezar) con pesas rusas en casa o en un gimnasio pequeño, normalmente con 1 a 3 kettlebells, desde el celular, entre otras obligaciones del día. Vienen de un reto de 30 días y quieren pasar a un estilo de vida de entrenamiento sostenido. Usan la app durante el entrenamiento: manos con magnesia o sudadas, el teléfono apoyado a metros de distancia, tiempo limitado (10 a 45 min).

## Product Purpose
"kettellbro" es un entrenador de bolsillo de pesas rusas: genera una rutina diaria distinta, infinita y con sustento fisiológico, y acompaña cada ejercicio, serie y descanso (cadencia, cues de técnica, temporizadores, registro de pesos y repeticiones). El usuario siente que tiene un entrenador de élite respaldado por la ciencia y que, al entrar con Google, todo su historial, pesos levantados y metas están intactos. Éxito: el usuario vuelve cada día y completa su sesión; su progreso se carga sin fricción en cualquier dispositivo.

## Positioning
Un motor de programación determinista basado en protocolos documentados (Hardstyle/Pavel Tsatsouline, Girevoy Sport, periodización ondulante, autorregulación por RPE) que usa exclusivamente kettlebells, combinado con un acompañante en vivo por ejercicio. Ninguna app genérica de fitness que sugiere rutinas "inventadas" puede decir que cada bloque cita su respaldo.

## Operating Context
Entrenamiento diario, a menudo con la pantalla a distancia: texto y contadores legibles de lejos, controles grandes, uso con una mano o sin tocar (voz, vibración, sonidos). Conexión inestable posible: debe abrir y registrar sin red y sincronizar después. Sesión en curso recuperable si se cierra la app.

## Capabilities and Constraints
- Registro/inicio de sesión solo con Google (obligatorio); sin email/contraseña ni acceso anónimo en producción.
- Todo ejercicio central usa kettlebell; sin otro equipamiento. Rutinas estrictamente basadas en evidencia; nada inventado sin sustento fisiológico.
- Datos por usuario (UID): perfil, estado del programa, sesiones, récords, metas, borrador de sesión activa. Reglas de seguridad que aíslan por UID.
- Motor de rutinas determinista (semilla = UID + número de día), fases de mesociclo de 4 semanas con descarga, progresión por RPE y pesos discretos disponibles del usuario.
- Mobile-first, moderno, ágil. Animaciones y estilo propio; accesible con `prefers-reduced-motion`.
- Afirmaciones de salud limitadas a lo que la literatura respalda; sin promesas de quema calórica garantizada ni "tonificar".
- Nombre del producto: "kettellbro" (constante única, fácil de cambiar).

## Brand Commitments
Nombre: kettellbro. Tono de coach cercano ("bro"), directo y motivador, en español; la ciencia se muestra como respaldo, no como sermón.

## Evidence on Hand
Investigación en curso en `docs/research/` (estudios.md, evidence.json, protocolos.md, ejercicios.json). Sin testimonios, usuarios ni métricas reales: no se deben inventar.

## Product Principles
1. La ciencia es el motor, no el adorno: cada bloque de la rutina puede explicar por qué está ahí.
2. El historial es sagrado: entrar con Google siempre devuelve el estado exacto, incluso offline o a mitad de sesión.
3. Durante la serie manda la mano ocupada: legible a distancia, un toque, feedback sonoro/háptico.
4. Cada día se siente distinto pero nunca aleatorio: variedad con intención fisiológica.
5. Progreso visible y honesto: logros reales derivados de datos reales.

## Accessibility & Inclusion
Contraste suficiente en entornos con mala luz, objetivos táctiles grandes, no depender solo del color ni del sonido, respetar `prefers-reduced-motion`, nunca mostrar destellos rápidos. Lenguaje neutral en género.

# Contrato de los personajes 3D de kettellbro

> **Actualización (17-oct-2026):** `bro` y `princess` pasaron a ser personas realistas de MakeHuman (CC0) con texturas PBR. Siguen los mismos 21 huesos, clips y pesas; cambian los presupuestos (≤ 60 000 triángulos, ≤ 14 texturas de ≤ 1024 px, ≤ 4 MB) y los materiales por rol (`skin`, `hair`, `eyes`, `eyebrows`, `eyelashes`, `top`, `shoes`, `bell`, `bellHandle`). El validador usa el perfil «realista» cuando el GLB trae imágenes. Detalles en `tools/blender/README.md`. Lo que sigue describe el contrato original de los muñecos de cómic.


Documento técnico compartido por quien modela (Blender), quien define el arte (Technical Artist) y quien integra en la web (three.js). **Si algo de aquí debe cambiar, se cambia aquí primero y se avisa**; los tres trabajos dependen de estos nombres.

La versión 2D (`src/components/figure`) sigue siendo la figura por defecto y el respaldo (sin WebGL, ahorro de datos, `prefers-reduced-motion`). El 3D es una mejora opcional, cargada bajo demanda.

## 1. Personajes

| id | Quién es | Rasgos obligatorios |
|---|---|---|
| `bro` (nombre en pantalla: **Bro**) | Hombre atlético y fuerte | **Calvo, con barba, pendientes y los brazos tatuados.** Viste **camiseta negra y pantalón verde** (más zapatillas). La manga de la camiseta es corta y acaba a media altura del brazo para que se vean los tatuajes en antebrazos y brazos. Referencia de estilo: ilustración plana de atleta. Altura 1,75 m. **Cuerpo claramente masculino y fuerte**: hombros anchos, pecho y espalda amplios (forma de V), brazos y antebrazos gruesos, cuello robusto, cintura recta, piernas fuertes; nada de silueta de maniquí delgado. **Cara atractiva y simpática**: rasgos armónicos, mandíbula marcada con la barba bien cuidada, ojos expresivos, cejas relajadas (sin gesto de enfado), sonrisa leve. |
| `princess` (nombre en pantalla: **Princess**) | Mujer delgada con curvas | **Pelo rojo, rizado y recogido** (coleta alta con rizos visibles). Viste **de blanco con tonalidades beige** (top blanco; mallas o short y detalles en beige) y zapatillas claras. Altura 1,65 m. **Estructura claramente femenina**: más baja y de huesos finos que Bro (hombros estrechos, cuello fino y largo, brazos y manos delicados), pecho definido, cintura marcada, caderas más anchas que la cintura, muslos con curva suave y pantorrillas estilizadas; nada de hombros cuadrados ni torso recto. **Cara bonita y delicada**: óvalo suave, ojos grandes con brillo y pestañas, cejas finas y arqueadas, nariz pequeña, labios definidos, sonrisa amable. |

**Ropa fija por personaje.** Los colores de la ropa no cambian con la tinta del día: `bro` = negro y verde, `princess` = blanco y beige. La tinta del día solo tiñe el fondo, el suelo y el reflejo de borde del visor. Los tonos exactos (hex) los fija el Technical Artist en `docs/PERSONAJES-3D.md`, tomados de la paleta del diseño, y deben leerse bien sobre los fondos de color de las cartas (rosa, azul, verde, rojo, turquesa).

Display: en la interfaz se muestran como **Bro** y **Princess**.

Estilo: figura **estilizada y plana** (pocos colores lisos, formas limpias, proporciones amables de unas 7,5 cabezas), nada fotorrealista. El contorno oscuro y el sombreado tipo cómic los aplica el visor (three.js), no el GLB. Es una ilustración, no un avatar del usuario: se presentan como instructores.

## 2. Convenciones de escena

- Metros, **Y arriba, el personaje mira a +Z**, origen entre los pies, a nivel del suelo.
- Postura de reposo: pose en A, brazos a ~35° del cuerpo.
- Un solo `Armature` llamado `Rig`; un `Scene` por archivo; sin cámaras ni luces en el GLB.
- Sin movimiento de raíz: la cadera se mueve en su sitio y los pies se ven plantados (IK al crear la animación). Única excepción tolerada: el get-up turco, que se desplaza en el suelo como máximo ±0,9 m y su promedio queda centrado.
- Los ejercicios unilaterales se animan para la **mano derecha**; el visor refleja el personaje (`scale.x = -1`) para el lado izquierdo.

## 3. Esqueleto (nombres exactos)

```
Hips
├─ Spine ─ Chest ─ Neck ─ Head
│          ├─ Shoulder.L ─ UpperArm.L ─ ForeArm.L ─ Hand.L
│          └─ Shoulder.R ─ UpperArm.R ─ ForeArm.R ─ Hand.R
├─ UpLeg.L ─ Leg.L ─ Foot.L ─ Toe.L
└─ UpLeg.R ─ Leg.R ─ Foot.R ─ Toe.R
```

Huesos opcionales de movimiento secundario: `Tail.1`, `Tail.2`, `Tail.3` (coleta de `princess`, hijos de `Head`). Máximo 65 huesos. Los dedos pueden ser un solo hueso `Grip.L` / `Grip.R` hijo de la mano.

## 4. Mallas y materiales

- Mallas con piel (skin) al `Rig`. Nombres de material **exactos**, con color base liso: `skin`, `tattoo`, `top`, `bottoms`, `shoes`, `hair`, `beard`, `earrings`, `eyes`, `mouth`. El visor reemplaza los materiales por sombreado tipo cómic según el nombre; el color de cada prenda lo fija el personaje (no se tiñe).
- Materiales opcionales de las caras (añadidos el 2026-10-16): `eyewhite` (esclerótica y brillo de los ojos, blanco) y `blush` (rubor de las mejillas, solo `princess`). El iris, el párpado y las pestañas usan `eyes`; los labios, `mouth`. El visor los pinta como color plano (como `eyes` y `mouth`).
- Los tatuajes pueden ser geometría pegada a la piel o una textura pequeña (≤ 512 × 512); el visor solo depende de que exista el material `tattoo`.
- La pesa son nodos de la escena, sin piel: `Kettlebell` y `Kettlebell2` (la segunda, para ejercicios con dos pesas). Material `bell` (cuerpo) y `bellHandle` (asa). Diámetro del cuerpo ≈ 0,19 m (pesa mediana). Su movimiento va **horneado en cada clip** (canales de traslación, rotación y escala), de modo que sigue a las manos; cuando una pesa no se usa en ese clip, escala ≈ 0.001 (el visor además la oculta).

## 5. Animaciones (clips)

- Un clip por ejercicio, con el nombre **igual al `ExerciseId`** de `src/lib/engine/types.ts` (29 ejercicios, ver §8) + un clip `idle` (de pie, respiración suave).
- 30 fps, **bucle sin salto** (primer y último fotograma iguales).
- Duración del clip = **una repetición**. Si el ejercicio tiene `secPerRep > 0`, el clip dura exactamente `secPerRep` segundos; el visor lo reajusta al ritmo real con `timeScale`. Si `secPerRep` es 0 (acarreos, etc.), el clip dura 2 s (un par de pasos / un ciclo de respiración).
- Fuente de las poses: la 2D ya describe cada ejercicio en el plano sagital (`src/components/figure/poses.ts`, ángulos en `skeleton.ts`). Es el punto de partida; los ejercicios con movimiento lateral o de giro (molino, arm bar, get-up, ocho, acarreos con inclinación, halo) exigen poses 3D propias.
- Corrección técnica antes que adorno: las poses deben corresponder a las indicaciones de `src/lib/engine/exercises.ts` (`cues`, `mistake`, `stagesEs`) y a `docs/research/protocolos.md`.

## 6. Presupuestos

| Concepto | Límite |
|---|---|
| Triángulos por personaje (con pesas) | ≤ 14 000 |
| Huesos | ≤ 65 |
| Tamaño del GLB por personaje, con todos los clips | ≤ 1,5 MB sin comprimir y ≤ 800 KB con gzip (objetivo) |
| Texturas | ≤ 1 de 512 × 512 por personaje |

## 7. Visor web (contrato de uso)

- Archivos: `public/models/bro.glb`, `public/models/princess.glb`.
- Vistas: `"side" | "front" | "three-quarter" | "auto"`. `side`: el personaje mira a la derecha de la pantalla (igual que en 2D). `auto`: alterna o rodea despacio, y se queda fija con `prefers-reduced-motion`.
- Componente con las mismas props que el 2D (`exerciseId`, `size`, `playing`, `repSec`, `tone`, `showGround`) más `view` y `character`, y con respaldo automático al 2D si no hay WebGL o falla la carga. Se importa de forma diferida (`next/dynamic`), solo en pantallas que lo usan.
- Rendimiento: pixel ratio ≤ 2, un solo renderer por página, pausa con la pestaña oculta o fuera de pantalla, libera memoria al desmontar.
- Los nombres de personaje (`"bro" | "princess"`) y de vista coinciden con los de la línea 2D; si la 2D ya definió tipos o hooks (`useCharacter`, `useFigureView`), el visor los reutiliza.

## 8. Los 29 clips

`kettlebell-deadlift`, `two-hand-swing`, `one-arm-swing`, `single-leg-rdl`, `hip-bridge`, `goblet-squat`, `prying-goblet-squat`, `front-squat`, `reverse-lunge-racked`, `strict-press`, `push-press`, `floor-press`, `half-kneeling-press`, `bottom-up-press`, `one-arm-row`, `high-pull`, `clean`, `snatch`, `clean-and-press`, `turkish-get-up`, `windmill`, `halo`, `arm-bar`, `figure-8`, `suitcase-carry`, `rack-carry`, `farmer-carry`, `bottom-up-carry`, `waiter-carry`; más `idle`.

## 9. Herramientas y reglas

- **Blender 5.2.2 LTS** ya instalado y verificado (SHA-256 oficial) en `C:\Users\rodri\tools\blender\blender-5.2.2-windows-x64\blender.exe`. Se ejecuta sin interfaz: `blender.exe --background --factory-startup --python <script.py> -- <args>`. Exportador glTF incluido.
- Todo debe poder regenerarse desde scripts versionados en `tools/blender/` (nada hecho a mano en la interfaz). Salida: `public/models/*.glb`. Vistas previas para revisar: `art/previews/` (no se publican).
- **Licencia limpia:** solo geometría y texturas propias, creadas por script. Sin Mixamo, sin assets de terceros ni modelos de IA sin licencia clara.
- **Pinokio** está instalado en `C:\pinokio` pero hoy no tiene ninguna herramienta de IA 3D (solo una app ajena). La GPU es una RTX 5070 portátil con 8 GB de VRAM. No se instala ni se descarga ningún modelo de IA sin aprobarlo antes con el coordinador (indicar tamaño y qué aporta).
- No tocar `SessionPlayer`, Hoy, Onboarding, ajustes ni el motor: la integración final la hace el coordinador.
- No desplegar ni hacer commits.

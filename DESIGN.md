---
name: kettellbro
description: "Rendimiento nocturno: cada día es una tarjeta de entrenamiento con la tinta eléctrica de su enfoque sobre grafito casi negro, tipografía condensada deportiva en cursiva y un mes que se va marcando con vistos."
colors:
  night: "#0b0e14"
  night-2: "#121722"
  night-3: "#1b2230"
  seam: "#2c3649"
  paper: "#f4f6fa"
  paper-dim: "#b3bccd"
  paper-mute: "#8392aa"
  vermilion: "#f2432d"
  vermilion-lift: "#ff7a62"
  vermilion-deep: "#8f1d10"
  cobalt: "#2a4de8"
  cobalt-lift: "#7d96ff"
  cobalt-deep: "#14257f"
  jade: "#00a878"
  jade-lift: "#3fdcae"
  jade-deep: "#00583f"
  marigold: "#ffb41f"
  marigold-lift: "#ffd067"
  marigold-deep: "#8a5a00"
  rose: "#ff5fa2"
  rose-lift: "#ff9ac4"
  rose-deep: "#8f1f58"
  aqua: "#4fc9e8"
  aqua-lift: "#8fe0f3"
  aqua-deep: "#1b6d85"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, system-ui, sans-serif"
    fontWeight: 800
    fontStyle: "italic"
    textTransform: "uppercase"
    lineHeight: 1
    letterSpacing: "0.01em"
  numeral:
    fontFamily: "Anybody, Arial Narrow, system-ui, sans-serif"
    fontWeight: "380 to 900 (follows --heat)"
    fontFeature: "tnum"
    fontVariation: "wdth 112% to 88% (follows --heat)"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "14px"
  card: "24px"
  panel: "22px"
  cell: "10px"
---

# Design System: kettellbro

## 1. Overview

**Creative North Star: "Rendimiento nocturno".** Una app de deporte que se usa de noche o en un garaje con luz mala, con el teléfono apoyado a metros: fondo grafito casi negro, blanco frío para el texto y UNA tinta eléctrica por día (la del enfoque) que pinta la tarjeta, el reproductor y los acentos. La voz tipográfica es de marca deportiva: condensada, cursiva, en mayúsculas, con números enormes que engrosan con el esfuerzo.

Sustituye al sistema anterior («Lotería de Hierro»: papel, rayos, grano, slab de madera y frijoles). Se conserva la mecánica (una tinta por enfoque, una tarjeta por día, un mes que se marca) y se pierde la nostalgia.

## 2. Colors

- **Grafito** (`night`, `night-2`, `night-3`, `seam`): fondo, paneles y separadores. Sin degradados de relleno de pantalla.
- **Blanco frío** (`paper`, `paper-dim`, `paper-mute`): texto principal, secundario y de apoyo. `paper-mute` sobre `night-2` da 5,6:1.
- **Tintas por enfoque** (`data-focus` en el contenedor): potencia = bermellón, fuerza = cobalto, resistencia = jade, híbrido = caléndula, técnica = rosa, recuperación = aqua. Cada una trae `--ink` (campo), `--on-ink` (texto sobre el campo), `--ink-lift` (acento sobre grafito) y `--ink-deep` (sombra).
- **Regla de la tinta:** la tinta es el único color saturado de una pantalla; no se mezclan dos tintas en la misma superficie (el mes, que muestra la tinta de cada día en una barra, es la excepción informativa).

## 3. Typography

- **Display** (Barlow Condensed 800 cursiva, mayúsculas): titulares, nombres de tarjeta, botones, etiquetas y marca. Clase `.font-slab` (el nombre se conserva por sus usos).
- **Cuerpo** (Barlow): texto corrido e interfaz; 16 px mínimo en lectura.
- **Numeral** (Anybody, variable): cuentas atrás, repeticiones, kilos. `--heat` (0–1) sube el peso y estrecha el ancho; en el reproductor, más esfuerzo = números más densos.
- **Regla de la cursiva:** solo la cursiva del display; el cuerpo nunca va en cursiva.

## 4. Elevation & Shapes

- Superficies: borde de 1 px `white/10–15`, radios de 22–24 px en tarjetas y paneles, 14–18 px en controles, 10 px en casillas.
- Sombras con desplazamiento y desenfoque (nunca un halo centrado ni sombra dura): `0 26px 46px -22px rgb(0 0 0 / .85)` en tarjetas.
- Franjas de velocidad (polígonos inclinados en `ink-deep` y blanco al 6–10 %) como único ornamento; sin grano ni rayos.

## 5. Components

- **Botones:** primario = tinta con luz superior (`inset 0 1px 0 white/28`), `paper` = blanco, secundario = `night-3` con borde fino. Etiqueta en display.
- **Tarjeta del día (`LoteriaCard`):** campo de tinta con profundidad, número del día inclinado 8°, etiqueta del enfoque en píldora oscura, arte con foco de luz detrás y banner oscuro con el nombre (que se encoge hasta caber en una línea).
- **Tu mes (`Tabla`):** 4 × 7 casillas; hecha = tinta con visto blanco; hoy = tinta con aro blanco; futura = grafito con una barra de la tinta de ese día; semana completa = pastilla inclinada «Semana completa».
- **Reproductor:** campo completo de la tinta; el escenario con el personaje es lo primero que se ve (≥ 40 % del alto), con fases 1·2·3, columna de vistas y siluetas de poses clave; debajo, nombre, repeticiones y reloj.
- **Navegación:** barra inferior de cuatro destinos; el activo lleva píldora de tinta detrás del icono.
- **Hojas:** `<dialog>` con borde superior de 1 px, entran y salen por el mismo borde.
- **Mascota (El Bro):** la pesa con cara se conserva en pantallas de carga, vacíos y celebraciones.

## 6. Do's and Don'ts

**Haz:** una sola tinta por pantalla; números grandes y legibles a distancia; display solo para titulares, nombres y botones; movimiento con `prefers-reduced-motion`.

**No hagas:** papel crema, rayos de grabado, grano, frijoles ni palabras de lotería; texto con degradado; bordes de color de más de 1 px en un lado; sombras duras; mezclar dos tintas en una superficie; cursiva en el cuerpo.

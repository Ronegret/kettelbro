# Personajes 3D: biblia de arte

Valores de arte de los personajes 3D de kettellbro. Los datos que leen los scripts están en `tools/blender/spec/characters.json`; este documento explica el porqué. El contrato técnico (nombres, presupuestos) está en `docs/PERSONAJES-3D-CONTRATO.md`. El Technical Artist puede cambiarlos aquí y en el JSON.

## 1. Estilo

Ilustración plana de atleta: pocos colores lisos, formas limpias y legibles a 150-250 px de alto. Nada de texturas ni detalle fino. El GLB lleva solo el color base de cada material; el contorno y el sombreado tipo cómic los pone el visor (§4). Los rasgos que piden los personajes deben leerse en las cuatro vistas (lado, frente, 3/4 y espalda): se revisan en `art/previews/`.

## 2. Paleta

Colores fijos por personaje: la tinta del día no los tiñe. Cada celda da dos medidas contra el fondo de la carta: **contraste WCAG / ΔE2000**. WCAG mide solo luminancia; ΔE2000 mide la diferencia de color percibida, tono incluido. Una prenda se lee sobre la carta (con el contorno oscuro del visor) si WCAG ≥ 3 o ΔE ≥ 20; ⚠ marca lo que no llega a ninguno. La tabla se regenera con `node tools/blender/palette_report.mjs` (tintas de `globals.css`).

**bro**

| Material | Hex | rojo #f2432d | azul #2a4de8 | verde #00a878 | ámbar #ffb41f | rosa #ff5fa2 | turquesa #4fc9e8 |
|---|---|---|---|---|---|---|---|
| `top` camiseta negra | #0e0f17 | 5.11 / 50 | 3.02 / 36 | 6.25 / 53 | 10.73 / 74 | 6.74 / 55 | 9.87 / 67 |
| `bottoms` pantalón verde hierba | #4d9a26 | 1.06 / 65 | 1.79 / 63 | 1.15 / 16 ⚠ | 1.98 / 39 | 1.24 / 77 | 1.82 / 44 |
| `skin` piel | #c4875a | 1.24 / 19 ⚠ | 2.09 / 52 | 1.01 / 43 | 1.70 / 20 | 1.06 / 34 | 1.56 / 43 |
| `beard` / `hair` (cejas) | #4b2f22 (`--bean`) | 3.25 / 35 | 1.92 / 40 | 3.97 / 51 | 6.83 / 60 | 4.29 / 46 | 6.28 / 63 |
| `tattoo` | #21244f (`--night-3`) | 3.93 / 50 | 2.33 / 24 | 4.81 / 54 | 8.25 / 78 | 5.18 / 49 | 7.59 / 63 |
| `shoes` / `earrings` (aros plateados) | #f4efe2 (`--paper`) | 3.26 / 42 | 5.50 / 58 | 2.66 / 34 | 1.55 / 27 | 2.47 / 39 | 1.69 / 29 |
| `eyes` | #11122a (`--night`) | 4.91 / 52 | 2.91 / 32 | 6.01 / 56 | 10.32 / 78 | 6.48 / 54 | 9.49 / 67 |
| `mouth` | #8f1d10 (`--ink-deep`) | 2.39 / 23 | 1.41 / 44 | 2.92 / 67 | 5.02 / 53 | 3.15 / 39 | 4.62 / 73 |

Internos: piel/camiseta 6.33 (ΔE 52) · piel/pantalón 1.17 (ΔE 39) · camiseta/pantalón 5.43 (ΔE 52) · piel/barba 4.03 (ΔE 37) · piel/tatuaje 4.87 (ΔE 53) · piel/aros 2.63 (ΔE 30).

**princess**

| Material | Hex | rojo #f2432d | azul #2a4de8 | verde #00a878 | ámbar #ffb41f | rosa #ff5fa2 | turquesa #4fc9e8 |
|---|---|---|---|---|---|---|---|
| `top` top blanco | #fbf8f0 | 3.52 / 43 | 5.95 / 57 | 2.88 / 35 | 1.68 / 29 | 2.67 / 39 | 1.82 / 28 |
| `bottoms` mallas beige cálido | #a8784f | 1.03 / 21 | 1.64 / 49 | 1.26 / 40 | 2.16 / 25 | 1.36 / 35 | 1.99 / 43 |
| `skin` piel | #e7a98e | 1.86 / 23 | 3.15 / 52 | 1.52 / 46 | 1.13 / 21 | 1.41 / 28 | 1.04 / 39 |
| `hair` pelo rojo caoba (`beard` = cejas) | #962a1c | 2.12 / 21 | 1.26 / 43 | 2.60 / 65 | 4.46 / 50 | 2.80 / 37 | 4.10 / 70 |
| `shoes` zapatillas claras | #fbf8f0 | 3.52 / 43 | 5.95 / 57 | 2.88 / 35 | 1.68 / 29 | 2.67 / 39 | 1.82 / 28 |
| `earrings` / `eyes` / `tattoo` | #f4efe2 / #11122a / #21244f | como `bro` | | | | | |
| `mouth` | #b8433a | 1.44 / 13 | 1.17 / 42 | 1.76 / 64 | 3.02 / 43 | 1.90 / 26 | 2.78 / 65 |

Internos: piel/top 1.89 (ΔE 24) · piel/mallas 1.91 (ΔE 18) · top/mallas 3.62 (ΔE 36) · piel/pelo 3.96 (ΔE 40).

Pesas (los dos personajes): `bell` #f4efe2 (papel, como la pesa 2D) y `bellHandle` #bcbad3 (`--paper-dim`). Pesa sobre la camiseta negra: 16,6:1.

Lectura de los números:
- Solo un casi negro llega a 3:1 de luminancia sobre las seis tintas (el azul #2a4de8 tiene luminancia 0,116). Por eso la camiseta es #0e0f17.
- Pantalón: un verde medio vivo tiene la misma luminancia que las cartas roja, rosa y verde (WCAG ~1,1), así que se separa por tono. #4d9a26 es verde hierba, más amarillo que la carta verde azulada: ΔE ≥ 39 en cinco cartas. Sobre la carta verde se queda en ΔE 16: verde sobre verde no tiene arreglo de color, ahí lo separan el contorno y la camiseta negra. El verde oscuro anterior (#24481f) daba 1,64:1 sobre el azul y se leía casi negro.
- La piel de `bro` contrasta por tono con el verde y el turquesa (ΔE 43). Su punto débil es la carta roja (ΔE 19, tono vecino). La de `princess`, rosada, da ΔE ≥ 21 en todas.
- `princess`: el beige provisional (#cdb592) se perdía sobre el ámbar y el turquesa (ΔE 18 y 34; WCAG 1,1 y 1,0). El beige cálido y más oscuro da ΔE ≥ 21 en todas las cartas y 3,6:1 contra el top blanco, así que las dos prendas se distinguen. El pelo caoba se separa de la carta roja (ΔE 21); un rojo anaranjado se confundía con ella (ΔE ≤ 13).
- La boca no toca el fondo de la carta, así que su ⚠ no cuenta.

## 3. Proporciones y rasgos

**Bro** (1,75 m, unas 7,4 cabezas de barbilla a coronilla, 0,235 m). Es un hombre fuerte:
- Hombro 3D a 0,21 m de la línea media, con deltoides de radio 0,066: unos 0,55 m de deltoide a deltoide.
- Torso en V: 0,40 m en los dorsales y 0,30-0,31 m en la cintura, con pectorales integrados en el perfil (1,6 cm).
- Trapecio que sube a un cuello de radio 0,074.
- Bíceps de radio 0,056 y antebrazo de 0,048; manos de 0,10 m de ancho.
- Muslos de radio 0,10 y pantorrillas de 0,068.
- Camiseta negra ajustada con cuello y dobladillos en relieve; manga hasta media altura del brazo.
- Cara: mandíbula cuadrada bajo la barba cuidada, nariz con puente, cejas finas y relajadas, ojos con esclerótica, iris y brillo, sonrisa leve sobre la barba, aros plateados y tatuajes en los dos brazos.

**Princess** (1,65 m, cabeza de 0,21 m). Es una mujer delgada con curvas:
- Hombros de ~0,37 m (articulación a 0,152, casquillo de radio 0,038), caídos.
- Cuello fino de radio 0,045.
- Pecho integrado en el perfil (proyección ~5 cm), cintura de ~0,23-0,24 m y caderas de 0,356 m, con glúteos integrados.
- Muslos que se afinan hacia la rodilla y pantorrilla marcada.
- Brazos finos (radio 0,037 / 0,03) y manos de 0,068 m.
- Top blanco ajustado a la cintura con ribetes beige y mallas beige de talle alto.
- Cara: óvalo suave, ojos grandes rasgados (5°) con brillo, párpado y pestañas, cejas finas arqueadas, nariz pequeña, labios con sonrisa y rubor plano.
- Pelo rojo: casquete liso, tirabuzones en las sienes y a los lados de la frente, y coleta alta en tirabuzón grande (3 vueltas, que dibujan 6 rizos en la silueta) sobre `Tail.1-3`, con goma beige.

**Común:**
- Las piernas, el tronco y la cabeza siguen las longitudes de `rig.ts` (escala 0,0133 m en `bro` y 0,01254 en `princess`). Los brazos tienen proporción real.
- Los perfiles se suavizan con anillos intermedios (Catmull-Rom) y las normales son suaves.
- En la animación, los brazos libres guardan una abducción mínima (11° en `bro`, 6° en `princess`) para no atravesar el torso.
- Presupuesto real: `bro` 9.724 triángulos y `princess` 12.012, con las dos pesas (máximo 14.000).

## 4. Receta de sombreado cómic para el visor (propuesta)

1. **Material por nombre:** `MeshToonMaterial` con el color del GLB y un `gradientMap` de 3 tonos (sombra 0,55, medio 0,8, luz 1,0; `NearestFilter`). `eyes`, `mouth` y `tattoo` sin luz (`MeshBasicMaterial`) para que sigan planos.
2. **Luz:** una direccional desde arriba a la izquierda de la cámara (intensidad ~2,2) y una hemisférica suave (cielo papel, suelo noche, ~0,6). Sin especular ni sombras proyectadas; una elipse oscura en el suelo hace de sombra de contacto.
3. **Contorno:** casco invertido (`BackSide`, extrusión por la normal de ~6 mm, o 1,5-2 px en espacio de pantalla), color `--night` #11122a. Dibujarlo también en las pesas.
4. **Reflejo de borde** (fresnel ~0,35, umbral 0,6) con `--ink-lift` del día. En la tinta azul (`strength`), usar papel #f4efe2 en vez de `--ink-lift`: es lo que separa el pantalón y la piel del fondo (ver §2).
5. **Espejo:** para el lado izquierdo, `scale.x = -1` sobre la raíz y `side = DoubleSide` en el contorno (o invertir el winding).

## 5. Lista de verificación de poses

Se revisa en `art/previews/<id>_<clip>.png` (filas: lado, frente, 3/4, espalda; columnas: 0, 20, 40, 60 y 80 % de la repetición). La comprueba en números `tools/blender/validate.py`.

**General**
- [ ] Pies plantados: el tobillo no se desliza más de 5 mm (validate.py lo mide).
- [ ] Bucle sin salto: el primer fotograma es igual al último. Ningún hueso gira más de 30° de un fotograma al siguiente.
- [ ] La pesa sigue a las manos: el asa queda dentro del puño, sin pesa flotando ni atravesando el cuerpo.
- [ ] Muñecas rectas (antebrazo y mano alineados) y agarre prono con las palmas hacia el cuerpo.
- [ ] Brazos por fuera del torso. Codos y rodillas sin pliegues rotos.
- [ ] Rasgos visibles en las cuatro vistas: barba, aros, tatuajes, verde del pantalón.

**Bisagra (peso muerto, swing)**
- [ ] La cadera va atrás, no abajo. Espinillas casi verticales (≤ 15°) y espalda larga y recta, sin redondear.
- [ ] Peso muerto: la pesa entre los pies, a la altura del mediopié, y cerca del suelo abajo. Arriba, glúteos apretados y tronco vertical, sin arquear.
- [ ] Swing: atrás, la pesa pasa entre los muslos. Arriba, la pesa a la altura del pecho, brazos rectos y relajados y el cuerpo en plancha vertical.

**Sentadilla goblet**
- [ ] La pesa al pecho, cogida por los cuernos. Codos abajo, por delante de las costillas, sin abrirlos.
- [ ] Rodillas hacia fuera, en la línea de las punteras abiertas. Talones en el suelo y torso erguido.
- [ ] Abajo, la cadera a la altura de la rodilla o por debajo.

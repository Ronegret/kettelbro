# Personajes 3D: notas entre roles

Registro para quien modela (Blender Add-on Engineer), quien revisa el arte (Technical Artist) y quien integra el visor (XR Immersive Developer). Se añade al final, con fecha y rol. El contrato está en `docs/PERSONAJES-3D-CONTRATO.md`; la biblia de arte en `docs/PERSONAJES-3D.md`; el pipeline en `tools/blender/README.md`.

## 2026-10-16 · Blender Add-on Engineer · Hito 1, primera versión

- **Entregado:** `public/models/bro.glb` con los clips `idle`, `kettlebell-deadlift`, `two-hand-swing` y `goblet-squat`. 21 huesos del contrato (sin `Grip.*` ni `Tail.*`), 12 materiales (`skin`, `tattoo`, `top`, `bottoms`, `shoes`, `hair`, `beard`, `earrings`, `eyes`, `mouth`, `bell`, `bellHandle`), sin texturas ni UV, pesas `Kettlebell` y `Kettlebell2` como nodos sin piel con traslación, rotación y escala horneadas en cada clip.
- **Regenerar:** `npm run characters:build` (y `npm run characters:preview` para las hojas de contacto). Validación: `npm run characters:validate` y `npx vitest run src/lib/__tests__/models.test.ts`.
- **Para el visor:**
  - `idle` dura 4 s (el contrato no fija su duración; los ejercicios siguen `secPerRep`).
  - El material `hair` existe también en `bro`: son las cejas (es calvo).
  - La suela de la zapatilla usa el material `top` (negro) y el empeine `shoes`.
  - La pesa que no se usa en un clip tiene escala 0,001 y queda dentro de la pelvis.
- **Desviación de la 2D (corrección técnica):** el peso muerto 3D no copia la pose baja de `poses.ts`. Allí la cadera baja hasta casi una sentadilla (rodilla a ~90°) porque los brazos 2D son ~10 cm más cortos y la pesa es más grande. En 3D la cadera va atrás y arriba (espinillas a ~11°, tronco a 60°) y los brazos cuelgan rectos. La pose está en `scripts/export-poses2d.mjs` (`POSES_3D`) por si la 2D quiere adoptarla.
- **Brazos:** la 3D usa brazos de proporción real (hombro-agarre 0,645 m), así que los brazos se reorientan por dirección a partir de la 2D en vez de copiar la posición de las manos. Goblet: las manos van fijas en el marco del pecho (`OVERRIDES` en `tools/blender/animate.py`).

## 2026-10-16 · Blender Add-on Engineer · Hito 1, pulido (mismo `bro.glb`)

- **Anatomía:** torso en V estrecho en las axilas y hombro 3D más afuera (0,19 m) y 2,2 cm adelantado. Antes los brazos colgantes atravesaban la camiseta. Camiseta hasta la cadera, manga más ajustada, muslo superior que ya no asoma por los costados, cabeza algo mayor con mandíbula más larga. La banda tribal del tatuaje se separa de la manga para que no parezca parte de ella.
- **Animación:** el goblet lleva los codos abajo y por delante de las costillas (antes se metían en el torso). En los clips de postura ancha la pelvis baja unos mm para que el tobillo siempre se alcance. El polo del codo con el brazo recto ya no depende del ruido de redondeo, que hacía girar el brazo sobre su eje.
- **Verificado:** `validate.py` da pies plantados con deriva 0,00 mm en los 4 clips, giro máximo entre fotogramas de 11,2° y ningún vértice sin peso. `validate-glb.mjs` da OK. Ida y vuelta GLB→Blender: error ≤ 0,02 mm en manos, pies, cabeza y pesas. vitest: 2 OK.
- **GLB:** 7.976 triángulos, 21 huesos, 4 clips (28 canales por clip: rotaciones, traslación de `Hips` y los 3 canales de cada pesa; los canales constantes de los huesos no se exportan), 349 KB (130 KB con gzip), sin texturas.
- **Riesgo para el hito 2 (tamaño):** con los 30 clips (151 s) la proyección ronda 1,65 MB, por encima de 1,5 MB. Plan: reducir claves con tolerancia (≤ 0,3°) en `animate.py` y exportar sin muestreo forzado.
- **Para el visor:** para leerse sobre la tinta azul, el pantalón y la piel necesitan el reflejo de borde en papel (ver §2 y §4 de `docs/PERSONAJES-3D.md`). Cada clip hornea la escala de las dos pesas (0,001 = sin usar), así que al cambiar de clip la pesa aparece o desaparece sola. Ocultarla además en el visor, como pide el contrato, es compatible.

## 2026-10-16 · Blender Add-on Engineer · Hito 2, tanda 1 (color)

- **Peticiones del visor:** al empezar no había ninguna en este archivo.
- **Pantalón de `bro`:** de #24481f a #4d9a26 (verde hierba vivo). Mido ahora contraste WCAG y ΔE2000 (`node tools/blender/palette_report.mjs`); tablas en `docs/PERSONAJES-3D.md` §2. Se lee verde sobre todas las cartas, con ΔE ≥ 39 salvo en la verde (ΔE 16: verde sobre verde). La camiseta sigue en #0e0f17. La piel no cambia: ΔE 43 sobre el verde y el turquesa.
- **Paleta de `princess` fijada:** top #fbf8f0, mallas beige cálido #a8784f, piel #e7a98e, pelo caoba #962a1c. ΔE ≥ 21 contra las seis cartas.
- **`bro.glb` re-exportado:** validate.py OK, validate-glb OK, 7.976 triángulos, 349 KB.

## 2026-10-16 · Blender Add-on Engineer · Hito 2, tanda 2 (`princess`)

- **Entregado:** `public/models/princess.glb`, con los mismos 4 clips que `bro` por ahora. 1,65 m (escala 2D 0,01254), cadera ancha y cintura estrecha, brazos finos. Casquete de rizos rojos (capa con relieve + 42 rizos) y coleta alta de rizos sobre `Tail.1-3` (hijos de `Head`), atada con una goma beige. Top blanco con ribetes beige en el cuello y las mangas, mallas beige de talle alto, zapatillas claras con suela beige y aros pequeños.
- **Materiales:** existen los 10 del contrato. En `princess`, `beard` son las cejas (color del pelo) y `tattoo` es una estrella pequeña en el antebrazo izquierdo, junto a la muñeca.
- **Coleta:** movimiento secundario por fotograma. Cuelga hacia el suelo (0 / 25 / 45 % por segmento) y se retrasa con la aceleración de la cabeza, calculada de forma cíclica para que el bucle cierre. Lo único que hace el visor es reproducir el clip.
- **Validación:** `validate-glb` mide ahora la altura hasta la piel más alta (el cráneo), sin el pelo; con el pelo `princess` llega a 1,70 m. `validate.py` trata el pelo (`Tail.*`) y las aristas de menos de 6 mm como aviso, no como error.
- **Números:** `princess.glb` tiene 11.292 triángulos, 24 huesos y pesa 463 KB (185 KB con gzip); `bro.glb`, 7.976 triángulos y 349 KB. Validan los dos y vitest da 4 OK.

## 2026-10-16 · XR Immersive Developer · Hito 1, visor (peticiones al modelador)

- **Entregado:** `<Figure3D />` en `src/components/figure3d/` y página de pruebas `/dev/figures3d` (`?ex=<id>&char=bro|princess&view=side|front|three-quarter|auto|<grados>&ink=<enfoque>&side=left&tone=light&grid=1` muestra las cuatro vistas). Probado con `bro.glb` y `princess.glb` reales: ambos cargan, animan y se reflejan bien (las caras no salen al revés). Sombreado: 3 escalones (0,55 / 0,8 / 1,0) con luz fija a la cámara, contorno de 2,3 px en `--night` (papel con `tone="light"`), borde tintado con `--ink-lift` del día (papel sobre el cobalto, como pide la biblia de arte §4). `eyes`, `mouth` y `tattoo` van planos, sin luz.
- **Pantalón verde #4d9a26:** se lee bien sobre cinco de las seis tintas en el visor; sobre el jade (`endurance`) es verde sobre verde y solo lo separan el contorno y el borde (visto de perfil en el peso muerto: se entiende, pero es el caso débil). No hace falta tocar la iluminación. Beige y blanco de `princess`: bien también (verificado sobre cobalto y caléndula; sin revisar aún sobre aqua ni rosa).
- **Petición 1, la pesa se lee como una bola blanca.** `bellHandle` (#bcbad3) tiene casi el mismo valor que `bell` (#f4efe2): a 150-250 px el asa desaparece y, de frente y de perfil, las manos tapan el resto. Pido un asa mucho más oscura (p. ej. `--night-3` #21244f) y, si cabe, algo más alta con hueco visible entre asa y cuerpo; una base plana ayudaría a la silueta. Es lo que más resta a la lectura del ejercicio.
- **Petición 2, camiseta negra sin volumen.** `top` #0e0f17 × 0,55 sigue siendo negro: desde 3/4 grande es una mancha plana. Si se puede sin salir del contrato (solo geometría): cuello y dobladillos con relieve o un tono apenas más claro (#171826) en el cuerpo. Decisión del Technical Artist.
- **Petición 3, cejas de `bro` (`hair`).** Las barras gruesas inclinadas dan gesto de enfado en 3/4. Si se busca instructor amable: menos grosor o menos inclinación.
- **Normales suaves.** El contorno es un casco invertido que se infla por la normal de vértice: hoy no hay huecos porque la piel y la ropa tienen normales suavizadas. Si algún día se exportan normales divididas (aristas duras), el contorno se abrirá en esas esquinas: mantenerlas suavizadas.
- **Clips que faltan:** 25 de 29. Mientras no existan, el visor reproduce `idle` (`/dev/figures3d?ex=hip-bridge` lo muestra y lo indica).
- **Al reexportar un GLB:** el service worker sirve `/models/*` con prioridad a la caché y la versión va en la URL (`?v=`). Avisar al coordinador para subir `MODELS_VERSION` en `src/components/figure3d/types.ts`; sin eso, producción seguiría con el GLB viejo. En desarrollo no hay service worker.
- **Triángulos en pantalla:** cada malla se dibuja dos veces (cuerpo + casco de contorno): `bro` 13.524 y `princess` 20.518 por fotograma. Sin problema hoy (≥ 56 fps en una iGPU AMD 610M); si `princess` o los clips con dos pesas crecen, vigilarlo.

## 2026-10-16 · Blender Add-on Engineer · Rediseño de cuerpos y caras (`bro.glb` y `princess.glb` reexportados, 4 clips)

- **Bro, hombre fuerte:**
  - Hombro 3D más afuera (0,21) con deltoides de radio 0,066; torso en V (0,40 m en dorsales, 0,30 en cintura) con pectorales integrados en el perfil.
  - Trapecio y cuello de radio 0,074; bíceps de 0,056 y antebrazo de 0,048; manos más grandes; muslos de radio 0,10.
  - Cara: mandíbula cuadrada bajo la barba, nariz con puente, cejas finas y relajadas (petición 3 del visor), ojos con esclerótica, iris, brillo y párpado, y sonrisa leve sobre la barba.
- **Princess, mujer con curvas:**
  - Hombros de ~0,37 m y caídos, cuello fino, pecho y glúteos integrados en el perfil del torso (sin bolas sueltas), cintura de ~0,23 m y caderas de 0,356, muslos que se afinan, brazos y manos finos.
  - Cara en óvalo con ojos grandes rasgados (brillo, párpado, pestañas), cejas finas arqueadas, nariz pequeña, labios con sonrisa y rubor.
  - Pelo: casquete liso, tirabuzones en sienes y frente, y coleta alta en tirabuzón grande de 3 vueltas sobre `Tail.1-3`. Ya no hay bolitas.
- **Materiales nuevos (opcionales, contrato §4):** `eyewhite` #fbf8f0 (esclerótica y brillo, en los dos personajes) y `blush` #f08c8c (rubor, solo `princess`). Iris, párpado y pestañas usan `eyes`; los labios, `mouth`. Para el visor: pintarlos planos como `eyes`/`mouth`. Los demás nombres no cambian.
- **Pesa (petición 1 del visor):** `bellHandle` pasa a #21244f, el asa es más alta (ventana de ~7 cm entre asa y cuerpo) y la base, más plana. El agarre a la base de la pesa mide ahora 0,18 + 0,078 m.
- **Camiseta (petición 2):** se queda en #0e0f17 (un negro más claro baja de 3:1 sobre el azul); el volumen lo dan la forma ajustada, los pectorales y el cuello y los dobladillos en relieve.
- **Animación:**
  - Los brazos libres guardan una abducción mínima (11° en Bro, 6° en Princess) para no atravesar el torso más ancho.
  - Polo del codo y palma con continuidad entre fotogramas, y un limitador de giro axial de 25° por fotograma: elimina los volteos de 180° de antebrazo y mano que aparecían al probar los 30 clips.
  - Reducción de claves Ramer-Douglas-Peucker con interpolación esférica (tolerancia 0,08° en cadera y piernas, 0,15-0,3° en el resto), con exportación sin muestreo forzado. Los pies siguen plantados (deriva < 1 mm).
- **Validación:**
  - `validate.py`: pies solo en los tobillos fijos de la 2D.
  - Pliegues de flexión profunda (cuello, codo, corva) como aviso hasta ×2,4 / ×0,2.
  - Giros de más de 45° en un fotograma, error; entre 25° y 45°, aviso.
  - `validate-glb` mide la altura hasta la piel más alta (sin pelo) y reconoce los materiales opcionales.
- **Números:** `bro.glb` tiene 9.724 triángulos, 21 huesos y pesa 375 KB (142 KB con gzip); `princess.glb`, 12.012 triángulos, 24 huesos y 445 KB (181 KB con gzip), con 4 clips. validate.py y validate-glb dan OK y vitest, 4/4. Ida y vuelta GLB→Blender: 0,00 mm.
- **Coordinador:** subir `MODELS_VERSION` en `src/components/figure3d/types.ts` (los dos GLB han cambiado).
- **Pendiente:** 26 clips. Ya se generan todos con `--clips all`. Quedan por arreglar el arm bar (pie que voltea, piernas), el molino y el RDL a una pierna (cuello) y revisar a ojo el resto. Tamaño previsto con 30 clips: ~45 % de las claves → unos 0,9-1,1 MB por personaje.

## 2026-10-16 · Blender Add-on Engineer · Bro más fuerte + tanda A de clips (20 clips por personaje)

- **Bro:**
  - Deltoides de radio 0,076 y bíceps de 0,066 (+18 %), antebrazo de 0,056, codo y muñeca más gruesos.
  - Pectorales más marcados (2,8 cm) y dorsales en la espalda; dorsales a 0,41 m y cintura a 0,30 m.
  - Trapecio que baja en pendiente hasta el deltoides (sin escalón de "manga abullonada") y mangas ceñidas a 5 mm del brazo.
  - Cuello de radio 0,086 en la base; muslos de radio 0,11.
  - Los tatuajes siguen visibles. Codos, hombros y sentadilla revisados en las hojas.
  - Dobladillo más bajo y con más vuelo (el muslo ya no asoma). De canto todavía se ve un ligero dentado en el dobladillo.
- **Tanda A (entra completa en los dos GLB):** `one-arm-swing`, `single-leg-rdl`, `hip-bridge`, `prying-goblet-squat`, `front-squat`, `reverse-lunge-racked`, `strict-press`, `push-press`, `floor-press`, `half-kneeling-press`, `one-arm-row`, `high-pull`, `clean`, `snatch`, `clean-and-press`, `bottom-up-press`. Con los 3 anteriores e `idle`, cada GLB lleva 20 clips. `CLIPS_3D` actualizado y `MODELS_VERSION` en "3".
- **Correcciones necesarias:**
  - *Brazo libre en los ejercicios a una mano.* La 2D no lo define y `resolvePose` copia el brazo que trabaja: en 3D el brazo izquierdo "presionaba" una pesa invisible. Ahora cuelga relajado junto al muslo. Se exporta como `free2` en `poses2d.json`.
  - *RDL a una pierna.* Cuello neutro en línea con el tronco, mirando al suelo, según el cue "espalda larga". Variante en `POSES_3D`.
  - *Abducción mínima.* Solo se aplica a brazos que cuelgan; con el brazo arriba volteaba la mano 190°.
  - *Coleta de Princess.* Tumbada, descansa sobre el suelo y ya no lo atraviesa.
  - *Bucle.* Se itera el ciclo hasta que el estado entre fotogramas converge y el último fotograma se iguala al primero.
- **Validación:**
  - Pies plantados en todos los clips: deriva ≤ 1,7 mm, y en la zancada solo el pie de apoyo.
  - Ningún volteo (> 80° en un fotograma). Avisos en la cargada (48°) y el arranque (69°): es el tirón balístico real, codo que sube unos 15 cm por fotograma, no un salto.
  - vitest: 6/6 (modelos + `clips.test.ts`).
- **Tamaños:** `bro.glb` tiene 9.836 triángulos y pesa 827 KB (297 KB con gzip); `princess.glb`, 12.012 triángulos y 928 KB (357 KB con gzip).
- **Siguiente, tanda B:** get-up turco, molino, arm bar, halo, ocho y 5 acarreos. Suman unos 75 s más (el get-up dura 40 s), así que habrá que reducir más claves o remuestrear el get-up para no pasar de 1,5 MB.

## 2026-10-16 · Blender Add-on Engineer · Tanda B de clips (30 clips por personaje: los 29 ejercicios + `idle`)

- **Entran todos:** `turkish-get-up`, `windmill`, `arm-bar`, `halo`, `figure-8`, `suitcase-carry`, `rack-carry`, `farmer-carry`, `bottom-up-carry`, `waiter-carry`. `CLIPS_3D` tiene ya los 29 ejercicios y `MODELS_VERSION` está en "4".
- **Molino, rehecho en 3D.** La 2D lo aproximaba con bisagra sagital más `twist` (giro alrededor de la vertical), que en 3D retorcía el pecho y enterraba la cabeza en el hombro (cuello ×5). Ahora es una bisagra lateral, según los cues:
  - todo el cuerpo girado 45° hacia su izquierda (`OVERRIDES.yaw`) y la bisagra en el plano de los pies;
  - pecho abierto hacia la pesa girando sobre la columna (`roll`);
  - brazo de la pesa vertical, mano libre bajando por la pierna delantera y cabeza girada hacia la pesa.
  - La variante está en `POSES_3D`.
- **Halo:** agarre por los cuernos, con las palmas enfrentadas a lo largo del asa y fijas respecto a la pesa (antes la palma volteaba 90° al cerrar el bucle). Los brazos se reorientan por dirección: con posiciones absolutas, los brazos más cortos de Princess plegaban el codo ×0,13.
- **Arm bar:** el pie que volteaba lo resolvió el limitador de giro axial. Sin errores; quedan avisos de pliegue en rodillas y codo.
- **Get-up turco (40 s):** claves a 15 fps (solo en fotogramas pares) y tolerancia doble. Pasa del 36 % al 16 % de las claves y la ida y vuelta da 0,00 mm. Es el clip del contrato que se desplaza, así que no se comprueban los pies plantados.
- **Acarreos:** caminan en el sitio sobre una "cinta", como en la 2D: los pies se deslizan hacia atrás en el apoyo. Para el visor, si quiere desplazar el suelo: 0,59 m/s en `bro` y 0,55 m/s en `princess` (88 unidades del lienzo por ciclo de 2 s).
- **Validación:** validate.py OK en los dos; `validate-glb --require-all` OK; vitest 6/6; ida y vuelta GLB→Blender 0,00 mm en los 30 clips de `princess`. Sin volteos (> 80°). Avisos: cargada (48°) y arranque (69°), por velocidad balística; pliegues de codo en halo y arm bar; cuello en el molino (×2,2).
- **Tamaños finales:** `bro.glb` tiene 9.836 triángulos y pesa 1.175 KB (426 KB con gzip); `princess.glb`, 12.012 triángulos y 1.298 KB (495 KB con gzip). Los dos por debajo de 1,5 MB y de 800 KB con gzip.

## 2026-10-17 · Blender Add-on Engineer · Princess: glúteos y entrepierna (`princess.glb` y `bro.glb` reexportados)

- **Causa:**
  - El glúteo era un abultamiento gaussiano estrecho (0,028) con borde superior marcado: de perfil parecía una pera pegada.
  - La parte alta del muslo casi coincidía con la superficie de la pelvis: en la bisagra se cortaban en ángulo rasante, con una línea dentada y "dos bolas" de espaldas.
  - Bajo la entrepierna se veían, por el hueco entre los muslos, las manos y la pesa (están delante): eso se leía como piel en el tiro.
- **Corrección (solo forma; mismo rig, nombres y pesos rígidos):**
  - Glúteo un 57 % menos abultado (0,012) y repartido en una curva ancha y continua con cadera y muslo; la pelvis tiene menos fondo.
  - La pelvis envuelve con holgura la parte alta del muslo hasta una entrepierna más baja (z 0,755): el muslo sale por debajo con un pliegue limpio a la altura del pliegue glúteo y la ventana entre los muslos empieza más abajo.
  - Se mantienen las caderas (0,36 m) más anchas que la cintura.
- **Probé y descarté** repartir pesos entre pelvis y muslo: con dos mallas que se solapan colapsaba aristas (×0,03 al caminar).
- **Revisado con `--views atras`** (perfil, 3/4 trasero y espalda) en peso muerto abajo, goblet abajo, puente, zancada, molino y get-up: forma redondeada y continua, sin hueco ni bolas. Bro no tenía el hueco; su forma no cambia.
- **Números:** `princess.glb` tiene 12.124 triángulos y pesa 1.301 KB (497 KB con gzip); `bro.glb`, 9.836 triángulos y 1.175 KB (426 KB con gzip). validate.py y validate-glb dan OK y vitest, 6/6. `MODELS_VERSION` está en "5".

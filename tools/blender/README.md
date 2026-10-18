# tools/blender: personajes 3D por script

Genera `public/models/<id>.glb` (malla con piel, Armature `Rig`, pesas y un clip por ejercicio) desde scripts. Nada se toca a mano en la interfaz de Blender. Contrato: `docs/PERSONAJES-3D-CONTRATO.md`. Arte: `docs/PERSONAJES-3D.md`. Registro entre roles: `docs/PERSONAJES-3D-NOTAS.md`.

## Uso

```bash
npm run characters:build      # poses 2D -> modelo -> clips -> validación -> GLB -> validación del GLB
npm run characters:preview    # hojas de contacto en art/previews/
npm run characters:validate   # solo valida los GLB de public/models (Node, sin Blender)
npx vitest run src/lib/__tests__/models.test.ts
```

Opciones (después de `--` en npm o directamente con `node tools/blender/run.mjs build|preview`):
`--id bro,princess` y `--clips idle,two-hand-swing`. Por defecto: `bro` y los clips del hito 1.
Blender: la variable `BLENDER_EXE` o `C:/Users/rodri/tools/blender/blender-5.2.2-windows-x64/blender.exe` (5.2.2 LTS). Cada paso se puede lanzar suelto:

```bash
blender --background --factory-startup --python-exit-code 1 --python tools/blender/<script>.py -- --id bro
```

## Piezas

| Archivo | Qué hace |
|---|---|
| `spec/characters.json` | Medidas en metros, perfiles de torso y extremidades, paleta (hex) y descripción geométrica de cada rasgo. |
| `common.py` | Rutas, colores sRGB→lineal y contraste WCAG, bases de hueso (`frame3`), IK analítico de dos huesos (`ik2`), normal de flexión (`limb_normal`) y paso del lienzo 2D a Blender (`Canvas`). |
| `build_character.py` | Esqueleto en pose A con los 21 huesos del contrato, malla por perfiles (torso, piernas, brazos, puños, cabeza, barba, cara, aros, tatuajes, zapatillas) con pesos de piel analíticos (≤ 4 por vértice), materiales con color liso y las pesas `Kettlebell`/`Kettlebell2`. Guarda `art/personajes/<id>.blend`. |
| `animate.py` | Una Action por clip, con slots para `Rig`, `Kettlebell` y `Kettlebell2`, y una pista NLA por objeto (así exporta el glTF de 5.2). Por fotograma: pelvis, tronco, cabeza y pies de la 2D; rodillas y codos por IK; claves FK en cuaterniones; pesas horneadas. |
| `validate.py` | En Blender: huesos y materiales, vértices sin peso, influencias, triángulos, pies plantados (≤ 5 mm), bucle cerrado, giros bruscos entre fotogramas y aristas muy estiradas o aplastadas (avisos por articulación). |
| `export_glb.py` | glTF binario, Y arriba, clips por Action, 30 fps con optimización de tamaño, sin UV, cámaras ni luces. |
| `render_preview.py` | Hojas de contacto en Workbench. `--rest` saca la pose A y primeros planos de la cara. `--zoom 1.0 --tz 1.2 --frames 3` hace un detalle con sufijo `_zoom`. `--overview --clips a,b,...` hace una hoja con una fila por clip (lado al 0/25/50 %, 3/4 y frente) y 8 clips por hoja, para revisar tandas. |
| `run.mjs` | Orquesta los pasos (lo llaman los scripts npm). |
| `../../scripts/export-poses2d.mjs` | Ejecuta `rig.ts`/`poses.ts` con Node 24 (quita los tipos y resuelve los imports sin extensión) y escribe `art/personajes/poses2d.json`, un fotograma por cada 1/30 s de una repetición. Lleva el clip `idle` y las variantes 3D (`POSES_3D`). |
| `../../scripts/validate-glb.mjs` | Lee el JSON y el BIN del GLB y aplica las reglas del contrato. También lo usa el test de vitest. |

## Cómo se anima un clip

1. La pose sale de `src/components/figure` (no se edita). Por fotograma, `rig.ts` da la pelvis, el pecho, la cabeza con su orientación, los tobillos, talones y punteras, codos y manos, y la dirección de las pesas. Todo pasa a metros con `scale2d` y origen entre los pies.
2. Las piernas usan los tobillos de la 2D: los pies quedan plantados. Si la postura ancha deja el tobillo fuera de alcance, la pelvis baja esos milímetros (`Solver.drop`).
3. Los brazos 3D son más largos que los 2D, así que se reorientan por dirección: hombro-codo y codo-mano siguen los ángulos 2D. Con dos manos en el asa, las manos se separan 4,5 cm a lo largo de la barra y se resuelve el codo con IK.
4. La palma mira hacia el cuerpo cuando agarra (agarre prono) y el antebrazo absorbe la mitad del giro, para que la muñeca no se retuerza.

Si la 2D no sirve para el cuerpo 3D:
- Pose distinta: `POSES_3D` en `scripts/export-poses2d.mjs`, con el mismo `P()` de `poses.ts`. Ejemplo: el peso muerto, con la cadera más alta.
- Manos fijas en el marco del pecho: `OVERRIDES` en `animate.py`. Ejemplo: el goblet.

Toda desviación se anota en `docs/PERSONAJES-3D-NOTAS.md`.

## Límites conocidos

- Piel lineal (LBS): en flexiones profundas (rodilla del goblet abajo, codo del goblet) la arista exterior se estira ×1,5-1,8 y la interior se aplasta. `validate.py` lo deja como aviso; a la vista se lee como pliegue.
- Las manos son puños fijos (sin hueso `Grip`). Valen para agarrar; en reposo no se abren.
- `art/personajes/poses2d.json` (unos 6 MB) es un intermedio que se regenera en cada build. Conviene ignorarlo en git (decisión del coordinador).
- Las vistas previas de Workbench no son el sombreado cómic del visor. Sirven para juzgar formas, poses y rasgos.

## Personajes realistas (MakeHuman, activos CC0): `mh/`

Desde el 17-oct-2026 `bro` y `princess` son personas de MakeHuman montadas sobre el mismo esqueleto del contrato (los muñecos de perfiles de `build_character.py` quedan como respaldo; su especificación está en `spec/characters.toon.json`).

- **Fuente y licencia:** malla base, pieles, ojos, cejas, pestañas, pelo, ropa y calzado del paquete *MakeHuman system assets* (CC0: sin atribución obligatoria) vía la extensión MPFB 2.0.18 (GPL: solo es la herramienta, no afecta a los modelos). Instalación: `blender --command extension install-file -r user_default --enable mpfb-2.0.18.zip` y descomprimir `makehuman_system_assets_cc0.zip` en `%APPDATA%/Blender Foundation/Blender/5.2/extensions/.user/user_default/mpfb/data`.
- **Definición:** `mh/people.json` (parámetros del cuerpo, piel, pelo, ropa, color de la pesa, retoques de textura).
- **Montaje:** `blender --background --python tools/blender/mh/build_mh.py -- --id bro` (con las preferencias del usuario, donde está activa la extensión; no vale `--factory-startup`). Hace: humano → puño horneado en las manos → articulaciones medidas (`spec/mh_fit.json`, lo lee `common.load_spec`) → esqueleto de 21 huesos → pesos de MPFB repartidos entre sus huesos → materiales PBR con texturas reducidas → pesas → `art/personajes/<id>.blend`.
- **Después, como siempre:** `animate.py`, `validate.py`, `export_glb.py` (con texturas WebP) y `node scripts/validate-glb.mjs`. Los GLB con imágenes se validan con el perfil «realista» (≤ 60 000 triángulos, ≤ 14 texturas de ≤ 1024 px, ≤ 4 MB).
- **Retoques conocidos:** logotipo de la camiseta borrado de la textura (`paint` en `people.json`); calcetín metido 9 mm bajo las mallas ajustadas (`sockFix`).
- **Visor:** `Asset.realistic` (el GLB trae texturas) → materiales PBR tal cual, sin contorno de cómic, luces de estudio (`LOOK.studio`), pelo y pestañas con recorte duro (`alphaTest`).

# Revisión de posturas de los 29 ejercicios

Objetivo: que ninguna postura mostrada pueda inducir a una mala técnica. Se hizo en dos partes: (1) contraste con lo que enseñan las fuentes de técnica de pesa rusa, y (2) **medición de los ángulos de cada animación** (no solo mirarla): `tools/blender/mh/audit_posture.py` vuelca tronco, cuello, cabeza, rodillas, caderas, codos, pelvis y avance de rodilla de cada clip a `art/personajes/audit_<id>.json`.

## 1. Qué dicen las fuentes (resumen)

Fuentes consultadas (guías de entrenamiento y bases de ejercicios; la mayoría son páginas de entrenadores, no estudios clínicos, y no se pudieron leer las normas oficiales de StrongFirst/Dragon Door): [Kettlebell Kings](https://www.kettlebellkings.com/blog/7-most-common-kettlebell-exercises-mistakes), [Nike: swings](https://www.nike.com/a/kettlebell-swings), [Fit&Well](https://www.fitandwell.com/exercise/kettlebell-workouts/many-of-my-students-are-nervous-about-kettlebell-swings-heres-how-to-avoid-the-common-mistakes-beginners-make), [Gym Reapers: figure 8](https://uk.gymreapers.com/blogs/news/kettlebell-figure-8), [Garage Gym Reviews: windmill](https://www.garagegymreviews.com/kettlebell-windmill), [Experience Life: windmill](https://experiencelife.lifetime.life/article/the-kettlebell-windmill/), [Kettlebells Workouts: windmill](https://kettlebellsworkouts.com/teaching-points-for-the-kettlebell-windmill/), [Kettlebells Workouts: clean](https://kettlebellsworkouts.com/teaching-points-for-the-kettlebell-clean/), [BoxRox: snatch](https://www.boxrox.com/?p=229313), [Kettlebells Workouts: press](https://kettlebellsworkouts.com/teaching-points-for-the-kettlebell-overhead-press/), [Breaking Muscle: muñeca en el press](https://breakingmuscle.com/the-proper-wrist-position-for-the-kettlebell-press/), [The Prehab Guys](https://library.theprehabguys.com/?p=19489), [Human Kinetics: arm bar](https://canada.humankinetics.com/blogs/excerpt/try-this-mobility-exercise-the-kettlebell-arm-bar), [NFPT: suitcase carry](https://nfpt.com/suitcase-carries-how-to-do/), [Motra](https://www.motra.com/exercises/kettlebellArmBar), [Peloton: halo](https://www.onepeloton.com/blog/kettlebell-halos), [Healthline: goblet](https://healthline.com/health/fitness-exercise/dumbbell-goblet-squat), [Nuffield Health: remo](https://www.nuffieldhealth.com/article/how-to-kettlebell-row).

Criterios que se repiten y que se usaron como regla:

| Patrón | Qué debe verse | Qué NO debe verse |
|---|---|---|
| Bisagra (swing, peso muerto, remo, ochos, RDL) | Cadera atrás, espalda neutra, **cuello neutro** (mirada 2–3 m delante en el suelo), la cadera hace el trabajo y los brazos solo guían | Sentadilla en lugar de bisagra, redondear la lumbar, **barbilla muy arriba**, inclinarse hacia atrás arriba, brazos tirando |
| Sentadillas / zancada | Talones abajo, rodillas siguen los pies, torso erguido, rodilla delantera sobre el tobillo | Rodillas hacia dentro, talones despegados, pecho caído |
| Presses y bloqueo arriba | Muñeca neutra, codo bajo la pesa, costillas abajo, sin arquear | Arco lumbar, inclinación hacia atrás, muñeca doblada hacia atrás |
| Clean / snatch | Pesa cerca del cuerpo, la mano pasa por el asa, cuello neutro arriba | Arco amplio hacia delante, tirar con el brazo, golpe en el antebrazo/muñeca |
| Windmill / arm bar / TGU | Bisagra (no inclinación lateral), pesa estable sobre el hombro, hombro «enchufado», ojos en la pesa **si el cuello lo permite**, empezar sin peso | Doblar la cintura, perseguir profundidad, hombro hacia la oreja |
| Acarreos | Tronco erguido, hombros nivelados, **paso normal** | Inclinarse hacia el lado de descarga, rodillas altas, encoger hombros |

## 2. Qué se midió y qué se corrigió

Los modelos se mueven con una columna rígida (pelvis → pecho en línea recta), así que **no pueden mostrar espalda redondeada ni lordosis**: eso es seguro por construcción. Lo que sí puede estar mal es la cabeza, el cuello, las rodillas, la inclinación y el paso.

| Hallazgo | Antes | Después | Qué se hizo |
|---|---|---|---|
| Cabeza muy extendida («barbilla arriba») en las bisagras | hasta −52° respecto al tronco en swing, clean, snatch, peso muerto y remo; −37° en ochos | −18…−24° (swing −19, peso muerto −18, remo −24, ochos −20) | La cabeza acompaña al tronco (`gaze` y `neck` por defecto en `poses.ts`; remo y ochos ajustados) |
| Acarreos con marcha de rodillas altas (92° de flexión) | 92° | 80° y paso natural | Elevación del pie 15 → 9 en la marcha |
| Mirada del molino siempre arriba | cuello extendido hasta −38° | misma mirada «si el cuello lo permite» | Consejo reescrito; el cuello sigue siendo el límite |
| Tronco hacia atrás al bloquear | −2…−5° | sin cambio (dentro de ±5°) | Se deja: es la columna vertical |
| Rodillas hacia dentro (valgo) | máx. 1 cm hacia dentro en los ejercicios de pie | sin cambio | Correcto |
| Bisagra o sentadilla | swing: cadera 109° de flexión / rodilla 45° (bisagra); goblet: cadera 102° / rodilla 113° (sentadilla) | sin cambio | Correcto |
| Rodilla delantera en la zancada | 2 cm por delante del tobillo | sin cambio | Correcto |

Resumen por ejercicio (Bro; Princess da valores casi iguales). Tronco = inclinación respecto a la vertical (+ delante, − atrás); cabeza = respecto al tronco (− extendida).

| Ejercicio | Tronco | Cabeza | Rodilla máx. | Valgo máx. |
|---|---|---|---|---|
| Peso muerto | 0…60 | −18…0 | 69 | 0 cm |
| Swing 2 manos / 1 mano | −4…65 | −19…0 | 45 | 1 cm |
| RDL 1 pierna | 0…82 | −12…0 | 6 | — |
| Goblet / con apertura / frontal | 2…14 / 2…26 / 0…8 | −4 / −8 / −2 | 113 / 129 / 116 | 0 cm |
| Zancada atrás | 0…4 | −1…0 | 104 | — |
| Press estricto / push press / media rodilla / bottom-up | −2…4 | 0…8 | 5 / 59 / 107 / 5 | 1 cm |
| Remo | 62 | −24 | 57 | −3 cm (hacia fuera) |
| Tirón alto / clean / snatch / clean+press | −5…65 | −19…8 | 45 | 1 cm |
| Molino | −1…73 | −38…4 | 74 | — |
| Halo | 0 | 0 | 2 | 0 cm |
| Ochos | 55 | −20 | 68 | −7 cm (hacia fuera) |
| Acarreos (5) | −1…2 | −1…5 | 80 | 1 cm |
| Puente, press en el suelo, arm bar, get-up | tumbados: se revisaron a ojo (columna recta hombros-cadera-rodillas arriba del puente, brazo vertical) | | | |

## 3. Textos de técnica

Se revisaron los consejos y el «error común» de los 29 ejercicios. Cambios: cuello neutro en el peso muerto; swing sin inclinarse hacia atrás arriba; molino como bisagra (no inclinación lateral), «baja solo hasta donde mantengas la espalda recta», evitarlo con dolor de hombro o lumbar y aprender sin peso; arm bar: parar con tensión en cuello, hombro o lumbar; acarreo mesero: si no se puede bloquear el brazo sin arquear, usar el rack; snatch: si golpea la muñeca, volver al clean y al tirón alto; halo: mover la pesa y no la cabeza; RDL: rodilla de apoyo no bloqueada; acarreos: «camina erguido» en lugar de «camina alto» (se podía leer como rodillas altas). La ficha técnica lleva ahora el aviso «una demostración no sustituye a un entrenador; con dolor, para».

## 4. Límites y lo que falta

- Las fuentes son de entrenadores y bases de ejercicios; **no se leyó el material oficial de StrongFirst/Dragon Door**. Conviene que lo revise un entrenador certificado antes de publicar.
- El molino tiene el giro de pelvis de 45° del clip, que hace subir la medida de inclinación lateral; se revisó a ojo en perfil y frente.
- Los tumbados (puente, press en el suelo, arm bar, get-up) no tienen medidas de tronco (las medidas asumen de pie).
- No se mide la muñeca: la mano sigue la dirección del antebrazo (neutra) por construcción.

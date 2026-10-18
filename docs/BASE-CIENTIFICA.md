# Base científica de kettellbro

Resumen para producto. El detalle completo (cita, diseño, muestra, limitaciones y enlace de cada estudio) está en [`research/estudios.md`](research/estudios.md); los protocolos y la técnica, en [`research/protocolos.md`](research/protocolos.md); los datos que consume la app, en [`research/evidence.json`](research/evidence.json) (71 citas verificadas contra PubMed/DOI) y [`research/ejercicios.json`](research/ejercicios.json).

> **Regla del producto:** la app muestra rangos y lenguaje prudente ("puede", "en estudios pequeños"), cada bloque cita estudios con su nivel de evidencia (A-D) y **nunca promete lo que la literatura no respalda**.

## 1. Metodologías

| Método | Qué es | Fuente | Cómo lo usa kettellbro |
|---|---|---|---|
| **Hardstyle** (P. Tsatsouline, StrongFirst) | Pesa rusa como herramienta de fuerza y potencia: bisagra de cadera explosiva, tensión de todo el cuerpo, series submáximas y frecuentes | *Enter the Kettlebell*, *Simple & Sinister* | Base de potencia, fuerza y técnica |
| **Simple & Sinister** | 10 swings a una mano cada 30 s hasta 100 y 10 get-ups (1 por minuto). Estándares publicados: *Simple* (swing 32 kg hombres / 24 kg mujeres; get-up 32 / 16) y *Sinister* (swing 48 kg hombres / 32 mujeres; get-up 48 / 24) | StrongFirst (oficial) | Formatos "10 reps por serie", EMOM y get-up 1 por minuto (adaptados) |
| **Rite of Passage / escaleras 1-2-3** | Escaleras por lado con calidad alta y volumen moderado | P. Tsatsouline | Empujes de la semana de pico |
| **Armor Building Formula** | Complejo clean-press-sentadilla frontal | P. Tsatsouline / Dan John | Complejos del día híbrido (con una pesa) |
| **Easy Strength / Greasing the Groove** | Series submáximas, nunca al fallo, práctica frecuente | Dan John, P. Tsatsouline | Fuerza sin fallo; práctica de bisagra en el día de técnica |
| **Girevoy Sport** (kettlebell sport) | Series de 10 min de jerk, snatch o long cycle, con cambio de mano, a cadencia fija | Federaciones IGSA/IUKL | Series largas recreativas de clean con cambio de mano; snatch 15:15 solo avanzados |

Los datos numéricos de las federaciones de Girevoy Sport y algunos de Dan John **no se pudieron confirmar** en fuente primaria; están marcados como tales en `protocolos.md` y no se usan en la lógica del motor.

## 2. Qué respalda la evidencia (y con qué fuerza)

| Beneficio | Evidencia | Nivel | Lectura honesta |
|---|---|---|---|
| **Potencia y fuerza** con swings | Lake & Lauder 2012: 21 hombres, 6 semanas, 2 días/semana de swings 30 s/30 s: media sentadilla 1RM ≈ +9,8 % y salto vertical ≈ +19,8 %, sin diferencia frente a jump squats | B | Sin grupo inactivo: no se separa del efecto de aprendizaje |
| Fuerza y potencia en adultos | Manocchia 2013 (n = 37): mejora del press de banca, tendencias en otras pruebas | B | Resultados mixtos |
| Frente a halterofilia | Otto 2012: la halterofilia dio más fuerza que el kettlebell | B | El kettlebell **no reemplaza** a las pesas con barra |
| **Dolor** de cuello/hombros y lumbar | Jay 2011 (RCT, n = 40, 8 semanas, 3 días/semana): −2,1 y −1,4 puntos (0-10) frente al control | B | Un solo RCT, trabajadores con dolor leve a moderado; no es tratamiento |
| **Costo cardiovascular** | Farrar 2010: 12 min de swings con 16 kg ≈ 65 % del VO2máx y 87 % de la FCmáx; Hulsey 2012 y Thomas 2014: intensidad moderada a alta, **menor que correr a igual esfuerzo percibido** | C | Orden de magnitud sólido; cifras exactas, no |
| **VO2máx** | Falatic 2015 (n = 17): snatch 15:15, 4 semanas, +6 % | B | Pequeño y corto; Jay 2011 no halló mejora aeróbica con swings |
| Biomecánica | McGill 2012: swing ≈ 50 % de la contracción máxima lumbar, ≈ 80 % de glúteos; ≈ 3.200 N de compresión (por debajo del límite NIOSH) con un cizallamiento posterior L4-L5 inusual | C | Describe cargas; **no** predice lesiones |
| Get-up | St-Onge 2019: mayor demanda de hombro en las etapas del codo y del barrido de pierna | C | Descriptivo |
| **Principios de programación** | ACSM 2026 (137 revisiones), Schoenfeld 2017/2019, Williams 2017, Grgic 2018, Androulakis 2020 | A | Evidencia de entrenamiento de fuerza **en general**, extrapolada |
| Autorregulación por RPE/RIR | Zourdos 2016, Helms 2016, Halperin 2022 | B-D | Útil para tendencias; error medio ≈ 1 repetición |
| Descarga | Consenso Delphi (Bell 2023), encuesta (Rogerson 2024) | D | Sin ensayos que prueben el beneficio |
| Sesiones cortas (≤ 25 min) | Androulakis 2020 (6 estudios): una serie, 1-3 veces por semana, aumentó el 1RM; Iversen 2021: priorizar multiarticulares y calentamiento específico | A-D | Evidencia de fuerza general; base de una decisión de diseño |
| Pesarse (semanal) | Zheng 2015 (revisión), Madigan 2015 (meta-análisis: diario no superó a semanal), Steinberg 2014 (RCT n = 91, sin daño psicológico) | A-B | Estudios de control de peso, no de entrenamiento con pesas |
| Volver tras una pausa | Mujika & Padilla 2000; Bosquet 2013 | A-D | La fuerza se pierde despacio; se retoma con menos volumen |

**Calidad global de la evidencia específica de kettlebell: baja a muy baja** (revisión de alcance de Meigh 2019; no existe ningún meta-análisis específico). Los ensayos duran 4-12 semanas con 2-3 sesiones por semana y ninguno prueba un "reto de 30 días" seguido.

## 3. Lo que NO se afirma en la app

Resumido de `estudios.md` (21 puntos). Entre ellos:

- "Quema 1.200 kcal por hora" o "más que correr": lo medido por vía aeróbica fueron ≈ 13,6 kcal/min en un informe sin revisión por pares (n = 10); la cifra de 20 kcal/min suma una estimación anaeróbica indirecta.
- "Tonifica", "quema grasa localizada", "efecto afterburn masivo" (≈ 55 kcal extra).
- "Cura o protege la espalda" o "los swings mejoran el sprint".
- "Tabata transforma tu cuerpo": el estudio original usó bicicleta a ≈ 170 % del VO2máx con 7 personas.
- "Hay que llegar al fallo" o "hay que contar el RIR exacto".
- "El deload es obligatorio" o "la periodización es obligatoria".
- Kcal exactas por usuario: un MET es un promedio poblacional.

## 4. Cómo se refleja en el producto

- Cada bloque del plan lleva `evidence[]` y se abre con **Respaldo científico** (diseño, tamaño de muestra, hallazgo y nivel A-D).
- Los métodos de práctica (Simple & Sinister, Rite of Passage...) se muestran como "método", **no como estudio**.
- El cribado inicial, las puertas de seguridad para principiantes y el modo de cuidado de espalda baja salen de `protocolos.md` §8 y §11.
- Los retos de 30 días se reencuadran: la ciencia respalda **3 sesiones por semana durante 4 semanas o más**; no hace falta hacer swings todos los días ni cientos por hora.

# Motor de rutinas de kettellbro

Código: [`src/lib/engine`](../src/lib/engine). Es **puro** (sin red, reloj ni disco): recibe datos y devuelve datos. Por eso es determinista, se prueba con vitest (`npm test`) y funciona igual en cliente, servidor o sin conexión.

## 1. Idea central

> Día N → fase del ciclo → enfoque del día → bloques con formato y carga → pasos que reproduce el acompañante → resultado que ajusta el Día N+1.

```
 estado guardado ──┐
 ajustes ──────────┼─► generateSession() ─► SessionPlan ─► compileSteps() ─► player
 memoria RPE/pesas ┘                                               │
                                                                    ▼
          applySessionResult() ◄── SessionLog (reps, pesas, RPE, sensación)
```

La rutina de un día **nunca es aleatoria**: la semilla es `UID + número de día`. Recargar la app, cambiar de teléfono o abrir la sesión en otro dispositivo da exactamente la misma carta. Cada usuario tiene su propio orden de rotación de ejercicios (barajado con su UID), así que dos personas con el mismo nivel no hacen lo mismo el mismo día.

## 2. Calendario (variar intensidad, volumen y enfoque a largo plazo)

| Escala | Regla | Archivo |
|---|---|---|
| Microciclo (7 días) | Plantilla de 7 enfoques según el tema del mes. 5 días de trabajo + 2 de recuperación activa; los días de potencia nunca son consecutivos; los patrones básicos (bisagra, sentadilla, empuje, tirón, acarreo) se reparten a lo largo de la semana | `calendar.ts` |
| Mesociclo (4 semanas) | Semana 1 acumulación (RPE ≈ 6,5) → 2 construcción (7) → 3 pico (8) → 4 **descarga** (5,5 y ~40 % menos volumen) | `calendar.ts` |
| Tema del mesociclo | Fundación → Fuerza → Potencia → Acondicionamiento, repetido sin fin; la meta del usuario (fuerza, potencia, resistencia) inclina el orden | `calendar.ts` |

Plantillas semanales (cada slot es un día del microciclo):

| Tema | L | M | X | J | V | S | D |
|---|---|---|---|---|---|---|---|
| Fundación | Técnica | Fuerza | Resistencia | Recup. | Potencia | Fuerza | Recup. |
| Fuerza | Fuerza | Potencia | Recup. | Fuerza | Resistencia | Técnica | Recup. |
| Potencia | Potencia | Fuerza | Recup. | Potencia | Híbrido | Resistencia | Recup. |
| Acondicionamiento | Resistencia | Fuerza | Recup. | Híbrido | Potencia | Resistencia | Recup. |

Los enfoques son: **Potencia** (balístico de cadera), **Fuerza** (empujes, tirones, sentadillas, bisagras lentas), **Resistencia** (series largas e intervalos), **Híbrido** (complejos), **Técnica** (get-up y control) y **Recuperación** (flujos suaves; permite marcar descanso total y mantiene la racha).

"Día N" es el N-ésimo día del programa del usuario y **avanza al completar** (no por calendario): perder un día no te salta bloques ni te castiga.

## 3. De enfoque a bloques

1. **Presupuesto de tiempo.** `minutos` (**10 / 15 / 20 / 25, máximo 25**; los ajustes antiguos de 35 o 45 pasan a 25) menos calentamiento (2-4 min) y vuelta a la calma (0-1 min). Se reparte por enfoque: p. ej. Potencia 60 % principal / 28 % complemento / 12 % acarreo; Fuerza 50/36/14. La fase escala el uso del tiempo (acumulación 90 %, construcción 100 %, pico 95 %, descarga 60 %).
2. **Selección.** Pools por patrón y nivel; el ejercicio de cada slot rota con un orden barajado por usuario (`rng.ts › rotate`), de modo que no se repite hasta agotar el pool. Los ejercicios de dos pesas solo salen si el usuario tiene un par. Solo se usan pesas del inventario del usuario.
3. **Formato.** Cada enfoque tiene formatos documentados; la fase y el nivel eligen cuál:

| Formato | Origen | Cuándo |
|---|---|---|
| Series de 10 swings con pausa corta | "Simple" de Simple & Sinister (P. Tsatsouline) | Potencia, todos los niveles |
| EMOM: 10 repeticiones al inicio de cada minuto, manos alternas | Adaptado de Simple & Sinister | Potencia, intermedio+ |
| Intervalos 30 s / 30 s (20/40 para principiantes) | Protocolo del RCT de Lake & Lauder 2012 | Potencia y resistencia |
| Intervalos 40/20 | Diseño propio con base en HIIT general | Resistencia |
| Series largas con cambio de mano cada minuto | Girevoy Sport a cadencia recreativa | Resistencia, intermedio+ |
| Snatch 15 s / 15 s | Protocolo medido en ACE 2010 y Falatic 2015 | Resistencia, solo avanzado |
| Series 3-5 × 5-10 con descanso 75-120 s, nunca al fallo | Easy Strength; ACSM 2026; Grgic 2018 | Fuerza |
| Escaleras 1-2-3 por lado | Rite of Passage (P. Tsatsouline) | Fuerza, semana de pico (empujes) |
| Complejos (clean-press-sentadilla, swing-sentadilla) | Armor Building Formula (adaptada a una pesa) | Híbrido |
| Get-up: 1 por minuto alternando lado | Simple & Sinister | Técnica, intermedio+ |

   Cada bloque guarda `evidence[]` (estudios verificados que respaldan formato, volumen o descanso) y `methodEs` (método de práctica que inspira la estructura; **no se presenta como estudio**).
4. **Relleno.** Se dimensiona cada bloque compilando de verdad los pasos (`blockEstimateSec`) y se rellena el tiempo sobrante subiendo un incremento (serie, minuto, ronda) mientras quepa.
5. **Calentamiento RAMP** (halo, apertura de cadera, puente, 5 repeticiones ligeras del patrón del día) y vuelta a la calma.

## 4. Carga: pesas discretas y progresión

Las pesas rusas suben de 4 en 4 kg (un salto de 14-50 %). Para no pedir saltos imposibles:

- **Primera pesa:** `referenceKg × loadFactor` del ejercicio, redondeada a la pesa más cercana que tiene el usuario. Los `loadFactor` son heurísticas de coaching (swing 1,0; goblet 0,9; press 0,4; get-up 0,3...), no cifras de estudio.
- **Etapas 0 → 4 por ejercicio.** Cada sesión completada con RPE ≤ objetivo + 0,5 suma una etapa. En las etapas 1, 2 y 3 **¼, ½ y ¾ de las series** se hacen ya con la pesa siguiente (mezcla de cargas). En la etapa 4 esa pesa pasa a ser la base y la etapa vuelve a 0.
- **Retroceso:** si la sesión no se completa, el RPE sube ≥ 1,5 sobre el objetivo o la sensación fue "durísima", baja una etapa (y, si ya estaba en 0 y no se completó, una pesa).
- **Sin progreso** en semana de descarga ni en sesiones de reingreso.
- Si llegas a tu pesa más alta, se sugiere la siguiente (`suggestedNextBell`).

## 5. Autorregulación

| Señal | Efecto en la siguiente sesión |
|---|---|
| Sensación "durísima" o RPE ≥ 9 | Volumen × 0,85 |
| Sensación "fácil" y RPE ≤ 5 | Volumen × 1,05 (tope del presupuesto) |
| ≥ 4 días sin entrenar | Reingreso: volumen × 0,7 y RPE −0,5 |
| ≥ 10 días sin entrenar | Reingreso: volumen × 0,5 |

El RPE se pide al final de cada sesión con su equivalencia en repeticiones en reserva (escala RIR). La literatura advierte que el RIR se estima con ~1 repetición de error (peor en series largas), por eso se usa para **ajustar tendencias**, no para prescribir con precisión (`halperin2022`).

## 5b. Sesiones cortas (máximo 25 minutos)

La sesión dura **como máximo 25 minutos en total**, con 20 min como valor recomendado. Es una decisión de diseño con respaldo indirecto: con **volumen bajo ya se obtienen ganancias de fuerza** (Androulakis 2020: una serie, 1-3 veces por semana, bastó en los 6 estudios incluidos) y, para el tiempo disponible, se recomienda priorizar ejercicios multiarticulares y calentamiento específico (Iversen 2021). Además, la constancia diaria pesa más que la sesión larga ocasional. El volumen de cada ejercicio tiene **topes** (`volumeCap`): lo que sobra del tiempo se llena con un bloque complementario de otro patrón, no con más series del mismo ejercicio. La vuelta a la calma activa se omite en sesiones de 10 min (poca evidencia, Van Hooren 2018).

## 5c. Pesas según tu cuerpo, y pesajes dentro del plan

**Registro de pesas.** El usuario marca las pesas que tiene (y si tiene dos iguales); queda en `meta/settings` y la app solo programa con ellas. Cada serie guarda la pesa usada, y por ejercicio se conserva la pesa actual, la mejor serie y la etapa de progresión (se ve en *Mis pesas y mi cuerpo*).

**Recomendación por peso y estatura** (`src/lib/engine/body.ts › recommendBells`). Es una **heurística de coaching**, no un dato de estudio:
- Peso corporal **ajustado por estatura**: se usa el menor entre el peso real y 120 % del peso de un IMC de 24,9; con IMC < 18,5 se baja 10 %. La estatura es un freno conservador, no una fórmula fisiológica.
- Pesa de referencia (swing a dos manos) ≈ 17 % del peso ajustado en nivel novato, 25 % en intermedio y 35 % en avanzado, redondeada a una talla real (4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32...), con tope de 16 / 24 / 32 kg por nivel (un principiante no arranca con 24 kg aunque pese 110 kg).
- Se devuelven: rango razonable (±3 puntos porcentuales), pesa ligera (para get-up, press, halo y acarreos), siguiente meta y un **set de compra** de tres pesas.
- Anclas de la heurística: rangos de partida publicados por StrongFirst y Dan John (hombres 12-16 kg, mujeres 8-12 kg al empezar) y la regla "las pesas se sienten más pesadas de lo que dicen". La progresión por RPE corrige cualquier desajuste.
- Se pide el **test de la pesa correcta**: 10 swings a dos manos con la última repetición igual que la primera; si el agarre falla antes de la 10 o la espalda se redondea, bajar una pesa.

**Pesajes y revisiones** (`dueCheckIns`). Aparecen en *Hoy* como "Pendiente en tu plan":
- **Pesaje semanal (cada 7 días)**, mismo día, en ayunas y tras ir al baño; se mira la **tendencia de 4 semanas**, no un número aislado. Evidencia: pesarse con regularidad se asoció con mejores resultados y sin efectos psicológicos adversos (Zheng 2015; Steinberg 2014 en RCT de 6 meses con pesaje diario), y pesarse a diario no superó a hacerlo una vez por semana (Madigan 2015). Son estudios de control de peso: para entrenar con pesas es una guía práctica, no un hallazgo específico.
- **Revisión mensual de la pesa de referencia (cada 28 días)**, una vez por mesociclo.
- Todo es opcional: sin peso y estatura la app entrena igual y no pide pesajes.

## 6. Puertas de seguridad

Derivadas de `docs/research/protocolos.md` §8 y §11:

- Cribado de salud al inicio (banderas de PAR-Q+): con señales de alarma el onboarding exige confirmar que se consultó a un profesional.
- **Principiantes:** las 2 primeras semanas no hay swings ni balísticos (el día de potencia es peso muerto + goblet + acarreo); desde la semana 3 el volumen de swings entra en rampa (4 series, +2 por semana) en vez de 100 de golpe. Sin Tabata ni snatch. El get-up arranca con la pesa más ligera.
- **Cuidado de espalda baja:** sin ningún ejercicio balístico; potencia pasa a fuerza, híbrido a técnica y el cardio se hace con goblet por intervalos.
- Nunca se prescribe "hasta el fallo".
- Se muestran rangos y no se promete gasto calórico.

## 7. Pasos que reproduce el acompañante

`compileSteps(plan)` convierte cada protocolo en una lista lineal de pasos de **trabajo** y de **descanso**, y **todo paso dura una cantidad exacta de segundos**: no existe el botón *Hecho* ni la pregunta «¿ya terminaste?». Un paso de series dura `reps × cadencia del ejercicio`; un EMOM, 60 s por minuto; un complejo, la suma de sus ejercicios; los intervalos, su ventana. Cada paso de trabajo lleva su **preparación** (`prepSec`: 5 s al abrir un bloque, 3 s tras un descanso o un cambio de lado, 0 s entre minutos seguidos de un EMOM) y esa preparación **cuenta dentro del tiempo de la sesión**. El player lleva el reloj: avanza solo al llegar a cero, cuenta las repeticiones según la cadencia (con un toque por repetición), muestra las etapas del get-up cuando toca, y siempre enseña cuánto queda de la sesión. Hay pausa, saltar y `+10 s`. Se guarda un **borrador tras cada paso** para reanudar si se cierra la app (los borradores de versiones anteriores del motor se descartan).

### Duración exacta («si dice 20, son 20»)

`generateSession` termina con `fitExact`, que cuadra la sesión con los minutos elegidos (±10 s; en la práctica ≤ 4 s): si se pasa, recorta volumen del final hacia el principio; si le falta, añade trabajo complementario real (un patrón que hoy no se tocó), alarga los descansos entre series (la recuperación entre series es legítima) y solo el resto corto lo absorbe la vuelta a la calma con respiración y movilidad; un ajuste fino de descansos clava los últimos segundos. El plan guarda `durationSec` (exacto) además de `durationMin`. La recuperación activa conserva su propia duración (máximo 12 min).

## 8. Pruebas (`npm test`)

Verifican: determinismo; variedad en 365 días (> 40 combinaciones, sin repetir título dos días seguidos); solo ejercicios de la biblioteca; solo pesas del usuario; sin ejercicios de dos pesas sin par; principiantes sin ejercicios avanzados en 6 semanas ni swings antes del día 15; espalda baja sin balísticos; descarga con RPE menor; duración exacta (±10 s) en los cuatro tiempos, los tres niveles y 120 días; todo paso de trabajo medido en segundos; cada bloque cita evidencia; progresión (sube de pesa, no retrocede por RPE bajo); racha con escudos; metas derivadas.

## 9. Límites honestos

- Los principios de programación (volumen, frecuencia, descanso, fallo) son evidencia de **entrenamiento de fuerza general** extrapolada a la pesa rusa; la evidencia específica de kettlebell es de calidad baja a muy baja (ver [BASE-CIENTIFICA.md](BASE-CIENTIFICA.md)).
- La semana de descarga cada 4 semanas es una decisión de diseño con respaldo de consenso de expertos, no de ensayos.
- Los `loadFactor` y las cadencias son heurísticas de coaching.
- El tonelaje de bloques cronometrados (EMOM, intervalos) se estima con la cadencia del ejercicio.

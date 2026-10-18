# Plan estratégico: que cada ejercicio se entienda y se pueda imitar

Objetivo: quien abre la app debe ver **qué hacer, en qué orden y por dónde se mueve la pesa** sin leer nada. Hoy no se cumple: en el halo no se entiende qué hace el personaje.

## 1. Diagnóstico (con capturas del visor a tamaño móvil)

| # | Hallazgo | Por qué estorba |
|---|---|---|
| 1 | El personaje ocupa ~40 % del encuadre (cabeza ≈ 25 px). Sobran suelo, piernas y márgenes. | El movimiento que importa (brazos, pesa, cabeza) se ve minúsculo. |
| 2 | La pesa es blanca y Princess lleva top blanco: **se confunden**. | La pesa es el protagonista y desaparece. |
| 3 | No hay nada que dibuje **el recorrido** de la pesa. | En halo, swing, ocho o molino el camino ES el ejercicio. |
| 4 | No se sabe **en qué fase** del movimiento está (sube, baja, pausa). | No se puede sincronizar la respiración ni el ritmo al imitar. |
| 5 | La vista por defecto no siempre es la que enseña el ejercicio; la parte trasera de Princess se veía mal. | Un ángulo malo parece un fallo de la app. |

## 2. Qué hace la competencia y qué aprendemos

Fuentes: búsquedas de la sesión y práctica habitual de las apps de entrenamiento.

- **Demos como herramienta principal de enseñanza**, con una demostración breve antes de cada movimiento (Sworkit). → Nuestro 3D ya anima cada ejercicio; falta la claridad.
- **Pantalla de entrenamiento limpia y legible de un vistazo**: solo lo esencial, con contraste alto y tamaños grandes (guías de diseño de apps de fitness). → No añadir ruido: una capa de ayuda **mínima** (recorrido + 3 fases) y nada más.
- **Modelos 3D con músculos resaltados y vistas giratorias** (iMuscle, Fitbod) y bucles cortos de 5-15 s con la zona activa iluminada. → Ya tenemos vistas giratorias; añadimos lo que ellas no suelen tener: **el recorrido de la pesa** (específico de la pesa rusa).
- **Fallos típicos del halo según Peloton, Tom's Guide, SetForSet y Fitbod**: ir demasiado rápido, abrir los codos, mover la cabeza, arquear la espalda, pesa excesiva. → Nuestras fases y consejos deben decir exactamente lo contrario (codos cerca, pesa rodea la cabeza, cabeza quieta).

Nuestra ventaja: personaje propio en 3D con cuatro vistas, ritmo exacto por segundos y consejos de técnica citados. Lo que la competencia no hace: **dibujar el recorrido de la pesa** y **marcar la fase en vivo**.

## 3. Decisión

Se descartó rehacer los dibujos desde cero: el 3D ya resuelve los ángulos y el problema no es el estilo, sino **cuánto se ve y qué se enseña**. Se mejora la presentación y se revisa el estilo solo si la revisión visual lo exige.

## 4. Mejoras, por impacto

1. **Encuadre pegado al movimiento** (alto): zoom al tronco superior en halo y presses, margen menor en el resto.
2. **Pesa protagonista** (alto): color propio por personaje (oscura sobre Princess, clara sobre Bro), un 20 % más grande, asa visible.
3. **Recorrido de la pesa** (alto): puntos blancos con borde oscuro que dibujan el camino de la pesa en cada repetición (círculo del halo, arco del swing, ∞ del ocho).
4. **Fases en vivo** (medio): tres fichas bajo la figura («Pesa al pecho · Rodea la cabeza · Vuelve»), con la actual resaltada y sincronizada con el movimiento.
5. **Vista y suelo por ejercicio** (medio): cada ejercicio con la vista que mejor lo enseña; en las tarjetas, vista de tres cuartos.
6. **Banco de pruebas visual** (proceso): una página que muestra los 29 ejercicios a tamaño real en tres fases para revisarlos uno a uno.

## 5. Criterios de calidad (se comprueban con capturas)

- La cabeza mide ≥ 45 px a tamaño de reproductor (hoy ≈ 25).
- La pesa se distingue del cuerpo en los dos personajes sobre los seis colores de carta.
- En halo, swing, ocho y molino se lee el recorrido sin explicación.
- Ningún texto de la capa de ayuda se superpone a otro a 320, 360 y 390 px.
- Con el 3D desactivado o sin WebGL sigue funcionando la figura 2D.

## 6. Registro de revisión

Método: página `/dev/legibilidad` (solo desarrollo) con los 29 ejercicios a 200 y 300 px sobre colores de carta distintos, en las fases 0,05 / 0,4 / 0,75, para Bro y Princess; después, el reproductor a 320, 360 y 390 px, con el 3D activado y desactivado.

**Vuelta 1: lo que se vio**
- Caras de ~25 px y mucho aire alrededor; en los ejercicios de pie las piernas ocupaban media escena sin enseñar nada.
- El recorrido del halo seguía el agarre (altura del hombro) y no el cuerpo de la pesa.
- A 200 px Princess parecía llevar gafas de sol (iris grande y párpado oscuro rellenaban el ojo).
- Las fichas de fases se pisaban en tarjetas estrechas; los ejercicios en el suelo salían diminutos (el disco de suelo condicionaba el encuadre); el arm bar se veía de frente, acortado.
- El nombre de la carta de «Hoy» se cortaba a 360 px; con 600 px de alto la columna de vistas tapaba las fichas.

**Vuelta 1: lo que se corrigió**
- Encuadre más justo (`FRAME = 0.9`, márgenes menores), recorte por altura en halo/presses y acarreos, sin disco de suelo en tumbados, arm bar de perfil.
- Recorrido en cola de cometa sobre el centro de la pesa; cámara a +32° en el halo.
- Ojos de Princess rehechos (GLB regenerado, `MODELS_VERSION = "6"`).
- Fichas de fases: solo la actual lleva texto; sincronizadas en el reproductor y en la ficha técnica.
- Cartas en tres cuartos y nombre que se encoge hasta caber; columna de vistas oculta en pantallas bajas.

**Veredicto del usuario tras la vuelta 1:** «no veo mejora». Eran correcciones de presentación; el límite está en el propio arte de los personajes. Sigue `docs/PLAN-PERSONAJES-V2.md`. Esta vuelta no se despliega como entrega.

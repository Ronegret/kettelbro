# Plan v2: que se vea cómo hacerlo y que enamore

Escrito tras el veredicto «no veo mejora» sobre la vuelta 1 de [PLAN-VISIBILIDAD-EJERCICIOS.md](PLAN-VISIBILIDAD-EJERCICIOS.md). Aquel plan pulió la presentación; este ataca lo que de verdad limita.

## 1. Diagnóstico sincero, por impacto

| # | Problema | Evidencia |
|---|---|---|
| 1 | **La demostración es pequeña.** Es lo menos visible de la pantalla de ejercicio. | En el reproductor (360 × 740) la figura mide ~160 px de alto: el 22 % de la pantalla. El título gigante («5 HALOS»), la cuenta y el reloj se llevan el resto. |
| 2 | **El arte de los personajes no está a la altura.** Son figuras generadas por perfiles: manos de puño, pelo de tubos, cara de calcomanías. | Hojas de contacto de los 29 ejercicios. A 200 px el rostro de Princess se lee como gafas oscuras. |
| 3 | **Una sola vista y movimiento continuo.** Para imitar hay que ver la postura de salida, la de esfuerzo y la de llegada, a la vez. | El halo gira sin pausas desde un solo ángulo. |
| 4 | **Nada señala qué vigilar.** Las pistas técnicas están en texto, lejos de la figura. | «Codos hacia arriba», «espalda larga» solo están en la ficha. |
| 5 | **La competencia gana con vídeo real.** | Nike Training Club llena casi toda la pantalla con un vídeo en bucle desde varios ángulos; Fitbod y Freeletics enseñan un clip corto por ejercicio. Ninguno usa un muñeco. No se compite en realismo: se compite en claridad, personalidad y ligereza. |

## 2. Opciones

| Opción | Qué es | Impacto en «imitar» | Impacto en «bonito» | Coste / riesgo |
|---|---|---|---|---|
| A. Pulir lo actual | Encuadre, color de pesa, recorrido, fichas (vuelta 1) | Bajo | Bajo | Hecho. Insuficiente. |
| **B. Escenario grande + poses clave** | La figura pasa a ser la protagonista (45–50 % de la pantalla), con fichas de fase dentro, tres poses clave (salida · esfuerzo · llegada) durante «Prepárate» y en la ficha técnica, y dos ángulos a la vez | **Alto** | Medio (se ven más grandes, por tanto se nota más el arte) | Sin coste externo. Todo con los mismos 29 clips. |
| C1. Personajes v2 con pase de arte en Blender | Manos con dedos, pelo en mechones con volumen, ropa con pliegues, rostro estilizado pensado para 40 px (ojos grandes con brillo, cejas claras), proporciones más expresivas | Medio | **Alto** | Varios días; hay que rehacer GLB y revisar 29 clips ×2. Riesgo medio. |
| C2. Modelos CC0 ya hechos (p. ej. Quaternius) | Cuerpos profesionales con rig humanoide; se vuelven a calcular los clips sobre su esqueleto | Medio | Alto | Se pierde la identidad de Bro y Princess (barba, tatuajes, pelo rizado); hay que verificar la licencia de cada pack. |
| C3. Generar los personajes con IA (imagen → 3D) | Concepto + malla texturizada | Medio | Incierto | Higgsfield tiene 0 créditos hoy; las mallas salen densas y sin topología: retopología y pesos a mano. Riesgo alto. |
| D. Vídeo real | Grabar a una persona haciendo cada ejercicio desde 2 ángulos | **Máximo** | Máximo | 29 ejercicios × 2 ángulos; peso en datos; necesita a alguien que grabe. Mejor solo para los difíciles. |

## 3. Recomendación

1. **B ahora.** Es lo que más se nota ya, no depende de nadie y aprovecha todo lo hecho.
2. **C1 después, con puntos de control visuales:** primero cara y manos de Princess y Bro a 40 px y a 200 px; se revisa con el usuario antes de tocar los 29 clips.
3. **D opcional** solo para los siete ejercicios difíciles (get-up, snatch, clean, halo, molino, arm bar, ochos) si hay quien grabe; el 3D queda como respaldo ligero y para el modo sin conexión.
4. C2 y C3 quedan descartadas salvo que C1 no alcance: cambian la identidad de los personajes o dependen de pagar créditos.

## 4. Hitos y criterios de aceptación

**B. Escenario (visible ya)**
- La figura ocupa ≥ 40 % del alto de la pantalla del reproductor a 360 × 740 y ≥ 30 % a 320 × 600.
- Las tres fichas de fase y la columna de vistas viven dentro del escenario, sin tapar la figura ni el texto.
- Durante «Prepárate», las tres poses clave se ven a la vez, con su etiqueta.
- La ficha técnica muestra salida · esfuerzo · llegada y dos ángulos.
- Se comprueba con capturas a 320, 360 y 390 px y con el 3D desactivado.

**C1. Personajes v2**
- Cara legible a 40 px de cabeza (ojos, boca, cejas) en ambos personajes.
- Manos con pulgar visible al agarrar el asa.
- Misma identidad: Bro (calvo, barba, aros, tatuajes, camiseta negra, pantalón verde) y Princess (pelo rojo rizado recogido, ropa blanca y beige).
- Los 29 clips pasan `characters:validate` y la revisión visual.

**D. Vídeo (si se hace)**
- Clip de ≤ 400 KB por ángulo en mp4/webm, bucle de una repetición, subtítulo con las tres fases.

## 5. Decisión del usuario y fuentes descartadas (17-oct)

El usuario aclaró que **los personajes le dan igual**: importa que se vea cómo se hace cada ejercicio, venga de IA, de otra fuente o de un solo personaje bien hecho. Se evaluó:

- **Fotos de un dataset abierto (free-exercise-db):** 56 ejercicios de kettlebell con dos fotos cada uno, pero son fotos de gimnasio de una marca comercial y la licencia «Unlicense» del repositorio no cubre su autoría; faltan además el halo, los acarreos y media docena más. **Descartado: riesgo de derechos de autor.**
- **IA de vídeo/3D (Higgsfield):** 0 créditos y sin generaciones gratuitas; y la IA inventa técnica (peligroso en levantamientos como el halo o el arranque). **Descartado salvo que se pague y se revise cada clip.**
- **Vídeo de terceros incrustado:** depende de que sigan online, de anuncios y de conexión; no se puede revisar la técnica sin verlos todos. **Descartado como base.**
- **Lo propio, bien presentado (elegido):** los 29 movimientos ya revisados, ahora con presentación de instrucción.

Se pasa la opción B a la ejecución completa y C1 (rehacer el arte) queda aparcada:

1. **Escenario grande** en el reproductor (figura ≥ 40 % del alto).
2. **Siluetas de poses clave** detrás del personaje (inicio, medio y final de la repetición): el rango del movimiento se ve de un vistazo (sentadilla de pie ↔ abajo, bisagra de cadera del swing, alas del halo).
3. **Fichas de fase** 1·2·3 sincronizadas, recorrido de la pesa en cola de cometa.
4. **«Paso a paso»** en la ficha técnica: las tres posturas congeladas en un carrusel con su frase.
5. «Prepárate» enseña el movimiento ya en marcha, con siluetas y fases.

## 5 bis. Personajes realistas (17-oct, a petición: «que se vea más real»)

Con «Higgsfield sin créditos» y el vídeo real fuera de alcance, se sustituyeron los muñecos de perfiles por **personas de MakeHuman (activos CC0)**: cuerpo y cara reales con pieles texturizadas, pelo, ropa y calzado, montadas sobre el mismo esqueleto de 21 huesos para conservar los 29 movimientos ya revisados.

- Bro: hombre atlético, camiseta blanca y vaqueros, pesa negra. Princess: mujer con top y mallas deportivas, coleta, pesa perla.
- Manos con dedos cerrados sobre el asa (pose de puño horneada), pesas con la misma geometría de siempre.
- ~33 000 triángulos y ~2,4 MB por personaje (el que no se elige no se descarga).
- Licencia: CC0 (sin atribución obligatoria); detalles y cómo regenerar en `tools/blender/README.md`.
- Visor: materiales PBR con luces de estudio, sin contorno de cómic. Las siluetas de poses clave, el recorrido de la pesa y las fichas de fase funcionan igual.

## 6. Qué queda abierto
- Revisar en un móvil real la fluidez con la figura principal más tres siluetas (cuatro copias del personaje) en gama baja.
- Si más adelante se quiere vídeo real de los ejercicios difíciles, hace falta quien los grabe; el 3D queda como respaldo y modo sin conexión.

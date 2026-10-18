/**
 * EL CANTO: como el cantor de la lotería, cada carta trae su verso. Es la voz del juego:
 * una rima corta que recuerda la idea técnica del movimiento (sin prometer nada que la evidencia no respalde).
 */
const CANTOS: Record<string, string> = {
  "EL SWING": "El swing que va y que viene, solo con cadera se sostiene.",
  "EL CLEAN": "El clean sube pegado al cuerpo: si lo alejas, el antebrazo paga el costo.",
  "EL SNATCH": "La mano pasa veloz por encima de la cabeza: sin arco y sin prisa, la técnica es la que pesa.",
  "EL GET-UP": "Del suelo hasta estar de pie, paso a paso, sin prisa, que el brazo no se va a ir.",
  "EL PESO MUERTO": "Cadera atrás y espalda larga: la pesa se levanta sin queja ni carga.",
  "LA SENTADILLA": "Pecho arriba, rodillas afuera: se baja con calma y se sube con fuerza.",
  "EL RACK": "Codo en la cadera, pesa en el pecho: se baja con calma y se sube derecho.",
  "LA ZANCADA": "Un paso largo hacia atrás: rodilla al piso y vuelta a empezar.",
  "EL PRESS": "Glúteos duros, costillas abajo: el que empuja recto no pierde ni un gramo.",
  "EL IMPULSO": "Doblas poquito, empujas con piernas: el brazo termina lo que la cadera empezó.",
  "EL PRESS DE PISO": "Tumbado y firme, el codo a cuarenta y cinco: el suelo te marca el camino.",
  "EL CABALLERO": "Con una rodilla en el suelo, el glúteo te da el equilibrio y el hombro el tesoro.",
  "EL REMO": "Del codo se tira hacia la cadera: la espalda trabaja y el torso se queda quieto.",
  "EL TIRÓN": "La cadera lanza, el codo sube: lo que se mueve es la fuerza, no la prisa.",
  "EL MOLINO": "Mira siempre la pesa y manda la cadera atrás: el molino gira y nadie se va a lastimar.",
  "EL HALO": "Rodea la cabeza sin tocar el cielo: hombros sueltos, costillas abajo.",
  "LA GRULLA": "En un pie, cadera cuadrada: la grulla no se tuerce ni se cansa de estar parada.",
  "EL CANDADO": "Tumbado, brazo arriba: rueda despacio y deja caer las costillas.",
  "EL RELOJ": "Ritmo parejo y respiración tranquila: el reloj no se apura y aguanta la jornada.",
  "EL LATIDO": "Cuarenta de trabajo, veinte para respirar: el corazón marca el compás.",
  "EL COMPLEJO": "Varios movimientos sin soltar la pesa: el que cuida cada paso ni se enreda ni se frena.",
  "EL RESPIRO": "Hoy no se gana ni se pierde: se respira, se mueve y se vuelve más fuerte.",
  "LA MALETA": "Camina erguido con la maleta: el que no se inclina, no se tuerce ni se atrasa.",
  "EL CARGADOR": "Pesa en el pecho, paso firme: el que respira bien, carga sin derrumbarse.",
  "EL GRANJERO": "Dos pesas a los costados, hombros atrás y abajo: se camina como quien lleva una cosecha.",
  "EL MESERO": "La bandeja arriba, el brazo derechito: el mesero no derrama ni una gota.",
  "EL EQUILIBRISTA": "Pesa boca abajo, muñeca firme: lo que se mantiene recto no se cae.",
  "EL PUENTE": "Talones cerca, glúteos arriba: el puente se arma desde los talones.",
  "LA CUCLILLA": "Abajo se respira y se abren las caderas: la cuclilla enseña a quien la practica.",
  "EL OCHO": "Entre las piernas va y viene, pecho alto y pesa que se mueve.",
  "EL CLEAN Y PRESS": "Sube al pecho, respira y empuja: una pausa en el rack y todo sale mejor.",
  "EL BRO": "Soy la pesa que te acompaña: una carta nueva cada día.",
};

export function cantoFor(title: string): string {
  return CANTOS[title.toUpperCase()] ?? "Una carta nueva cada día: con calma, con técnica y con ganas.";
}

/** ~600 common Spanish words, most frequent first, lowercase (for keyboard prediction). */
export const ES_COMMON_WORDS: string[] = `yo tú no sí que el la de y a en un una es me quiero eso esto mi
por para con más qué lo los las se te le ya bien muy ir voy ver hacer tengo puedo estoy necesito
ayuda gracias favor hola adiós mamá papá casa agua comer jugar beber ahora aquí allá ahí también
pero porque cuando dónde cómo quién cuál cuánto cuántos sí no nada algo todo todos otro otra otra
vez está están son soy eres era fue fueron ser estar tener poder querer ir hay va vamos vas van
quieres quiere queremos quieren puedes puede podemos pueden tienes tiene tenemos tienen estás
estamos haces hace hago hacemos hacen voy a vas a necesitas necesita necesitamos gusta gustan
encanta duele pica siento sientes siente dame dime ayúdame mira ven espera para alto basta
él ella nosotros ellos ellas usted ustedes mí ti conmigo contigo nos les su sus tu tus mis
nuestro nuestra este esta estos estas ese esa esos esas aquel aquello lo mismo mío tuyo suyo
del al sin sobre entre hasta desde hacia contra según durante antes después luego entonces
primero último siguiente pronto tarde temprano hoy mañana ayer noche día semana mes año
siempre nunca a veces todavía también tampoco solo sola juntos mucho mucha muchos muchas poco
poca pocos pocas demasiado bastante menos mejor peor tanto casi
bueno buena malo mala grande pequeño pequeña chiquito nuevo viejo feliz triste enojado enojada
cansado cansada asustado asustada enfermo enferma contento tranquilo preocupado aburrido
emocionado frustrado nervioso confundido orgulloso lastimado abrumado listo lista
hambre sed sueño frío calor miedo dolor ganas razón prisa
comer beber tomar dormir jugar ver mirar escuchar oír hablar decir leer escribir dibujar pintar
cantar bailar correr caminar saltar nadar sentarse pararse levantarse acostarse despertarse
vestirse bañarse lavarse peinarse abrir cerrar poner quitar dar traer llevar buscar encontrar
esperar parar terminar empezar ayudar compartir jalar empujar subir bajar entrar salir venir
volver quedarse sentir pensar saber conocer entender aprender trabajar estudiar comprar pagar
usar cocinar limpiar arreglar romper tocar oler probar intentar llamar preguntar contestar
mostrar enseñar contar cortar pegar lanzar atrapar patear abrazar besar amar gustar doler
cargar agarrar sostener guardar mover girar descansar respirar llorar reír gritar
como come comes comemos comen juego juegas juega jugamos juegan bebo bebes bebe tomo toma
duermo duerme veo ves vemos miro escucho hablo digo dice leo escribo canto bailo corro camino
salto nado abro cierro pongo doy traigo busco encuentro espero paro termino empiezo
salgo vengo vienes viene vuelvo siento pienso sé sabes sabe conozco entiendo aprendo
fui fuiste hice hiciste comí jugué vi dije terminé tuve pude quise estuve
gracias perdón disculpa permiso claro bueno oye mira ay ups guau genial perfecto
por favor de nada lo siento buenos días buenas tardes noches hasta luego mucho gusto
amigo amiga amigos maestro maestra hermano hermana abuelo abuela bebé familia tío tía primo
prima niño niña niños hombre mujer gente doctor doctora enfermera terapeuta perro gato
comida desayuno almuerzo comida cena botana leche jugo refresco pan fruta manzana plátano
naranja uva fresa galleta dulce chocolate helado pastel pizza pollo carne pescado arroz
frijoles huevo queso papas sopa taco sándwich hamburguesa verdura zanahoria ensalada
escuela clase tarea recreo libro lápiz papel parque tienda baño cuarto cama cocina sala
carro autobús afuera adentro arriba abajo cerca lejos calle fiesta playa alberca iglesia
tele tableta celular teléfono computadora juego videojuego video música canción película
pelota juguete muñeca carrito bloques rompecabezas columpio resbaladilla bici
ropa camisa camiseta pantalón zapatos calcetines chamarra suéter pijama gorra lentes
mochila audífonos cobija almohada toalla jabón cepillo
cabeza mano manos pie pies pierna brazo ojo ojos oreja nariz boca diente dientes panza
espalda pelo cara dedo garganta corazón
rojo naranja amarillo verde azul morado rosa café negro blanco gris
cero uno dos tres cuatro cinco seis siete ocho nueve diez cien
lunes martes miércoles jueves viernes sábado domingo fin cumpleaños vacaciones
hora minuto tiempo reloj momento rato
pregunta respuesta idea problema cosa cosas lugar parte manera vez veces tipo
fácil difícil rápido lento fuerte suave caliente frío limpio sucio lleno vacío abierto
cerrado alto bajo largo corto pesado ligero bonito bonita feo chistoso divertido aburrido
correcto incorrecto igual diferente roto seguro mojado seco duro oscuro claro
silencio ruido luz espacio descanso calma pausa
sí también así pues ojalá tal vez quizás claro que exacto verdad mentira
autista comunicar comunicarme paciencia entiendo hablar ahorita`.split(/\s+/).filter(Boolean)
  .filter((w, i, all) => all.indexOf(w) === i);

/** Next-word suggestions for common words (like src/data/bigrams.ts but Spanish). */
export const ES_BIGRAMS: Record<string, string[]> = {
  yo: ['quiero', 'necesito', 'tengo', 'estoy', 'no', 'puedo', 'soy', 'voy', 'siento', 'también'],
  tú: ['quieres', 'eres', 'estás', 'puedes', 'tienes', 'sabes', 'vas'],
  él: ['es', 'está', 'quiere', 'tiene', 'puede'],
  ella: ['es', 'está', 'quiere', 'tiene', 'puede'],
  nosotros: ['vamos', 'estamos', 'podemos', 'queremos', 'tenemos'],
  ellos: ['son', 'están', 'quieren', 'tienen', 'pueden'],
  eso: ['es', 'no', 'duele', 'está'],
  me: ['gusta', 'duele', 'siento', 'llamo', 'toca', 'encanta', 'das', 'ayudas'],
  no: ['quiero', 'me', 'sé', 'puedo', 'gracias', 'más', 'ahora', 'es', 'tengo'],
  quiero: ['ir', 'más', 'comer', 'jugar', 'agua', 'eso', 'ver', 'un', 'una', 'mi'],
  necesito: ['ayuda', 'ir', 'un', 'más', 'agua', 'descanso', 'espacio', 'silencio'],
  tengo: ['hambre', 'sed', 'sueño', 'frío', 'calor', 'miedo', 'que', 'dolor'],
  estoy: ['bien', 'cansado', 'feliz', 'triste', 'enojado', 'enfermo', 'aburrido', 'listo'],
  puedo: ['ir', 'jugar', 'comer', 'ver', 'tener', 'tomar'],
  puedes: ['ayudarme', 'venir', 'esperar', 'repetir'],
  voy: ['a', 'al', 'con'],
  vamos: ['a', 'al', 'ya', 'juntos'],
  ir: ['a', 'al', 'afuera', 'casa', 'ya'],
  a: ['la', 'casa', 'jugar', 'comer', 'mi', 'ver', 'dormir'],
  al: ['baño', 'parque', 'carro', 'doctor'],
  gusta: ['eso', 'mucho', 'el', 'la', 'jugar'],
  duele: ['la', 'el', 'mucho', 'aquí'],
  siento: ['mal', 'bien', 'cansado', 'triste', 'enfermo'],
  más: ['por', 'agua', 'comida', 'tiempo'],
  por: ['favor', 'qué'],
  qué: ['es', 'hora', 'pasó', 'sigue', 'haces', 'quieres'],
  dónde: ['está', 'están', 'vamos', 'es'],
  cómo: ['estás', 'te', 'se'],
  cuándo: ['vamos', 'nos', 'es', 'llegamos'],
  quién: ['es', 'está'],
  es: ['mi', 'tu', 'eso', 'muy', 'un', 'una', 'mío'],
  mi: ['turno', 'mamá', 'papá', 'casa', 'tableta', 'amigo', 'cuarto'],
  tu: ['turno', 'casa', 'nombre'],
  el: ['baño', 'parque', 'carro', 'juego', 'libro'],
  la: ['tele', 'tableta', 'pelota', 'escuela', 'casa'],
  un: ['poco', 'momento', 'minuto', 'descanso', 'abrazo'],
  una: ['vez', 'galleta', 'pregunta'],
  ayuda: ['por', 'me'],
  muy: ['bien', 'cansado', 'feliz', 'rico'],
  hola: ['mamá', 'papá', 'cómo'],
  gracias: ['mamá', 'papá'],
  ya: ['terminé', 'no', 'voy', 'llegamos'],
  te: ['quiero', 'amo', 'ayudo'],
  para: ['mí', 'ti', 'comer', 'jugar'],
  con: ['mi', 'mamá', 'papá', 'tú'],
  otra: ['vez'],
  todo: ['bien'],
  buenos: ['días'],
  buenas: ['noches', 'tardes'],
  hasta: ['luego', 'mañana'],
  lo: ['siento', 'quiero'],
  de: ['nada', 'mi', 'la'],
};

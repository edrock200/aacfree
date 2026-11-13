import { describe, expect, it } from 'vitest';
import { buildProfile } from '../../data/defaults';
import { PACKS, type Lang } from '../../i18n/packs';
import { setLang } from '../../i18n';
import { formsFor, verbForms } from '../morphology';
import { autoConjugate, conjugate } from '../morphology-es';
import { autoConjugateFr, isInfinitiveFr } from '../morphology-fr';
import { autoConjugatePt } from '../morphology-pt';
import { joinWords } from '../sentence';
import { aboutMeText, englishMatches, secondWord, translateProfile } from '../translate';
import { applyStarterWords, isStarterWord, isUntouchedDefault } from '../starter';
import { searchLibrary } from '../library';
import type { AACButton, LayoutId, Profile } from '../../types';

const LAYOUTS: LayoutId[] = ['big', 'compact', 'medium', 'full'];

/** Every word-forms list, for every verb button shipped in every language (defect 44). "-" = no forms. */
const VERB_FORMS: Record<Lang, Record<string, string>> = {
  en: {
    "want": "wants, wanting, wanted, to want",
    "help": "helps, helping, helped, to help",
    "go": "goes, going, went, gone, to go",
    "play": "plays, playing, played, to play",
    "like": "likes, liking, liked, to like",
    "all done": "-",
    "eat": "eats, eating, ate, eaten, to eat",
    "drink": "drinks, drinking, drank, drunk, to drink",
    "pour": "pours, pouring, poured, to pour",
    "feel": "feels, feeling, felt, to feel",
    "am": "is, are, was, were, being, been, to be",
    "need a break": "needs a break, needing a break, needed a break, to need a break",
    "need space": "needs space, needing space, needed space, to need space",
    "love": "loves, loving, loved, to love",
    "go to": "goes to, going to, went to, gone to, to go to",
    "leave": "leaves, leaving, left, to leave",
    "stay": "stays, staying, stayed, to stay",
    "turn": "turns, turning, turned, to turn",
    "stop": "stops, stopping, stopped, to stop",
    "tickle": "tickles, tickling, tickled, to tickle",
    "chase": "chases, chasing, chased, to chase",
    "hide and seek": "-",
    "sing": "sings, singing, sang, sung, to sing",
    "dance": "dances, dancing, danced, to dance",
    "read": "reads, reading, to read",
    "draw": "draws, drawing, drew, drawn, to draw",
    "build": "builds, building, built, to build",
    "sleep": "sleeps, sleeping, slept, to sleep",
    "sit": "sits, sitting, sat, to sit",
    "stand": "stands, standing, stood, to stand",
    "walk": "walks, walking, walked, to walk",
    "run": "runs, running, ran, to run",
    "jump": "jumps, jumping, jumped, to jump",
    "wash": "washes, washing, washed, to wash",
    "watch": "watches, watching, watched, to watch",
    "listen": "listens, listening, listened, to listen",
    "swim": "swims, swimming, swam, swum, to swim",
    "write": "writes, writing, wrote, written, to write",
    "cut": "cuts, cutting, to cut",
    "throw": "throws, throwing, threw, thrown, to throw",
    "catch": "catches, catching, caught, to catch",
    "kick": "kicks, kicking, kicked, to kick",
    "push": "pushes, pushing, pushed, to push",
    "pull": "pulls, pulling, pulled, to pull",
    "climb": "climbs, climbing, climbed, to climb",
    "give": "gives, giving, gave, given, to give",
    "take": "takes, taking, took, taken, to take",
    "find": "finds, finding, found, to find",
    "show": "shows, showing, showed, shown, to show",
    "tell": "tells, telling, told, to tell",
    "hug": "hugs, hugging, hugged, to hug",
    "kiss": "kisses, kissing, kissed, to kiss",
    "wait": "waits, waiting, waited, to wait",
    "know": "knows, knowing, knew, known, to know",
    "think": "thinks, thinking, thought, to think",
    "fix": "fixes, fixing, fixed, to fix",
    "clean": "cleans, cleaning, cleaned, to clean",
    "cook": "cooks, cooking, cooked, to cook",
    "buy": "buys, buying, bought, to buy",
    "ride": "rides, riding, rode, ridden, to ride",
    "hide": "hides, hiding, hid, hidden, to hide",
    "wake up": "wakes up, waking up, woke up, woken up, to wake up",
    "try": "tries, trying, tried, to try",
    "hold": "holds, holding, held, to hold",
    "carry": "carries, carrying, carried, to carry",
    "brush": "brushes, brushing, brushed, to brush",
    "close": "closes, closing, closed, to close",
    "come": "comes, coming, came, to come",
    "say": "says, saying, said, to say",
    "ask": "asks, asking, asked, to ask",
    "call": "calls, calling, called, to call",
    "use": "uses, using, used, to use",
    "work": "works, working, worked, to work",
    "learn": "learns, learning, learned, to learn",
    "finish": "finishes, finishing, finished, to finish",
    "start": "starts, starting, started, to start",
    "break": "breaks, breaking, broke, broken, to break",
    "share": "shares, sharing, shared, to share",
    "pick": "picks, picking, picked, to pick",
    "keep": "keeps, keeping, kept, to keep",
    "bring": "brings, bringing, brought, to bring",
    "move": "moves, moving, moved, to move",
    "touch": "touches, touching, touched, to touch",
    "smell": "smells, smelling, smelled, to smell",
    "is": "am, are, was, were, being, been, to be",
    "are": "am, is, was, were, being, been, to be",
    "was": "am, is, are, were, being, been, to be",
    "were": "am, is, are, was, being, been, to be",
    "will": "would",
    "did": "do, does, doing, done, to do",
    "does": "do, doing, did, done, to do",
    "hurts": "hurt, hurting, to hurt",
    "bleeding": "bleed, bleeds, bled, to bleed",
    "throw up": "throws up, throwing up, threw up, thrown up, to throw up",
    "put on": "puts on, putting on, to put on",
    "take off": "takes off, taking off, took off, taken off, to take off",
    "wear": "wears, wearing, wore, worn, to wear",
    "line up": "lines up, lining up, lined up, to line up",
    "raise hand": "raises hand, raising hand, raised hand, to raise hand",
    "finished": "finish, finishes, finishing, to finish",
    "get dressed": "gets dressed, getting dressed, got dressed, gotten dressed, to get dressed",
    "brush teeth": "brushes teeth, brushing teeth, brushed teeth, to brush teeth",
    "wash hands": "washes hands, washing hands, washed hands, to wash hands",
    "bath": "baths, bathing, bathed, to bath",
    "shower": "showers, showering, showered, to shower",
    "brush hair": "brushes hair, brushing hair, brushed hair, to brush hair",
    "go to bed": "goes to bed, going to bed, went to bed, gone to bed, to go to bed",
    "pee": "pees, peeing, peed, to pee",
    "poop": "poops, pooping, pooped, to poop",
    "flush": "flushes, flushing, flushed, to flush",
    "eat breakfast": "eats breakfast, eating breakfast, ate breakfast, eaten breakfast, to eat breakfast",
    "eat lunch": "eats lunch, eating lunch, ate lunch, eaten lunch, to eat lunch",
    "eat dinner": "eats dinner, eating dinner, ate dinner, eaten dinner, to eat dinner",
    "take medicine": "takes medicine, taking medicine, took medicine, taken medicine, to take medicine",
    "nap": "naps, napping, napped, to nap",
    "clean up": "cleans up, cleaning up, cleaned up, to clean up",
    "feed the pet": "feeds the pet, feeding the pet, fed the pet, to feed the pet",
    "pack bag": "packs bag, packing bag, packed bag, to pack bag",
    "put on shoes": "puts on shoes, putting on shoes, to put on shoes",
    "need": "needs, needing, needed, to need",
    "rock": "rocks, rocking, rocked, to rock",
    "deep breath": "-",
    "spin": "spins, spinning, spun, to spin",
    "stim": "stims, stimming, stimmed, to stim",
    "count": "counts, counting, counted, to count",
    "open": "opens, opening, opened, to open",
    "turn on": "turns on, turning on, turned on, to turn on",
    "turn off": "turns off, turning off, turned off, to turn off",
    "charge": "charges, charging, charged, to charge",
    "pay": "pays, paying, paid, to pay",
    "look": "looks, looking, looked, to look",
    "try on": "tries on, trying on, tried on, to try on",
    "wait in line": "waits in line, waiting in line, waited in line, to wait in line",
    "rest": "rests, resting, rested, to rest",
    "breathe": "breathes, breathing, breathed, to breathe",
    "get": "gets, getting, got, gotten, to get",
    "do": "does, doing, did, done, to do",
    "put": "puts, putting, to put",
    "make": "makes, making, made, to make",
    "can": "could",
  },
  es: {
    "querer": "quiero, quieres, quiere, queremos, quieren, quise, quiso, queriendo, querido, voy a querer",
    "ayuda": "-",
    "ir": "voy, vas, va, vamos, van, fui, fue, yendo, ido, voy a ir",
    "jugar": "juego, juegas, juega, jugamos, juegan, jugué, jugó, jugando, jugado, voy a jugar",
    "gustar": "me gusta, te gusta, le gusta, nos gusta, les gusta, me gustó, me gustan",
    "terminé": "-",
    "comer": "como, comes, come, comemos, comen, comí, comió, comiendo, comido, voy a comer",
    "beber": "bebo, bebes, bebe, bebemos, beben, bebí, bebió, bebiendo, bebido, voy a beber",
    "servir": "sirvo, sirves, sirve, servimos, sirven, serví, sirvió, sirviendo, servido, voy a servir",
    "sentir": "siento, sientes, siente, sentimos, sienten, sentí, sintió, sintiendo, sentido, voy a sentir",
    "estar": "estoy, estás, está, estamos, están, estuve, estuvo, estando, estado, voy a estar",
    "necesitar un descanso": "necesito un descanso, necesitas un descanso, necesita un descanso, necesitamos un descanso, necesitan un descanso, necesité un descanso, necesitó un descanso, necesitando un descanso, necesitado un descanso, voy a necesitar un descanso",
    "necesitar espacio": "necesito espacio, necesitas espacio, necesita espacio, necesitamos espacio, necesitan espacio, necesité espacio, necesitó espacio, necesitando espacio, necesitado espacio, voy a necesitar espacio",
    "amar": "amo, amas, ama, amamos, aman, amé, amó, amando, amado, voy a amar",
    "ir a": "voy a, vas a, va a, vamos a, van a, fui a, fue a, yendo a, ido a, voy a ir a",
    "salir": "salgo, sales, sale, salimos, salen, salí, salió, saliendo, salido, voy a salir",
    "quedarse": "me quedo, te quedas, se queda, nos quedamos, se quedan, me quedé, se quedó, quedándome, quedado, voy a quedarme",
    "turno": "-",
    "alto": "-",
    "hacer cosquillas": "hago cosquillas, haces cosquillas, hace cosquillas, hacemos cosquillas, hacen cosquillas, hice cosquillas, hizo cosquillas, haciendo cosquillas, hecho cosquillas, voy a hacer cosquillas",
    "perseguir": "persigo, persigues, persigue, perseguimos, persiguen, perseguí, persiguió, persiguiendo, perseguido, voy a perseguir",
    "escondidas": "-",
    "cantar": "canto, cantas, canta, cantamos, cantan, canté, cantó, cantando, cantado, voy a cantar",
    "bailar": "bailo, bailas, baila, bailamos, bailan, bailé, bailó, bailando, bailado, voy a bailar",
    "leer": "leo, lees, lee, leemos, leen, leí, leyó, leyendo, leído, voy a leer",
    "dibujar": "dibujo, dibujas, dibuja, dibujamos, dibujan, dibujé, dibujó, dibujando, dibujado, voy a dibujar",
    "construir": "construyo, construyes, construye, construimos, construyen, construí, construyó, construyendo, construido, voy a construir",
    "dormir": "duermo, duermes, duerme, dormimos, duermen, dormí, durmió, durmiendo, dormido, voy a dormir",
    "sentarse": "me siento, te sientas, se sienta, nos sentamos, se sientan, me senté, se sentó, sentándome, sentado, voy a sentarme",
    "pararse": "me paro, te paras, se para, nos paramos, se paran, me paré, se paró, parándome, parado, voy a pararme",
    "caminar": "camino, caminas, camina, caminamos, caminan, caminé, caminó, caminando, caminado, voy a caminar",
    "correr": "corro, corres, corre, corremos, corren, corrí, corrió, corriendo, corrido, voy a correr",
    "saltar": "salto, saltas, salta, saltamos, saltan, salté, saltó, saltando, saltado, voy a saltar",
    "lavar": "lavo, lavas, lava, lavamos, lavan, lavé, lavó, lavando, lavado, voy a lavar",
    "ver": "veo, ves, ve, vemos, ven, vi, vio, viendo, visto, voy a ver",
    "escuchar": "escucho, escuchas, escucha, escuchamos, escuchan, escuché, escuchó, escuchando, escuchado, voy a escuchar",
    "nadar": "nado, nadas, nada, nadamos, nadan, nadé, nadó, nadando, nadado, voy a nadar",
    "escribir": "escribo, escribes, escribe, escribimos, escriben, escribí, escribió, escribiendo, escrito, voy a escribir",
    "cortar": "corto, cortas, corta, cortamos, cortan, corté, cortó, cortando, cortado, voy a cortar",
    "lanzar": "lanzo, lanzas, lanza, lanzamos, lanzan, lancé, lanzó, lanzando, lanzado, voy a lanzar",
    "atrapar": "atrapo, atrapas, atrapa, atrapamos, atrapan, atrapé, atrapó, atrapando, atrapado, voy a atrapar",
    "patear": "pateo, pateas, patea, pateamos, patean, pateé, pateó, pateando, pateado, voy a patear",
    "empujar": "empujo, empujas, empuja, empujamos, empujan, empujé, empujó, empujando, empujado, voy a empujar",
    "jalar": "jalo, jalas, jala, jalamos, jalan, jalé, jaló, jalando, jalado, voy a jalar",
    "trepar": "trepo, trepas, trepa, trepamos, trepan, trepé, trepó, trepando, trepado, voy a trepar",
    "dar": "doy, das, da, damos, dan, di, dio, dando, dado, voy a dar",
    "tomar": "tomo, tomas, toma, tomamos, toman, tomé, tomó, tomando, tomado, voy a tomar",
    "encontrar": "encuentro, encuentras, encuentra, encontramos, encuentran, encontré, encontró, encontrando, encontrado, voy a encontrar",
    "mostrar": "muestro, muestras, muestra, mostramos, muestran, mostré, mostró, mostrando, mostrado, voy a mostrar",
    "contar": "cuento, cuentas, cuenta, contamos, cuentan, conté, contó, contando, contado, voy a contar",
    "abrazar": "abrazo, abrazas, abraza, abrazamos, abrazan, abracé, abrazó, abrazando, abrazado, voy a abrazar",
    "besar": "beso, besas, besa, besamos, besan, besé, besó, besando, besado, voy a besar",
    "espera": "-",
    "saber": "sé, sabes, sabe, sabemos, saben, supe, supo, sabiendo, sabido, voy a saber",
    "pensar": "pienso, piensas, piensa, pensamos, piensan, pensé, pensó, pensando, pensado, voy a pensar",
    "arreglar": "arreglo, arreglas, arregla, arreglamos, arreglan, arreglé, arregló, arreglando, arreglado, voy a arreglar",
    "limpiar": "limpio, limpias, limpia, limpiamos, limpian, limpié, limpió, limpiando, limpiado, voy a limpiar",
    "cocinar": "cocino, cocinas, cocina, cocinamos, cocinan, cociné, cocinó, cocinando, cocinado, voy a cocinar",
    "comprar": "compro, compras, compra, compramos, compran, compré, compró, comprando, comprado, voy a comprar",
    "subirse": "me subo, te subes, se sube, nos subimos, se suben, me subí, se subió, subiéndome, subido, voy a subirme",
    "esconderse": "me escondo, te escondes, se esconde, nos escondemos, se esconden, me escondí, se escondió, escondiéndome, escondido, voy a esconderme",
    "despertarse": "me despierto, te despiertas, se despierta, nos despertamos, se despiertan, me desperté, se despertó, despertándome, despertado, voy a despertarme",
    "intentar": "intento, intentas, intenta, intentamos, intentan, intenté, intentó, intentando, intentado, voy a intentar",
    "sostener": "sostengo, sostienes, sostiene, sostenemos, sostienen, sostuve, sostuvo, sosteniendo, sostenido, voy a sostener",
    "cargar": "cargo, cargas, carga, cargamos, cargan, cargué, cargó, cargando, cargado, voy a cargar",
    "cepillar": "cepillo, cepillas, cepilla, cepillamos, cepillan, cepillé, cepilló, cepillando, cepillado, voy a cepillar",
    "cerrar": "cierro, cierras, cierra, cerramos, cierran, cerré, cerró, cerrando, cerrado, voy a cerrar",
    "venir": "vengo, vienes, viene, venimos, vienen, vine, vino, viniendo, venido, voy a venir",
    "decir": "digo, dices, dice, decimos, dicen, dije, dijo, diciendo, dicho, voy a decir",
    "preguntar": "pregunto, preguntas, pregunta, preguntamos, preguntan, pregunté, preguntó, preguntando, preguntado, voy a preguntar",
    "llamar": "llamo, llamas, llama, llamamos, llaman, llamé, llamó, llamando, llamado, voy a llamar",
    "usar": "uso, usas, usa, usamos, usan, usé, usó, usando, usado, voy a usar",
    "trabajar": "trabajo, trabajas, trabaja, trabajamos, trabajan, trabajé, trabajó, trabajando, trabajado, voy a trabajar",
    "aprender": "aprendo, aprendes, aprende, aprendemos, aprenden, aprendí, aprendió, aprendiendo, aprendido, voy a aprender",
    "terminar": "termino, terminas, termina, terminamos, terminan, terminé, terminó, terminando, terminado, voy a terminar",
    "empezar": "empiezo, empiezas, empieza, empezamos, empiezan, empecé, empezó, empezando, empezado, voy a empezar",
    "descanso": "-",
    "compartir": "comparto, compartes, comparte, compartimos, comparten, compartí, compartió, compartiendo, compartido, voy a compartir",
    "escoger": "escojo, escoges, escoge, escogemos, escogen, escogí, escogió, escogiendo, escogido, voy a escoger",
    "guardar": "guardo, guardas, guarda, guardamos, guardan, guardé, guardó, guardando, guardado, voy a guardar",
    "traer": "traigo, traes, trae, traemos, traen, traje, trajo, trayendo, traído, voy a traer",
    "mover": "muevo, mueves, mueve, movemos, mueven, moví, movió, moviendo, movido, voy a mover",
    "tocar": "toco, tocas, toca, tocamos, tocan, toqué, tocó, tocando, tocado, voy a tocar",
    "oler": "huelo, hueles, huele, olemos, huelen, olí, olió, oliendo, olido, voy a oler",
    "es": "-",
    "son": "-",
    "fue": "-",
    "fueron": "-",
    "hizo": "-",
    "hace": "-",
    "duele": "-",
    "sangrar": "sangro, sangras, sangra, sangramos, sangran, sangré, sangró, sangrando, sangrado, voy a sangrar",
    "vomitar": "vomito, vomitas, vomita, vomitamos, vomitan, vomité, vomitó, vomitando, vomitado, voy a vomitar",
    "ponerse": "me pongo, te pones, se pone, nos ponemos, se ponen, me puse, se puso, poniéndome, puesto, voy a ponerme",
    "quitarse": "me quito, te quitas, se quita, nos quitamos, se quitan, me quité, se quitó, quitándome, quitado, voy a quitarme",
    "hacer fila": "hago fila, haces fila, hace fila, hacemos fila, hacen fila, hice fila, hizo fila, haciendo fila, hecho fila, voy a hacer fila",
    "levantar la mano": "levanto la mano, levantas la mano, levanta la mano, levantamos la mano, levantan la mano, levanté la mano, levantó la mano, levantando la mano, levantado la mano, voy a levantar la mano",
    "terminado": "-",
    "vestirse": "me visto, te vistes, se viste, nos vestimos, se visten, me vestí, se vistió, vistiéndome, vestido, voy a vestirme",
    "lavarse los dientes": "me lavo los dientes, te lavas los dientes, se lava los dientes, nos lavamos los dientes, se lavan los dientes, me lavé los dientes, se lavó los dientes, lavándome los dientes, voy a lavarme los dientes",
    "lavarse las manos": "me lavo las manos, te lavas las manos, se lava las manos, nos lavamos las manos, se lavan las manos, me lavé las manos, se lavó las manos, lavándome las manos, voy a lavarme las manos",
    "bañarse": "me baño, te bañas, se baña, nos bañamos, se bañan, me bañé, se bañó, bañándome, bañado, voy a bañarme",
    "ducharse": "me ducho, te duchas, se ducha, nos duchamos, se duchan, me duché, se duchó, duchándome, duchado, voy a ducharme",
    "peinarse": "me peino, te peinas, se peina, nos peinamos, se peinan, me peiné, se peinó, peinándome, peinado, voy a peinarme",
    "ir a dormir": "voy a dormir, vas a dormir, va a dormir, vamos a dormir, van a dormir, fui a dormir, fue a dormir, yendo a dormir, ido a dormir, voy a ir a dormir",
    "hacer pipí": "hago pipí, haces pipí, hace pipí, hacemos pipí, hacen pipí, hice pipí, hizo pipí, haciendo pipí, hecho pipí, voy a hacer pipí",
    "hacer popó": "hago popó, haces popó, hace popó, hacemos popó, hacen popó, hice popó, hizo popó, haciendo popó, hecho popó, voy a hacer popó",
    "jalar la cadena": "jalo la cadena, jalas la cadena, jala la cadena, jalamos la cadena, jalan la cadena, jalé la cadena, jaló la cadena, jalando la cadena, jalado la cadena, voy a jalar la cadena",
    "desayunar": "desayuno, desayunas, desayuna, desayunamos, desayunan, desayuné, desayunó, desayunando, desayunado, voy a desayunar",
    "almorzar": "almuerzo, almuerzas, almuerza, almorzamos, almuerzan, almorcé, almorzó, almorzando, almorzado, voy a almorzar",
    "cenar": "ceno, cenas, cena, cenamos, cenan, cené, cenó, cenando, cenado, voy a cenar",
    "tomar medicina": "tomo medicina, tomas medicina, toma medicina, tomamos medicina, toman medicina, tomé medicina, tomó medicina, tomando medicina, tomado medicina, voy a tomar medicina",
    "siesta": "-",
    "recoger": "recojo, recoges, recoge, recogemos, recogen, recogí, recogió, recogiendo, recogido, voy a recoger",
    "alimentar a la mascota": "alimento a la mascota, alimentas a la mascota, alimenta a la mascota, alimentamos a la mascota, alimentan a la mascota, alimenté a la mascota, alimentó a la mascota, alimentando a la mascota, alimentado a la mascota, voy a alimentar a la mascota",
    "preparar la mochila": "preparo la mochila, preparas la mochila, prepara la mochila, preparamos la mochila, preparan la mochila, preparé la mochila, preparó la mochila, preparando la mochila, preparado la mochila, voy a preparar la mochila",
    "ponerse los zapatos": "me pongo los zapatos, te pones los zapatos, se pone los zapatos, nos ponemos los zapatos, se ponen los zapatos, me puse los zapatos, se puso los zapatos, poniéndome los zapatos, voy a ponerme los zapatos",
    "necesitar": "necesito, necesitas, necesita, necesitamos, necesitan, necesité, necesitó, necesitando, necesitado, voy a necesitar",
    "mecerse": "me mezo, te meces, se mece, nos mecemos, se mecen, me mecí, se meció, meciéndome, mecido, voy a mecerme",
    "respirar hondo": "respiro hondo, respiras hondo, respira hondo, respiramos hondo, respiran hondo, respiré hondo, respiró hondo, respirando hondo, respirado hondo, voy a respirar hondo",
    "girar": "giro, giras, gira, giramos, giran, giré, giró, girando, girado, voy a girar",
    "hacer stimming": "hago stimming, haces stimming, hace stimming, hacemos stimming, hacen stimming, hice stimming, hizo stimming, haciendo stimming, hecho stimming, voy a hacer stimming",
    "abrir": "abro, abres, abre, abrimos, abren, abrí, abrió, abriendo, abierto, voy a abrir",
    "prender": "prendo, prendes, prende, prendemos, prenden, prendí, prendió, prendiendo, prendido, voy a prender",
    "apagar": "apago, apagas, apaga, apagamos, apagan, apagué, apagó, apagando, apagado, voy a apagar",
    "pagar": "pago, pagas, paga, pagamos, pagan, pagué, pagó, pagando, pagado, voy a pagar",
    "mirar": "miro, miras, mira, miramos, miran, miré, miró, mirando, mirado, voy a mirar",
    "probarse": "me pruebo, te pruebas, se prueba, nos probamos, se prueban, me probé, se probó, probándome, probado, voy a probarme",
    "descansar": "descanso, descansas, descansa, descansamos, descansan, descansé, descansó, descansando, descansado, voy a descansar",
    "respirar": "respiro, respiras, respira, respiramos, respiran, respiré, respiró, respirando, respirado, voy a respirar",
    "agarrar": "agarro, agarras, agarra, agarramos, agarran, agarré, agarró, agarrando, agarrado, voy a agarrar",
    "hacer": "hago, haces, hace, hacemos, hacen, hice, hizo, haciendo, hecho, voy a hacer",
    "poner": "pongo, pones, pone, ponemos, ponen, puse, puso, poniendo, puesto, voy a poner",
    "crear": "creo, creas, crea, creamos, crean, creé, creó, creando, creado, voy a crear",
    "poder": "puedo, puedes, puede, podemos, pueden, pude, pudo, pudiendo, podido, voy a poder",
  },
  fr: {
    "vouloir": "veux, veut, voulons, voulez, veulent, voulu, je vais vouloir",
    "aide": "-",
    "aller": "vais, vas, va, allons, allez, vont, allé, je vais aller",
    "jouer": "joue, joues, jouons, jouez, jouent, joué, je vais jouer",
    "aimer": "aime, aimes, aimons, aimez, aiment, aimé, je vais aimer",
    "fini": "-",
    "manger": "mange, manges, mangeons, mangez, mangent, mangé, je vais manger",
    "boire": "bois, boit, buvons, buvez, boivent, bu, je vais boire",
    "verser": "verse, verses, versons, versez, versent, versé, je vais verser",
    "se sentir": "me sens, te sens, se sent, nous sentons, vous sentez, se sentent, senti, je vais me sentir",
    "être": "suis, es, est, sommes, êtes, sont, été, je vais être",
    "avoir besoin d'une pause": "ai besoin d'une pause, as besoin d'une pause, a besoin d'une pause, avons besoin d'une pause, avez besoin d'une pause, ont besoin d'une pause, eu besoin d'une pause, je vais avoir besoin d'une pause",
    "avoir besoin d'espace": "ai besoin d'espace, as besoin d'espace, a besoin d'espace, avons besoin d'espace, avez besoin d'espace, ont besoin d'espace, eu besoin d'espace, je vais avoir besoin d'espace",
    "adorer": "adore, adores, adorons, adorez, adorent, adoré, je vais adorer",
    "aller à": "vais à, vas à, va à, allons à, allez à, vont à, allé à, je vais aller à",
    "partir": "pars, part, partons, partez, partent, parti, je vais partir",
    "rester": "reste, restes, restons, restez, restent, resté, je vais rester",
    "tour": "-",
    "stop": "-",
    "chatouiller": "chatouille, chatouilles, chatouillons, chatouillez, chatouillent, chatouillé, je vais chatouiller",
    "courir après": "cours après, court après, courons après, courez après, courent après, couru après, je vais courir après",
    "cache-cache": "-",
    "chanter": "chante, chantes, chantons, chantez, chantent, chanté, je vais chanter",
    "danser": "danse, danses, dansons, dansez, dansent, dansé, je vais danser",
    "lire": "lis, lit, lisons, lisez, lisent, lu, je vais lire",
    "dessiner": "dessine, dessines, dessinons, dessinez, dessinent, dessiné, je vais dessiner",
    "construire": "construis, construit, construisons, construisez, construisent, je vais construire",
    "dormir": "dors, dort, dormons, dormez, dorment, dormi, je vais dormir",
    "s'asseoir": "m'assieds, t'assieds, s'assied, nous asseyons, vous asseyez, s'asseyent, assis, je vais m'asseoir",
    "se lever": "me lève, te lèves, se lève, nous levons, vous levez, se lèvent, levé, je vais me lever",
    "marcher": "marche, marches, marchons, marchez, marchent, marché, je vais marcher",
    "courir": "cours, court, courons, courez, courent, couru, je vais courir",
    "sauter": "saute, sautes, sautons, sautez, sautent, sauté, je vais sauter",
    "laver": "lave, laves, lavons, lavez, lavent, lavé, je vais laver",
    "voir": "vois, voit, voyons, voyez, voient, vu, je vais voir",
    "écouter": "écoute, écoutes, écoutons, écoutez, écoutent, écouté, je vais écouter",
    "nager": "nage, nages, nageons, nagez, nagent, nagé, je vais nager",
    "écrire": "écris, écrit, écrivons, écrivez, écrivent, je vais écrire",
    "couper": "coupe, coupes, coupons, coupez, coupent, coupé, je vais couper",
    "lancer": "lance, lances, lançons, lancez, lancent, lancé, je vais lancer",
    "attraper": "attrape, attrapes, attrapons, attrapez, attrapent, attrapé, je vais attraper",
    "donner un coup de pied": "donne un coup de pied, donnes un coup de pied, donnons un coup de pied, donnez un coup de pied, donnent un coup de pied, donné un coup de pied, je vais donner un coup de pied",
    "pousser": "pousse, pousses, poussons, poussez, poussent, poussé, je vais pousser",
    "tirer": "tire, tires, tirons, tirez, tirent, tiré, je vais tirer",
    "grimper": "grimpe, grimpes, grimpons, grimpez, grimpent, grimpé, je vais grimper",
    "donner": "donne, donnes, donnons, donnez, donnent, donné, je vais donner",
    "prendre": "prends, prend, prenons, prenez, prennent, pris, je vais prendre",
    "trouver": "trouve, trouves, trouvons, trouvez, trouvent, trouvé, je vais trouver",
    "montrer": "montre, montres, montrons, montrez, montrent, montré, je vais montrer",
    "raconter": "raconte, racontes, racontons, racontez, racontent, raconté, je vais raconter",
    "faire un câlin": "fais un câlin, fait un câlin, faisons un câlin, faites un câlin, font un câlin, je vais faire un câlin",
    "faire un bisou": "fais un bisou, fait un bisou, faisons un bisou, faites un bisou, font un bisou, je vais faire un bisou",
    "attends": "-",
    "savoir": "sais, sait, savons, savez, savent, su, je vais savoir",
    "penser": "pense, penses, pensons, pensez, pensent, pensé, je vais penser",
    "réparer": "répare, répares, réparons, réparez, réparent, réparé, je vais réparer",
    "nettoyer": "nettoie, nettoies, nettoyons, nettoyez, nettoient, nettoyé, je vais nettoyer",
    "cuisiner": "cuisine, cuisines, cuisinons, cuisinez, cuisinent, cuisiné, je vais cuisiner",
    "acheter": "achète, achètes, achetons, achetez, achètent, acheté, je vais acheter",
    "monter": "monte, montes, montons, montez, montent, monté, je vais monter",
    "se cacher": "me cache, te caches, se cache, nous cachons, vous cachez, se cachent, caché, je vais me cacher",
    "se réveiller": "me réveille, te réveilles, se réveille, nous réveillons, vous réveillez, se réveillent, réveillé, je vais me réveiller",
    "essayer": "essaie, essaies, essayons, essayez, essaient, essayé, je vais essayer",
    "tenir": "tiens, tient, tenons, tenez, tiennent, tenu, je vais tenir",
    "porter": "porte, portes, portons, portez, portent, porté, je vais porter",
    "brosser": "brosse, brosses, brossons, brossez, brossent, brossé, je vais brosser",
    "fermer": "ferme, fermes, fermons, fermez, ferment, fermé, je vais fermer",
    "venir": "viens, vient, venons, venez, viennent, venu, je vais venir",
    "dire": "dis, dit, disons, dites, disent, je vais dire",
    "demander": "demande, demandes, demandons, demandez, demandent, demandé, je vais demander",
    "appeler": "appelle, appelles, appelons, appelez, appellent, appelé, je vais appeler",
    "utiliser": "utilise, utilises, utilisons, utilisez, utilisent, utilisé, je vais utiliser",
    "travailler": "travaille, travailles, travaillons, travaillez, travaillent, travaillé, je vais travailler",
    "apprendre": "apprends, apprend, apprenons, apprenez, apprennent, appris, je vais apprendre",
    "finir": "finis, finit, finissons, finissez, finissent, fini, je vais finir",
    "commencer": "commence, commences, commençons, commencez, commencent, commencé, je vais commencer",
    "pause": "-",
    "partager": "partage, partages, partageons, partagez, partagent, partagé, je vais partager",
    "choisir": "choisis, choisit, choisissons, choisissez, choisissent, choisi, je vais choisir",
    "garder": "garde, gardes, gardons, gardez, gardent, gardé, je vais garder",
    "apporter": "apporte, apportes, apportons, apportez, apportent, apporté, je vais apporter",
    "bouger": "bouge, bouges, bougeons, bougez, bougent, bougé, je vais bouger",
    "toucher": "touche, touches, touchons, touchez, touchent, touché, je vais toucher",
    "sentir": "sens, sent, sentons, sentez, sentent, senti, je vais sentir",
    "est": "-",
    "sont": "-",
    "était": "-",
    "étaient": "-",
    "va": "-",
    "a fait": "-",
    "fait": "-",
    "avoir mal": "ai mal, as mal, a mal, avons mal, avez mal, ont mal, eu mal, je vais avoir mal",
    "saigner": "saigne, saignes, saignons, saignez, saignent, saigné, je vais saigner",
    "vomir": "vomis, vomit, vomissons, vomissez, vomissent, vomi, je vais vomir",
    "enfiler": "enfile, enfiles, enfilons, enfilez, enfilent, enfilé, je vais enfiler",
    "enlever": "enlève, enlèves, enlevons, enlevez, enlèvent, enlevé, je vais enlever",
    "se mettre en rang": "me mets en rang, te mets en rang, se met en rang, nous mettons en rang, vous mettez en rang, se mettent en rang, mis en rang, je vais me mettre en rang",
    "lever la main": "lève la main, lèves la main, levons la main, levez la main, lèvent la main, levé la main, je vais lever la main",
    "terminé": "-",
    "s'habiller": "m'habille, t'habilles, s'habille, nous habillons, vous habillez, s'habillent, habillé, je vais m'habiller",
    "se brosser les dents": "me brosse les dents, te brosses les dents, se brosse les dents, nous brossons les dents, vous brossez les dents, se brossent les dents, brossé les dents, je vais me brosser les dents",
    "se laver les mains": "me lave les mains, te laves les mains, se lave les mains, nous lavons les mains, vous lavez les mains, se lavent les mains, lavé les mains, je vais me laver les mains",
    "prendre un bain": "prends un bain, prend un bain, prenons un bain, prenez un bain, prennent un bain, pris un bain, je vais prendre un bain",
    "prendre une douche": "prends une douche, prend une douche, prenons une douche, prenez une douche, prennent une douche, pris une douche, je vais prendre une douche",
    "se coiffer": "me coiffe, te coiffes, se coiffe, nous coiffons, vous coiffez, se coiffent, coiffé, je vais me coiffer",
    "aller au lit": "vais au lit, vas au lit, va au lit, allons au lit, allez au lit, vont au lit, allé au lit, je vais aller au lit",
    "faire pipi": "fais pipi, fait pipi, faisons pipi, faites pipi, font pipi, je vais faire pipi",
    "faire caca": "fais caca, fait caca, faisons caca, faites caca, font caca, je vais faire caca",
    "tirer la chasse": "tire la chasse, tires la chasse, tirons la chasse, tirez la chasse, tirent la chasse, tiré la chasse, je vais tirer la chasse",
    "prendre le petit-déjeuner": "prends le petit-déjeuner, prend le petit-déjeuner, prenons le petit-déjeuner, prenez le petit-déjeuner, prennent le petit-déjeuner, pris le petit-déjeuner, je vais prendre le petit-déjeuner",
    "déjeuner": "déjeune, déjeunes, déjeunons, déjeunez, déjeunent, déjeuné, je vais déjeuner",
    "dîner": "dîne, dînes, dînons, dînez, dînent, dîné, je vais dîner",
    "prendre un médicament": "prends un médicament, prend un médicament, prenons un médicament, prenez un médicament, prennent un médicament, pris un médicament, je vais prendre un médicament",
    "sieste": "-",
    "ranger": "range, ranges, rangeons, rangez, rangent, rangé, je vais ranger",
    "nourrir l'animal": "nourris l'animal, nourrit l'animal, nourrissons l'animal, nourrissez l'animal, nourrissent l'animal, nourri l'animal, je vais nourrir l'animal",
    "préparer le sac": "prépare le sac, prépares le sac, préparons le sac, préparez le sac, préparent le sac, préparé le sac, je vais préparer le sac",
    "mettre les chaussures": "mets les chaussures, met les chaussures, mettons les chaussures, mettez les chaussures, mettent les chaussures, mis les chaussures, je vais mettre les chaussures",
    "avoir besoin de": "ai besoin de, as besoin de, a besoin de, avons besoin de, avez besoin de, ont besoin de, eu besoin de, je vais avoir besoin de",
    "se balancer": "me balance, te balances, se balance, nous balançons, vous balancez, se balancent, balancé, je vais me balancer",
    "respirer profondément": "respire profondément, respires profondément, respirons profondément, respirez profondément, respirent profondément, respiré profondément, je vais respirer profondément",
    "tourner": "tourne, tournes, tournons, tournez, tournent, tourné, je vais tourner",
    "stimmer": "stimme, stimmes, stimmons, stimmez, stimment, stimmé, je vais stimmer",
    "compter": "compte, comptes, comptons, comptez, comptent, compté, je vais compter",
    "ouvrir": "ouvre, ouvres, ouvrons, ouvrez, ouvrent, ouvert, je vais ouvrir",
    "allumer": "allume, allumes, allumons, allumez, allument, allumé, je vais allumer",
    "éteindre": "éteins, éteint, éteignons, éteignez, éteignent, je vais éteindre",
    "charger": "charge, charges, chargeons, chargez, chargent, chargé, je vais charger",
    "payer": "paie, paies, payons, payez, paient, payé, je vais payer",
    "regarder": "regarde, regardes, regardons, regardez, regardent, regardé, je vais regarder",
    "faire la queue": "fais la queue, fait la queue, faisons la queue, faites la queue, font la queue, je vais faire la queue",
    "se reposer": "me repose, te reposes, se repose, nous reposons, vous reposez, se reposent, reposé, je vais me reposer",
    "respirer": "respire, respires, respirons, respirez, respirent, respiré, je vais respirer",
    "chercher": "cherche, cherches, cherchons, cherchez, cherchent, cherché, je vais chercher",
    "faire": "fais, fait, faisons, faites, font, je vais faire",
    "mettre": "mets, met, mettons, mettez, mettent, mis, je vais mettre",
    "fabriquer": "fabrique, fabriques, fabriquons, fabriquez, fabriquent, fabriqué, je vais fabriquer",
    "pouvoir": "peux, peut, pouvons, pouvez, peuvent, pu, je vais pouvoir",
  },
  pt: {
    "querer": "quero, queres, quer, queremos, querem, quis, querendo, querido, vou querer",
    "ajuda": "-",
    "ir": "vou, vais, vai, vamos, vão, fui, foi, indo, ido",
    "brincar": "brinco, brincas, brinca, brincamos, brincam, brinquei, brincou, brincando, brincado, vou brincar",
    "gostar": "gosto de, gosta de, gostamos de, gostam de, gostei de, gostou de, gostando",
    "acabou": "-",
    "comer": "como, comes, come, comemos, comem, comi, comeu, comendo, comido, vou comer",
    "beber": "bebo, bebes, bebe, bebemos, bebem, bebi, bebeu, bebendo, bebido, vou beber",
    "servir": "sirvo, serves, serve, servimos, servem, servi, serviu, servindo, servido, vou servir",
    "sentir": "sinto, sentes, sente, sentimos, sentem, senti, sentiu, sentindo, sentido, vou sentir",
    "estar": "estou, estás, está, estamos, estão, estive, esteve, estando, estado, vou estar",
    "precisar de uma pausa": "preciso de uma pausa, precisas de uma pausa, precisa de uma pausa, precisamos de uma pausa, precisam de uma pausa, precisei de uma pausa, precisou de uma pausa, precisando de uma pausa, precisado de uma pausa, vou precisar de uma pausa",
    "precisar de espaço": "preciso de espaço, precisas de espaço, precisa de espaço, precisamos de espaço, precisam de espaço, precisei de espaço, precisou de espaço, precisando de espaço, precisado de espaço, vou precisar de espaço",
    "amar": "amo, amas, ama, amamos, amam, amei, amou, amando, amado, vou amar",
    "ir para": "vou para, vais para, vai para, vamos para, vão para, fui para, foi para, indo para, ido para",
    "sair": "saio, sais, sai, saímos, saem, saí, saiu, saindo, saído, vou sair",
    "ficar": "fico, ficas, fica, ficamos, ficam, fiquei, ficou, ficando, ficado, vou ficar",
    "vez": "-",
    "para": "-",
    "fazer cócegas": "faço cócegas, fazes cócegas, faz cócegas, fazemos cócegas, fazem cócegas, fiz cócegas, fez cócegas, fazendo cócegas, feito cócegas, vou fazer cócegas",
    "correr atrás": "corro atrás, corres atrás, corre atrás, corremos atrás, correm atrás, corri atrás, correu atrás, correndo atrás, corrido atrás, vou correr atrás",
    "esconde-esconde": "-",
    "cantar": "canto, cantas, canta, cantamos, cantam, cantei, cantou, cantando, cantado, vou cantar",
    "dançar": "danço, danças, dança, dançamos, dançam, dancei, dançou, dançando, dançado, vou dançar",
    "ler": "leio, lês, lê, lemos, leem, li, leu, lendo, lido, vou ler",
    "desenhar": "desenho, desenhas, desenha, desenhamos, desenham, desenhei, desenhou, desenhando, desenhado, vou desenhar",
    "construir": "construo, constróis, constrói, construímos, constroem, construí, construiu, construindo, construído, vou construir",
    "dormir": "durmo, dormes, dorme, dormimos, dormem, dormi, dormiu, dormindo, dormido, vou dormir",
    "sentar": "sento, sentas, senta, sentamos, sentam, sentei, sentou, sentando, sentado, vou sentar",
    "levantar": "levanto, levantas, levanta, levantamos, levantam, levantei, levantou, levantando, levantado, vou levantar",
    "andar": "ando, andas, anda, andamos, andam, andei, andou, andando, andado, vou andar",
    "correr": "corro, corres, corre, corremos, correm, corri, correu, correndo, corrido, vou correr",
    "pular": "pulo, pulas, pula, pulamos, pulam, pulei, pulou, pulando, pulado, vou pular",
    "lavar": "lavo, lavas, lava, lavamos, lavam, lavei, lavou, lavando, lavado, vou lavar",
    "assistir": "assisto, assistes, assiste, assistimos, assistem, assisti, assistiu, assistindo, assistido, vou assistir",
    "escutar": "escuto, escutas, escuta, escutamos, escutam, escutei, escutou, escutando, escutado, vou escutar",
    "nadar": "nado, nadas, nada, nadamos, nadam, nadei, nadou, nadando, nadado, vou nadar",
    "escrever": "escrevo, escreves, escreve, escrevemos, escrevem, escrevi, escreveu, escrevendo, escrito, vou escrever",
    "cortar": "corto, cortas, corta, cortamos, cortam, cortei, cortou, cortando, cortado, vou cortar",
    "jogar": "jogo, jogas, joga, jogamos, jogam, joguei, jogou, jogando, jogado, vou jogar",
    "agarrar": "agarro, agarras, agarra, agarramos, agarram, agarrei, agarrou, agarrando, agarrado, vou agarrar",
    "chutar": "chuto, chutas, chuta, chutamos, chutam, chutei, chutou, chutando, chutado, vou chutar",
    "empurrar": "empurro, empurras, empurra, empurramos, empurram, empurrei, empurrou, empurrando, empurrado, vou empurrar",
    "puxar": "puxo, puxas, puxa, puxamos, puxam, puxei, puxou, puxando, puxado, vou puxar",
    "subir": "subo, sobes, sobe, subimos, sobem, subi, subiu, subindo, subido, vou subir",
    "dar": "dou, dás, dá, damos, dão, dei, deu, dando, dado, vou dar",
    "levar": "levo, levas, leva, levamos, levam, levei, levou, levando, levado, vou levar",
    "encontrar": "encontro, encontras, encontra, encontramos, encontram, encontrei, encontrou, encontrando, encontrado, vou encontrar",
    "mostrar": "mostro, mostras, mostra, mostramos, mostram, mostrei, mostrou, mostrando, mostrado, vou mostrar",
    "contar": "conto, contas, conta, contamos, contam, contei, contou, contando, contado, vou contar",
    "abraçar": "abraço, abraças, abraça, abraçamos, abraçam, abracei, abraçou, abraçando, abraçado, vou abraçar",
    "beijar": "beijo, beijas, beija, beijamos, beijam, beijei, beijou, beijando, beijado, vou beijar",
    "espera": "-",
    "saber": "sei, sabes, sabe, sabemos, sabem, soube, sabendo, sabido, vou saber",
    "pensar": "penso, pensas, pensa, pensamos, pensam, pensei, pensou, pensando, pensado, vou pensar",
    "consertar": "conserto, consertas, conserta, consertamos, consertam, consertei, consertou, consertando, consertado, vou consertar",
    "limpar": "limpo, limpas, limpa, limpamos, limpam, limpei, limpou, limpando, limpado, vou limpar",
    "cozinhar": "cozinho, cozinhas, cozinha, cozinhamos, cozinham, cozinhei, cozinhou, cozinhando, cozinhado, vou cozinhar",
    "comprar": "compro, compras, compra, compramos, compram, comprei, comprou, comprando, comprado, vou comprar",
    "andar de": "ando de, andas de, anda de, andamos de, andam de, andei de, andou de, andando de, andado de, vou andar de",
    "esconder": "escondo, escondes, esconde, escondemos, escondem, escondi, escondeu, escondendo, escondido, vou esconder",
    "acordar": "acordo, acordas, acorda, acordamos, acordam, acordei, acordou, acordando, acordado, vou acordar",
    "tentar": "tento, tentas, tenta, tentamos, tentam, tentei, tentou, tentando, tentado, vou tentar",
    "segurar": "seguro, seguras, segura, seguramos, seguram, segurei, segurou, segurando, segurado, vou segurar",
    "carregar": "carrego, carregas, carrega, carregamos, carregam, carreguei, carregou, carregando, carregado, vou carregar",
    "escovar": "escovo, escovas, escova, escovamos, escovam, escovei, escovou, escovando, escovado, vou escovar",
    "fechar": "fecho, fechas, fecha, fechamos, fecham, fechei, fechou, fechando, fechado, vou fechar",
    "vir": "venho, vens, vem, vimos, vêm, vim, veio, vindo, vou vir",
    "dizer": "digo, dizes, diz, dizemos, dizem, disse, dizendo, dito, vou dizer",
    "perguntar": "pergunto, perguntas, pergunta, perguntamos, perguntam, perguntei, perguntou, perguntando, perguntado, vou perguntar",
    "chamar": "chamo, chamas, chama, chamamos, chamam, chamei, chamou, chamando, chamado, vou chamar",
    "usar": "uso, usas, usa, usamos, usam, usei, usou, usando, usado, vou usar",
    "trabalhar": "trabalho, trabalhas, trabalha, trabalhamos, trabalham, trabalhei, trabalhou, trabalhando, trabalhado, vou trabalhar",
    "aprender": "aprendo, aprendes, aprende, aprendemos, aprendem, aprendi, aprendeu, aprendendo, aprendido, vou aprender",
    "terminar": "termino, terminas, termina, terminamos, terminam, terminei, terminou, terminando, terminado, vou terminar",
    "começar": "começo, começas, começa, começamos, começam, comecei, começou, começando, começado, vou começar",
    "pausa": "-",
    "dividir": "divido, divides, divide, dividimos, dividem, dividi, dividiu, dividindo, dividido, vou dividir",
    "escolher": "escolho, escolhes, escolhe, escolhemos, escolhem, escolhi, escolheu, escolhendo, escolhido, vou escolher",
    "guardar": "guardo, guardas, guarda, guardamos, guardam, guardei, guardou, guardando, guardado, vou guardar",
    "trazer": "trago, trazes, traz, trazemos, trazem, trouxe, trazendo, trazido, vou trazer",
    "mover": "movo, moves, move, movemos, movem, movi, moveu, movendo, movido, vou mover",
    "tocar": "toco, tocas, toca, tocamos, tocam, toquei, tocou, tocando, tocado, vou tocar",
    "cheirar": "cheiro, cheiras, cheira, cheiramos, cheiram, cheirei, cheirou, cheirando, cheirado, vou cheirar",
    "é": "-",
    "são": "-",
    "foi": "-",
    "foram": "-",
    "fez": "-",
    "faz": "-",
    "dói": "-",
    "sangrar": "sangro, sangras, sangra, sangramos, sangram, sangrei, sangrou, sangrando, sangrado, vou sangrar",
    "vomitar": "vomito, vomitas, vomita, vomitamos, vomitam, vomitei, vomitou, vomitando, vomitado, vou vomitar",
    "vestir": "visto, vestes, veste, vestimos, vestem, vesti, vestiu, vestindo, vestido, vou vestir",
    "tirar": "tiro, tiras, tira, tiramos, tiram, tirei, tirou, tirando, tirado, vou tirar",
    "fazer fila": "faço fila, fazes fila, faz fila, fazemos fila, fazem fila, fiz fila, fez fila, fazendo fila, feito fila, vou fazer fila",
    "levantar a mão": "levanto a mão, levantas a mão, levanta a mão, levantamos a mão, levantam a mão, levantei a mão, levantou a mão, levantando a mão, levantado a mão, vou levantar a mão",
    "terminado": "-",
    "trocar de roupa": "troco de roupa, trocas de roupa, troca de roupa, trocamos de roupa, trocam de roupa, troquei de roupa, trocou de roupa, trocando de roupa, trocado de roupa, vou trocar de roupa",
    "escovar os dentes": "escovo os dentes, escovas os dentes, escova os dentes, escovamos os dentes, escovam os dentes, escovei os dentes, escovou os dentes, escovando os dentes, escovado os dentes, vou escovar os dentes",
    "lavar as mãos": "lavo as mãos, lavas as mãos, lava as mãos, lavamos as mãos, lavam as mãos, lavei as mãos, lavou as mãos, lavando as mãos, lavado as mãos, vou lavar as mãos",
    "tomar banho": "tomo banho, tomas banho, toma banho, tomamos banho, tomam banho, tomei banho, tomou banho, tomando banho, tomado banho, vou tomar banho",
    "chuveiro": "-",
    "pentear o cabelo": "penteio o cabelo, penteias o cabelo, penteia o cabelo, penteamos o cabelo, penteiam o cabelo, penteei o cabelo, penteou o cabelo, penteando o cabelo, penteado o cabelo, vou pentear o cabelo",
    "ir para a cama": "vou para a cama, vais para a cama, vai para a cama, vamos para a cama, vão para a cama, fui para a cama, foi para a cama, indo para a cama, ido para a cama",
    "fazer xixi": "faço xixi, fazes xixi, faz xixi, fazemos xixi, fazem xixi, fiz xixi, fez xixi, fazendo xixi, feito xixi, vou fazer xixi",
    "fazer cocô": "faço cocô, fazes cocô, faz cocô, fazemos cocô, fazem cocô, fiz cocô, fez cocô, fazendo cocô, feito cocô, vou fazer cocô",
    "dar descarga": "dou descarga, dás descarga, dá descarga, damos descarga, dão descarga, dei descarga, deu descarga, dando descarga, dado descarga, vou dar descarga",
    "tomar café da manhã": "tomo café da manhã, tomas café da manhã, toma café da manhã, tomamos café da manhã, tomam café da manhã, tomei café da manhã, tomou café da manhã, tomando café da manhã, tomado café da manhã, vou tomar café da manhã",
    "almoçar": "almoço, almoças, almoça, almoçamos, almoçam, almocei, almoçou, almoçando, almoçado, vou almoçar",
    "jantar": "janto, jantas, janta, jantamos, jantam, jantei, jantou, jantando, jantado, vou jantar",
    "tomar remédio": "tomo remédio, tomas remédio, toma remédio, tomamos remédio, tomam remédio, tomei remédio, tomou remédio, tomando remédio, tomado remédio, vou tomar remédio",
    "tirar uma soneca": "tiro uma soneca, tiras uma soneca, tira uma soneca, tiramos uma soneca, tiram uma soneca, tirei uma soneca, tirou uma soneca, tirando uma soneca, tirado uma soneca, vou tirar uma soneca",
    "arrumar": "arrumo, arrumas, arruma, arrumamos, arrumam, arrumei, arrumou, arrumando, arrumado, vou arrumar",
    "dar comida ao bichinho": "dou comida ao bichinho, dás comida ao bichinho, dá comida ao bichinho, damos comida ao bichinho, dão comida ao bichinho, dei comida ao bichinho, deu comida ao bichinho, dando comida ao bichinho, dado comida ao bichinho, vou dar comida ao bichinho",
    "arrumar a mochila": "arrumo a mochila, arrumas a mochila, arruma a mochila, arrumamos a mochila, arrumam a mochila, arrumei a mochila, arrumou a mochila, arrumando a mochila, arrumado a mochila, vou arrumar a mochila",
    "calçar os sapatos": "calço os sapatos, calças os sapatos, calça os sapatos, calçamos os sapatos, calçam os sapatos, calcei os sapatos, calçou os sapatos, calçando os sapatos, calçado os sapatos, vou calçar os sapatos",
    "precisar": "preciso, precisas, precisa, precisamos, precisam, precisei, precisou, precisando, precisado, vou precisar",
    "balançar": "balanço, balanças, balança, balançamos, balançam, balancei, balançou, balançando, balançado, vou balançar",
    "respirar fundo": "respiro fundo, respiras fundo, respira fundo, respiramos fundo, respiram fundo, respirei fundo, respirou fundo, respirando fundo, respirado fundo, vou respirar fundo",
    "girar": "giro, giras, gira, giramos, giram, girei, girou, girando, girado, vou girar",
    "fazer stim": "faço stim, fazes stim, faz stim, fazemos stim, fazem stim, fiz stim, fez stim, fazendo stim, feito stim, vou fazer stim",
    "abrir": "abro, abres, abre, abrimos, abrem, abri, abriu, abrindo, aberto, vou abrir",
    "ligar": "ligo, ligas, liga, ligamos, ligam, liguei, ligou, ligando, ligado, vou ligar",
    "desligar": "desligo, desligas, desliga, desligamos, desligam, desliguei, desligou, desligando, desligado, vou desligar",
    "pagar": "pago, pagas, paga, pagamos, pagam, paguei, pagou, pagando, pagado, vou pagar",
    "olhar": "olho, olhas, olha, olhamos, olham, olhei, olhou, olhando, olhado, vou olhar",
    "provar": "provo, provas, prova, provamos, provam, provei, provou, provando, provado, vou provar",
    "esperar na fila": "espero na fila, esperas na fila, espera na fila, esperamos na fila, esperam na fila, esperei na fila, esperou na fila, esperando na fila, esperado na fila, vou esperar na fila",
    "descansar": "descanso, descansas, descansa, descansamos, descansam, descansei, descansou, descansando, descansado, vou descansar",
    "respirar": "respiro, respiras, respira, respiramos, respiram, respirei, respirou, respirando, respirado, vou respirar",
    "pegar": "pego, pegas, pega, pegamos, pegam, peguei, pegou, pegando, pegado, vou pegar",
    "fazer": "faço, fazes, faz, fazemos, fazem, fiz, fez, fazendo, feito, vou fazer",
    "colocar": "coloco, colocas, coloca, colocamos, colocam, coloquei, colocou, colocando, colocado, vou colocar",
    "criar": "crio, crias, cria, criamos, criam, criei, criou, criando, criado, vou criar",
    "poder": "posso, podes, pode, podemos, podem, pude, pôde, podendo, podido, vou poder",
  },
};

/** All verb buttons a fresh profile can have (every layout, the quick bar), by the word they insert. */
function shippedVerbs(l: Lang): string[] {
  const words = new Set<string>();
  for (const layout of LAYOUTS) {
    const p = buildProfile('', layout, l);
    for (const c of [...Object.values(p.boards).flatMap((b) => b.cells), ...p.quickBar]) {
      if (c && c.type === 'verb') words.add(c.speak ?? c.label);
    }
  }
  return [...words];
}

describe('conjugation of every shipped verb', () => {
  for (const l of ['en', 'es', 'fr', 'pt'] as Lang[]) {
    it(`${l}: every default verb has the expected forms`, () => {
      setLang(l);
      try {
        const verbs = shippedVerbs(l);
        // A new default verb needs a checked fixture here.
        expect(verbs.filter((v) => !(v in VERB_FORMS[l])), 'verbs without a fixture').toEqual([]);
        const wrong = verbs
          .map((v) => [v, formsFor(v, 'verb').join(', ') || '-', VERB_FORMS[l][v]] as const)
          .filter(([, got, want]) => got !== want)
          .map(([v, got, want]) => `${v}\n  got:  ${got}\n  want: ${want}`);
        expect(wrong).toEqual([]);
      } finally {
        setLang('en');
      }
    });
  }
});

describe('grammar details', () => {
  it('Spanish: stem changes, spelling rules and reflexives', () => {
    expect(conjugate('servir', 0)).toBe('sirvo');
    expect(conjugate('mover', 4)).toBe('mueven');
    expect(conjugate('vestirse', 0)).toBe('me visto');
    expect(conjugate('lavarse los dientes', 3)).toBe('nos lavamos los dientes');
    expect(conjugate('conocer', 0)).toBe('conozco');
    expect(conjugate('enviar', 0)).toBe('envío');
    expect(conjugate('mantener', 1)).toBe('mantienes');
    expect(autoConjugate(['yo'], 'vestirse')).toEqual({ text: 'me visto', dropPrevious: 0 });
    expect(autoConjugate(['tú', 'no'], 'escoger')).toEqual({ text: 'escoges', dropPrevious: 0 });
  });
  it('French: elision, h aspiré, -oire nouns', () => {
    expect(autoConjugateFr(['je'], 'aimer')).toEqual({ text: "j'aime", dropPrevious: 1 });
    expect(autoConjugateFr(['je'], 'habiter')).toEqual({ text: "j'habite", dropPrevious: 1 });
    expect(autoConjugateFr(['je'], 'hurler')).toEqual({ text: 'hurle', dropPrevious: 0 });
    expect(autoConjugateFr(['je'], "s'habiller")).toEqual({ text: "m'habille", dropPrevious: 0 });
    expect(autoConjugateFr(['nous'], 'manger')).toEqual({ text: 'mangeons', dropPrevious: 0 });
    expect(autoConjugateFr(['je'], 'balançoire')).toBeNull();
    expect(isInfinitiveFr('boire')).toBe(true);
    expect(isInfinitiveFr('histoire')).toBe(false);
    expect(autoConjugateFr(['tu'], 'préférer')).toEqual({ text: 'préfères', dropPrevious: 0 });
  });
  it('Portuguese: -ear, -uir, preterite spelling', () => {
    expect(autoConjugatePt(['eu'], 'pentear o cabelo')).toEqual({ text: 'penteio o cabelo', dropPrevious: 0 });
    expect(autoConjugatePt(['ele'], 'construir')).toEqual({ text: 'constrói', dropPrevious: 0 });
    expect(autoConjugatePt(['eu'], 'conhecer')).toEqual({ text: 'conheço', dropPrevious: 0 });
    expect(PACKS.pt.forms!('colocar', 'verb')).toContain('coloquei');
  });
  it('English: no nonsense forms for function words', () => {
    expect(formsFor('what', 'question')).toEqual([]);
    expect(formsFor('my', 'pronoun')).toEqual([]);
    expect(verbForms('quit').ing).toBe('quitting');
    expect(verbForms('quiz').ing).toBe('quizzing');
  });
  it('capitalises a lone "i" only in English (defect 40)', () => {
    expect(joinWords([{ text: 'i' }, { text: "i'm" }, { text: 'ok' }], 'en')).toBe("I I'm ok");
    expect(joinWords([{ text: 'minha' }, { text: 'cabeça' }, { text: 'dói' }], 'pt')).toBe('minha cabeça dói');
    expect(joinWords([{ text: 'dói' }], 'en')).toBe('dói');
    expect(joinWords([{ text: 'i' }], 'es')).toBe('i');
  });
  it('the French keyboard types â û ë ï œ (defect 43)', () => {
    for (const rows of Object.values(PACKS.fr.keyboard)) {
      if (rows === PACKS.fr.keyboard.nums) continue;
      const keys = rows!.join('');
      for (const ch of 'âûëïœ') expect(keys, ch).toContain(ch);
    }
  });
});

/** The parts of a profile a language switch must restore exactly. */
function content(p: Profile) {
  return {
    boards: p.boards, rootId: p.rootId, quickBar: p.quickBar, phrases: p.phrases, phraseCategories: p.phraseCategories,
    schedules: p.schedules, aboutMe: p.aboutMe, language: p.settings.language, lang: p.settings.lang,
  };
}

/** A profile with the kinds of edits families make. */
function edited(lang: Lang): Profile {
  const p = buildProfile('Sam', 'full', lang);
  const food = p.boards.food;
  const cell = (en: string) => food.cells.find((c) => c && (c.key ?? c.label) === en)!;
  const pear = cell('pear');
  pear.hidden = true;
  const apple = cell('apple');
  apple.color = '#ffcc00';
  const home = p.boards.home;
  const free = home.cells.findIndex((c) => !c);
  if (free >= 0) home.cells[free] = { id: 'b-will', label: 'Will', type: 'noun', speak: 'my brother Will', forms: ["Will's"] };
  return p;
}

describe('language switches (defects 11, 12, 41, 44)', () => {
  for (const start of ['en', 'es'] as Lang[]) {
    for (const layout of LAYOUTS) {
      it(`${start} → … → ${start} round trip restores the whole ${layout} profile`, () => {
        const p0 = layout === 'full' ? edited(start) : buildProfile('Sam', layout, start);
        const order: Lang[] = start === 'en' ? ['es', 'fr', 'pt', 'en'] : ['fr', 'pt', 'en', 'es'];
        let p = p0;
        for (const l of order) p = translateProfile(p, l);
        expect(content(p)).toEqual(content(p0));
      });
    }
  }

  it('restores the English spoken text of built-in words ("how much?")', () => {
    const en = buildProfile('', 'full', 'en');
    const find = (p: Profile) => Object.values(p.boards).flatMap((b) => b.cells).find((c) => c && (c.key ?? c.label) === 'how much?')!;
    expect(find(en).speak).toBe('how much is it?');
    const es = translateProfile(en, 'es');
    expect(find(es).speak).toBe('¿cuánto cuesta?');
    expect(find(translateProfile(es, 'en')).speak).toBe('how much is it?');
  });

  it('keeps a relabelled built-in button as the family\'s own word', () => {
    const es = buildProfile('', 'full', 'es');
    const b = es.boards.food.cells.find((c) => c?.key === 'apple')!;
    // What ButtonEditor saves when the label changes: the key goes.
    delete b.key;
    b.label = 'pera';
    b.speak = 'quiero pera';
    b.forms = ['peras'];
    expect(secondWord(b, 'es', 'en')).toBeUndefined();
    const en = translateProfile(es, 'en');
    const same = en.boards.food.cells.find((c) => c?.id === b.id)!;
    expect(same).toMatchObject({ label: 'pera', speak: 'quiero pera', forms: ['peras'] });
    expect(same.key).toBeUndefined();
    const fr = translateProfile(en, 'fr');
    expect(fr.boards.food.cells.find((c) => c?.id === b.id)).toMatchObject({ label: 'pera', speak: 'quiero pera' });
  });

  it('keeps a built-in button whose spoken text the family changed', () => {
    const es = buildProfile('', 'full', 'es');
    const b = es.boards.food.cells.find((c) => c?.key === 'apple')!;
    b.speak = 'quiero una manzana roja';
    const en = translateProfile(es, 'en');
    expect(en.boards.food.cells.find((c) => c?.id === b.id)).toMatchObject({ label: 'manzana', speak: 'quiero una manzana roja' });
  });

  it('does not translate names that look like words ("Will", "Cookie")', () => {
    const en = buildProfile('', 'full', 'en');
    const home = en.boards.home;
    const add = (b: AACButton) => { home.cells[home.cells.findIndex((c) => !c)] = b; };
    if (!home.cells.some((c) => !c)) { home.rows += 1; home.cells.push(...Array(home.cols).fill(null)); }
    add({ id: 'x1', label: 'Will', type: 'noun' });
    if (!home.cells.some((c) => !c)) { home.rows += 1; home.cells.push(...Array(home.cols).fill(null)); }
    add({ id: 'x2', label: 'Cookie', type: 'noun' });
    const es = translateProfile(en, 'es');
    const labels = es.boards.home.cells.filter((c) => c?.id === 'x1' || c?.id === 'x2').map((c) => c!.label);
    expect(labels).toEqual(['Will', 'Cookie']);
    expect(secondWord({ id: 'x', label: 'Will', type: 'noun' }, 'en', 'es')).toBeUndefined();
    expect(es.boards.food.cells.some((c) => c?.key === 'cookie' && c.label === 'galleta')).toBe(true);
  });

  it('translates the default About me text, but not text the family wrote', () => {
    const en = buildProfile('Sam', 'big', 'en');
    expect(translateProfile(en, 'fr').aboutMe.text).toBe(aboutMeText('fr', 'Sam'));
    const noName = buildProfile('', 'big', 'pt');
    expect(translateProfile(noName, 'es').aboutMe.text).toBe(aboutMeText('es', ''));
    en.aboutMe.text = 'I love trains.';
    expect(translateProfile(en, 'es').aboutMe.text).toBe('I love trains.');
  });

  it('a layout change builds the boards in the profile language with keys (defect 5)', () => {
    for (const l of ['es', 'fr', 'pt'] as Lang[]) {
      const p = buildProfile('Ana', 'full', l);
      const words = p.boards.home.cells.filter((c) => c && !c.action && !c.link);
      expect(words.every((c) => c!.key), l).toBe(true);
      expect(words.find((c) => c!.key === 'want')!.label).toBe(PACKS[l].vocab!.labels.want);
    }
  });
});

describe('starter words (defect 4)', () => {
  for (const layout of ['compact', 'medium', 'full'] as LayoutId[]) {
    it(`shows the same starter words in every language (${layout})`, () => {
      const mask = (l: Lang) => {
        const p = buildProfile('', layout, l);
        applyStarterWords(p.boards[p.rootId]);
        return p.boards[p.rootId].cells.map((c) => (c ? !c.hidden : null));
      };
      const en = mask('en');
      expect(en.filter((x) => x === true).length).toBeGreaterThan(12);
      for (const l of ['es', 'fr', 'pt'] as Lang[]) expect(mask(l), l).toEqual(en);
    });
  }
  it('matches built-in words on their English original', () => {
    expect(isStarterWord({ key: 'want', label: 'quiero' })).toBe(true);
    expect(isStarterWord({ label: 'want' })).toBe(true);
    expect(isStarterWord({ key: 'apple', label: 'want' })).toBe(false);
  });
  it('knows untouched default data (no auto-backup over real backups)', () => {
    const p = buildProfile('', 'medium', 'en');
    const data = { version: 1, profiles: [p], activeProfileId: p.id, onboarded: true, library: { categories: [], additions: {} } };
    expect(isUntouchedDefault(data)).toBe(true);
    p.updatedAt = Date.now();
    expect(isUntouchedDefault(data)).toBe(false);
  });
});

describe('symbol search', () => {
  it('is accent-insensitive and reaches the bundled index in other languages', () => {
    setLang('es');
    try {
      expect(englishMatches('platano', 'es').map((m) => m.en)).toContain('banana');
      const hits = searchLibrary(undefined, 'platano');
      expect(hits.some((s) => s.label === 'plátano')).toBe(true);
    } finally {
      setLang('en');
    }
  });
});

/** Files other work streams own (they wrap their own strings). */
const TSX = import.meta.glob(['../../components/**/*.tsx', '../../screens/**/*.tsx', '../../App.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
/** Visible text that is the same in every language. */
const SAME_EVERYWHERE = new Set(['Caleb', 'A', 'QWERTY', 'AZERTY', 'ABC', 'Language / Idioma', 'min']);

describe('visible text is wrapped in t() (defect 27)', () => {
  it('has no raw JSX text or literal placeholder/title/aria-label/alt', () => {
    const found: string[] = [];
    for (const [file, src0] of Object.entries(TSX)) {
      // Drop comments so they are not mistaken for text.
      const src = src0.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      const at = (i: number) => `${file.replace(/^(\.\.\/)+/, 'src/')}:${src.slice(0, i).split('\n').length}`;
      // Text between a tag's ">" (not "=>" or ">=") and the next "<" or "{".
      for (const m of src.matchAll(/(?<![=\-])>(?!=)([^<>{}]+)(?=[<{])/g)) {
        const text = m[1].trim();
        // Skip code that the pattern catches (arrow bodies, calls, conditions).
        if (!/[A-Za-z]{2,}/.test(text) || /=>|===|!==|;|&&|\|\||[\w\])]\(|^\)|\)$|=$/.test(text) || SAME_EVERYWHERE.has(text)) continue;
        found.push(`${at(m.index!)} ${text}`);
      }
      // Text after an expression and before a closing tag: "{n} folder(s) are not linked</p>".
      for (const m of src.matchAll(/\}([^<>{}`'"]*[A-Za-z]{2,}[^<>{}`'"]*)(?=<\/)/g)) {
        const text = m[1].trim();
        if (!text || /=>|===|!==|;|&&|\|\||[\w\])]\(|^\)|\)$|=$/.test(text) || SAME_EVERYWHERE.has(text)) continue;
        found.push(`${at(m.index!)} ${text}`);
      }
      for (const m of src.matchAll(/\b(placeholder|title|aria-label|alt)=(["'])([^"']*)\2/g)) {
        if (/[A-Za-z]{2,}/.test(m[3]) && !SAME_EVERYWHERE.has(m[3])) found.push(`${at(m.index!)} ${m[1]}="${m[3]}"`);
      }
    }
    expect(found).toEqual([]);
  });
});

describe('undo after a language switch (defect 11)', () => {
  it('clears undo so old-language boards never come back under the new voice', async () => {
    const { useStore, emptyLibrary } = await import('../../store');
    const p = buildProfile('Sam', 'medium', 'en');
    useStore.setState({ data: { ...useStore.getState().data, profiles: [p], activeProfileId: p.id, onboarded: true, library: emptyLibrary() }, undo: [] });
    useStore.getState().updateProfile((pp) => { pp.boards.home.cells[0]!.hidden = true; }, { undoable: true });
    expect(useStore.getState().undo.length).toBe(1);
    useStore.getState().setLanguage('es');
    expect(useStore.getState().undo).toEqual([]);
    expect(useStore.getState().profile().settings.language).toBe('es');
    useStore.getState().undoEdit(); // nothing to undo: still Spanish
    expect(useStore.getState().profile().boards.home.cells[0]!.label).toBe('yo');
    setLang('en');
  });
});

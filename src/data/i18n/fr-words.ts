/** ~600 common French words, most frequent first, lowercase (for keyboard prediction). */
export const FR_COMMON_WORDS: string[] = `je tu il elle on nous vous ils elles ça c'est est pas ne non oui de la le les
un une des et à en du au aux que qui quoi moi toi lui me te se mon ma mes ton ta tes son sa ses
veux peux vais suis ai as a fait faire aller être avoir vouloir pouvoir dire voir
est-ce bien très plus encore aussi trop beaucoup peu tout tous toute rien quelque chose
merci s'il plaît bonjour salut au revoir pardon d'accord ok maman papa maison eau manger jouer
boire maintenant ici là après avant aujourd'hui demain hier mais parce ou si alors quand
où comment pourquoi combien quel quelle qui avec pour sans dans sur sous chez par vers
j'ai j'aime j'en je veux sais sait savez fini finis terminé arrête attends aide aidez stop
regarde viens donne écoute laisse va vas allons allez vont veut voulons veulent peut pouvons
peuvent as avons avez ont es êtes sont étais était été faisons faites font fais dis dit
mal faim soif sommeil peur chaud froid envie besoin raison
content triste fatigué malade colère calme inquiet énervé perdu prêt fier seul gentil méchant
aime aimes adore préfère sens sent mange manges joue joues bois boit prends prend mets met
dors dort vois voit regarde regardes écoute écoutes parle parles lis lit écris écrit
cours court marche saute nage chante danse dessine ouvre ferme cherche trouve
attendre arrêter finir commencer aider partager tirer pousser monter descendre entrer sortir
venir revenir rester partir rentrer penser savoir connaître comprendre apprendre travailler
acheter payer utiliser cuisiner nettoyer ranger réparer casser toucher sentir goûter essayer
appeler demander répondre montrer raconter couper coller lancer attraper donner prendre mettre
dormir lire écrire parler écouter regarder chanter danser dessiner courir marcher sauter nager
s'asseoir se lever se laver s'habiller se réveiller se coucher se reposer se cacher
pleurer rire crier respirer bouger tourner tenir porter garder apporter choisir
allé fait mangé bu joué vu dit pris mis eu fini voulu pu dormi lu écrit venu parti
donne-moi aide-moi laisse-moi excuse-moi dis-moi montre-moi
bonne nuit bonsoir bravo super génial cool oups waouh youpi hé oh ah euh bon voilà
ami amie amis prof maîtresse maître frère sœur papi mamie bébé famille oncle tante cousin
cousine garçon fille enfant enfants homme femme gens monde docteur infirmier chien chat
nourriture petit-déjeuner déjeuner goûter dîner lait jus pain fruit pomme banane orange
raisin fraise biscuit bonbon chocolat glace gâteau pizza poulet viande poisson riz pâtes
frites œuf fromage soupe sandwich légumes carotte salade yaourt compote céréales
école classe devoirs récré livre crayon papier parc magasin toilettes chambre lit cuisine
salon voiture bus dehors dedans haut bas près loin rue fête plage piscine jardin
télé tablette téléphone ordinateur jeu vidéo musique chanson film dessin animé
ballon jouet poupée cube puzzle balançoire toboggan vélo lego peluche
vêtements t-shirt pantalon chaussures chaussettes manteau pull pyjama casquette lunettes
sac doudou couverture oreiller serviette savon brosse dents
tête main mains pied pieds jambe bras œil yeux oreille nez bouche dent ventre dos
cheveux visage doigt gorge cœur
rouge orange jaune vert bleu violet rose marron noir blanc gris
zéro deux trois quatre cinq six sept huit neuf dix vingt cent
lundi mardi mercredi jeudi vendredi samedi dimanche week-end anniversaire vacances
heure minute temps moment fois jour nuit matin soir midi semaine mois an année
question réponse idée problème chose truc place côté façon
facile difficile vite lent fort doux chaud propre sale plein vide ouvert fermé
grand petit long court lourd léger joli beau belle moche drôle amusant ennuyeux nul
vrai faux juste pareil différent cassé mouillé sec dur clair foncé neuf vieux nouveau
silence bruit lumière espace pause calme repos câlin bisou
toujours jamais parfois souvent déjà bientôt tard tôt tout de suite peut-être
premier dernier suivant prochain autre autres même chaque assez moins mieux pire
mon ton notre votre leur leurs nos vos ce cet cette ces ceci cela celui celle ceux
y en lequel laquelle quelqu'un personne tout le monde
autiste communiquer comprends parler patience appli`.split(/\s+/).filter(Boolean)
  .filter((w, i, all) => all.indexOf(w) === i);

/** Next-word suggestions for common words (like src/data/bigrams.ts but French). */
export const FR_BIGRAMS: Record<string, string[]> = {
  je: ['veux', 'suis', 'ne', 'peux', 'vais', 'sais', 'sens', "t'aime", 'voudrais', 'comprends'],
  "j'ai": ['faim', 'soif', 'mal', 'besoin', 'peur', 'sommeil', 'froid', 'chaud', 'fini', 'envie'],
  "j'aime": ['ça', 'bien', 'pas', 'jouer', 'le', 'la', 'les'],
  tu: ['veux', 'es', 'peux', 'as', 'vas', 'sais', 'viens', 'fais'],
  il: ['est', 'veut', 'a', 'va', 'peut', 'fait'],
  elle: ['est', 'veut', 'a', 'va', 'peut', 'fait'],
  on: ['va', 'peut', 'fait', 'joue', 'mange', 'rentre', 'est'],
  nous: ['allons', 'sommes', 'avons', 'pouvons', 'voulons'],
  ils: ['sont', 'ont', 'vont', 'veulent', 'peuvent'],
  ça: ['va', 'fait', 'suffit', 'me', 'marche', 'gratte'],
  "c'est": ['quoi', 'bon', 'fini', 'à', 'mon', 'drôle', 'trop', 'pas', 'super'],
  ne: ['sais', 'veux', 'peux', 'pas', 'comprends', 'touche'],
  pas: ['maintenant', 'ça', 'encore', 'moi', 'envie', 'beaucoup'],
  veux: ['pas', 'aller', 'manger', 'jouer', 'encore', 'boire', 'voir', 'ça', 'un', 'une'],
  peux: ['avoir', 'aller', 'jouer', 'pas', "m'aider", 'regarder'],
  vais: ['aller', 'bien', 'jouer', 'manger', 'à', 'au'],
  suis: ['fatigué', 'content', 'triste', 'malade', 'prêt', 'en', 'pas', 'perdu'],
  sens: ['mal', 'bien', 'triste', 'fatigué', 'seul'],
  besoin: ["d'aide", "d'une", 'de', "d'aller", "d'espace"],
  mal: ['à', 'au', 'aux'],
  aller: ['aux', 'à', 'au', 'dehors', 'jouer', 'dormir', 'chercher'],
  à: ['la', 'moi', 'toi', 'plus', 'demain', 'qui'],
  au: ['parc', 'revoir', 'lit', 'magasin', 'docteur'],
  aux: ['toilettes'],
  encore: ['un', 'une', 'du', 'de', "s'il"],
  "s'il": ['te', 'vous'],
  te: ['plaît', 'plait', 'aime'],
  vous: ['plaît'],
  où: ['est', 'sont', 'on', 'est-ce', 'va'],
  comment: ['ça', 'tu', 'on'],
  quand: ['est-ce', 'on', 'tu'],
  qui: ['est', 'a', 'va'],
  pourquoi: ['pas', 'tu', 'on'],
  est: ['où', 'là', 'fini', 'cassé', 'à', 'mon', 'trop'],
  mon: ['tour', 'ami', 'jouet', 'doudou', 'livre', 'frère'],
  ma: ['maman', 'chambre', 'tablette', 'sœur', 'famille', 'maison'],
  ton: ['tour', 'nom'],
  un: ['peu', 'moment', 'câlin', 'bisou', 'verre', 'biscuit'],
  une: ['pause', 'minute', 'fois', 'question', 'histoire'],
  aide: ['moi', "s'il"],
  très: ['bien', 'fatigué', 'content', 'bon'],
  bonjour: ['maman', 'papa'],
  merci: ['maman', 'papa', 'beaucoup'],
  bonne: ['nuit', 'journée'],
  laisse: ['moi', 'tomber'],
  plus: ['tard', 'fort', 'de', 'envie'],
  tout: ['seul', 'de', 'le', 'va', 'fini'],
  de: ['la', "l'eau", 'rien', 'plus'],
};

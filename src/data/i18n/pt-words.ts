/** ~600 common Brazilian Portuguese words, most frequent first, lowercase (for keyboard prediction). */
export const PT_COMMON_WORDS: string[] = `eu você não sim que o a de e é um uma isso isto meu minha
quero mais por para pra com em no na do da os as se me te lhe já bem muito ir vou ver fazer
tenho posso estou preciso ajuda obrigado obrigada favor oi tchau mamãe papai casa água comer
brincar beber agora aqui ali lá também mas porque quando onde como quem qual quanto quantos
nada algo tudo todos outro outra vez está estão são sou era foi foram ser estar ter poder querer
tem vai vamos vão quer queremos querem pode podemos podem tenho temos têm está estamos faz
faço fazemos fazem precisa precisamos gosto gosta gostamos gostam dói coça sinto sente
me dá me ajuda olha vem espera para chega
ele ela nós eles elas a gente mim ti comigo contigo nos seu sua seus suas meus minhas nosso
nossa este esta estes estas esse essa esses essas aquele aquela aquilo mesmo dele dela deles
dos das ao à sem sobre entre até desde contra durante antes depois então primeiro último
próximo logo tarde cedo hoje amanhã ontem noite dia semana mês ano manhã
sempre nunca às vezes ainda só sozinho sozinha juntos muita muitos muitas pouco pouca poucos
poucas demais bastante menos melhor pior tanto quase
bom boa ruim grande pequeno pequena novo velho feliz triste bravo brava cansado cansada
assustado assustada doente contente calmo preocupado entediado animado frustrado nervoso
confuso orgulhoso machucado sobrecarregado pronto pronta
fome sede sono frio calor medo dor vontade pressa
dormir assistir olhar escutar ouvir falar dizer ler escrever desenhar pintar cantar dançar
correr andar pular nadar sentar levantar deitar acordar vestir tomar banho lavar escovar
pentear abrir fechar colocar pôr tirar dar trazer levar procurar encontrar achar esperar
parar terminar começar ajudar dividir puxar empurrar subir descer entrar sair vir voltar
ficar sentir pensar saber conhecer entender aprender trabalhar estudar comprar pagar usar
cozinhar limpar arrumar consertar quebrar tocar cheirar provar tentar chamar ligar
desligar perguntar responder mostrar ensinar contar cortar colar jogar chutar abraçar
beijar amar gostar doer carregar pegar segurar guardar mexer girar descansar respirar
chorar rir gritar
como come comemos comem brinco brinca brincamos brincam bebo bebe tomo toma durmo dorme
vejo vê vemos olho escuto falo digo diz leio escrevo canto danço corro ando pulo nado abro
fecho coloco dou trago procuro encontro espero paro termino começo saio venho vem volto
penso sei sabe sabemos conheço entendo aprendo acho
fui fez fiz comi brinquei vi disse terminei tive pude quis estive acabou acabei gostei
desculpa licença claro opa ops uau legal ótimo eba ei
por favor de nada com licença bom dia boa tarde boa noite até mais até logo prazer
amigo amiga amigos professor professora irmão irmã vovô vovó bebê família tio tia primo
prima menino menina crianças homem mulher gente médico médica enfermeira terapeuta
cachorro gato
comida café almoço jantar lanche leite suco refrigerante pão fruta maçã banana laranja uva
morango biscoito bolacha doce chocolate sorvete bolo pizza frango carne peixe arroz feijão
ovo queijo batata sopa macarrão sanduíche hambúrguer verdura cenoura salada pipoca
escola aula lição recreio livro lápis papel parque loja banheiro quarto cama cozinha sala
carro ônibus fora dentro cima baixo perto longe rua festa praia piscina igreja shopping
tv tablet celular telefone computador jogo videogame vídeo música filme desenho
bola brinquedo boneca carrinho bloco balanço escorregador bicicleta
roupa camiseta camisa calça sapato tênis meia casaco blusa pijama boné óculos
mochila fone cobertor travesseiro toalha sabonete escova
cabeça mão mãos pé pés perna braço olho olhos orelha nariz boca dente dentes barriga
costas cabelo rosto dedo garganta coração
vermelho amarelo verde azul roxo rosa marrom preto branco cinza
zero dois três quatro cinco seis sete oito nove dez cem
segunda terça quarta quinta sexta sábado domingo fim aniversário férias
hora minuto tempo relógio momento pouquinho
pergunta resposta ideia problema coisa coisas lugar parte jeito vezes tipo
fácil difícil rápido devagar alto forte macio quente limpo sujo cheio vazio aberto
fechado comprido curto pesado leve bonito bonita feio engraçado divertido chato
certo errado igual diferente quebrado seguro molhado seco duro escuro claro
silêncio barulho luz espaço pausa calma
assim pois tomara talvez exato verdade mentira tá né daí aí
autista comunicar paciência entendo falar consigo consegue conseguir`.split(/\s+/).filter(Boolean)
  .filter((w, i, all) => all.indexOf(w) === i);

/** Next-word suggestions for common words (like src/data/bigrams.ts but Portuguese). */
export const PT_BIGRAMS: Record<string, string[]> = {
  eu: ['quero', 'preciso', 'estou', 'não', 'posso', 'tenho', 'sou', 'vou', 'gosto', 'também'],
  você: ['quer', 'é', 'está', 'pode', 'tem', 'sabe', 'vai', 'gosta'],
  ele: ['é', 'está', 'quer', 'tem', 'pode', 'vai'],
  ela: ['é', 'está', 'quer', 'tem', 'pode', 'vai'],
  nós: ['vamos', 'estamos', 'podemos', 'queremos', 'temos'],
  gente: ['vai', 'pode', 'está', 'quer', 'tem'],
  eles: ['são', 'estão', 'querem', 'têm', 'podem', 'vão'],
  isso: ['é', 'não', 'dói', 'está', 'aqui'],
  me: ['ajuda', 'dá', 'deixa', 'conta', 'espera', 'sinto'],
  não: ['quero', 'sei', 'gosto', 'posso', 'obrigado', 'mais', 'agora', 'é', 'tenho', 'consigo'],
  quero: ['ir', 'mais', 'comer', 'brincar', 'água', 'isso', 'ver', 'um', 'uma', 'meu'],
  preciso: ['de', 'ir', 'ajuda', 'mais', 'água', 'descansar', 'ficar'],
  de: ['nada', 'novo', 'ajuda', 'uma', 'um', 'mais', 'espaço', 'silêncio'],
  estou: ['bem', 'com', 'cansado', 'feliz', 'triste', 'bravo', 'doente', 'pronto'],
  com: ['fome', 'sede', 'sono', 'medo', 'frio', 'calor', 'dor', 'você', 'a'],
  tenho: ['que', 'fome', 'sede', 'medo', 'dor'],
  posso: ['ir', 'brincar', 'comer', 'ver', 'ter', 'pegar'],
  pode: ['me', 'ser', 'ir', 'esperar', 'repetir'],
  vou: ['para', 'pra', 'no', 'na', 'ao', 'brincar', 'comer'],
  vamos: ['para', 'pra', 'brincar', 'embora', 'juntos'],
  ir: ['para', 'pra', 'ao', 'embora', 'lá'],
  para: ['casa', 'a', 'o', 'mim', 'você', 'comer', 'brincar'],
  pra: ['casa', 'mim', 'você', 'escola', 'o', 'a'],
  ao: ['banheiro', 'parque', 'médico', 'shopping'],
  no: ['parque', 'carro', 'banheiro', 'quarto'],
  na: ['escola', 'casa', 'piscina', 'praia'],
  gosto: ['de', 'disso', 'muito', 'mais'],
  dói: ['muito', 'aqui', 'um'],
  sinto: ['muito', 'mal', 'bem', 'falta'],
  mais: ['um', 'uma', 'água', 'tempo', 'tarde', 'devagar'],
  por: ['favor', 'quê'],
  que: ['horas', 'legal', 'engraçado'],
  o: ['que', 'meu', 'seu'],
  onde: ['está', 'estão', 'fica', 'é'],
  como: ['você', 'assim', 'é', 'faz'],
  quando: ['vamos', 'a', 'é', 'chega'],
  quem: ['é', 'está', 'quer'],
  é: ['meu', 'seu', 'isso', 'muito', 'um', 'uma', 'minha', 'a'],
  meu: ['nome', 'quarto', 'amigo', 'tablet', 'pai', 'irmão'],
  minha: ['vez', 'mãe', 'casa', 'família', 'cabeça'],
  sua: ['vez', 'casa'],
  seu: ['nome', 'quarto'],
  um: ['pouco', 'pouquinho', 'minuto', 'momento', 'abraço'],
  uma: ['pausa', 'vez', 'pergunta', 'bolacha'],
  ajuda: ['por', 'aqui'],
  muito: ['bem', 'obrigado', 'cansado', 'feliz', 'gostoso', 'barulho'],
  oi: ['mamãe', 'papai', 'tudo'],
  tudo: ['bem', 'bom'],
  obrigado: ['mamãe', 'papai'],
  obrigada: ['mamãe', 'papai'],
  já: ['acabou', 'chegamos', 'vou', 'terminei'],
  te: ['amo', 'ajudo'],
  bom: ['dia'],
  boa: ['noite', 'tarde'],
  até: ['mais', 'logo', 'amanhã'],
};

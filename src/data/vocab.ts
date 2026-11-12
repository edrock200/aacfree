/**
 * Default vocabulary for Caleb.
 *
 * Kept dependency-free so `scripts/fetch-symbols.mjs` can import it directly
 * with Node's type stripping.
 *
 * Item notation (string):
 *   "x:label"            x = type code (see TYPE_CODES); omitted → category default
 *   "label|spoken text"  spoken / inserted text differs from the label
 *   "label@keyword"      ARASAAC search keyword override
 *   "label#1234"         explicit ARASAAC pictogram id
 *   "label~🙂"           emoji symbol
 *   ">boardId"           folder link (label/symbol from the target board)
 *   "!action"            special action button (keyboard, phrases, …)
 *   ""                   empty cell
 * Modifiers may be combined in this order: type:label|spoken@keyword#id~emoji
 */

export const TYPE_CODES: Record<string, string> = {
  p: 'pronoun',
  v: 'verb',
  d: 'descriptor',
  n: 'noun',
  s: 'social',
  q: 'question',
  r: 'preposition',
  x: 'negation',
  t: 'determiner',
  c: 'conjunction',
  m: 'misc',
};

export interface CategoryDef {
  id: string;
  name: string;
  /** Symbol spec (keyword / #id / ~emoji) for the folder button. */
  icon: string;
  type: string;
  items: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'food', name: 'Food', icon: 'food', type: 'noun',
    items: [
      'v:eat', 'd:hungry', 'd:yummy', 'd:yucky', 'v:want', 'x:no more|no more', 'd:more', 'v:all done@finished',
      'apple', 'banana', 'grapes', 'strawberry', 'orange@orange fruit', 'watermelon', 'blueberries@blueberry', 'pear',
      'bread', 'toast', 'cereal', 'pancakes@pancake', 'waffle', 'eggs@egg', 'bacon', 'oatmeal',
      'sandwich', 'pizza', 'pasta', 'macaroni and cheese@macaroni', 'rice', 'noodles', 'soup', 'tacos@taco',
      'chicken@chicken meat', 'chicken nuggets@nuggets', 'fish@fish food', 'hot dog', 'hamburger', 'french fries', 'meat', 'beans',
      'cheese', 'yogurt', 'crackers@cracker', 'chips@crisps', 'popcorn', 'pretzel', 'peanut butter', 'jelly@jam',
      'cookie', 'cake', 'ice cream', 'candy@sweets', 'chocolate', 'donut@doughnut', 'muffin', 'popsicle@ice lolly',
      'vegetables', 'carrot', 'broccoli', 'corn', 'peas', 'potato', 'salad', 'cucumber',
      'snack', 'breakfast', 'lunch', 'dinner', 'plate', 'bowl', 'spoon', 'fork',
    ],
  },
  {
    id: 'drinks', name: 'Drinks', icon: 'drink', type: 'noun',
    items: [
      'v:drink', 'd:thirsty', 'd:more', 'v:all done@finished', 'd:hot', 'd:cold', 'n:ice', 'v:pour',
      'water', 'milk', 'juice', 'apple juice', 'orange juice', 'chocolate milk', 'smoothie', 'hot chocolate',
      'tea', 'coffee', 'soda@soft drink', 'lemonade', 'cup', 'bottle', 'straw', 'water bottle',
    ],
  },
  {
    id: 'feelings', name: 'Feelings', icon: 'feelings', type: 'descriptor',
    items: [
      'p:I', 'v:feel', 'v:am|am', 'x:not', 'happy', 'sad', 'angry', 'scared',
      'tired', 'sick', 'excited', 'calm', 'frustrated', 'worried', 'silly', 'bored',
      'hurt', 'hungry', 'thirsty', 'overwhelmed', 'confused', 'proud', 'lonely', 'nervous',
      'embarrassed', 'surprised', 'shy', 'jealous', 'good', 'okay', 'bad', 'great',
      'too loud', 'too bright', 'v:need a break|need a break@break', 'v:need space|need space@alone', 'v:love', 'v:like', 'x:don\'t like|don\'t like@dislike', 'sleepy',
    ],
  },
  {
    id: 'people', name: 'People', icon: 'people', type: 'pronoun',
    items: [
      'I', 'me', 'you', 'he', 'she', 'they', 'we', 'it',
      'mom', 'dad', 'brother', 'sister', 'grandma', 'grandpa', 'baby', 'family',
      'friend', 'teacher', 'doctor', 'nurse', 'therapist', 'aunt', 'uncle', 'cousin',
      'boy', 'girl', 'man', 'woman', 'kids@children', 'everyone', 'someone', 'nobody',
      'my', 'your', 'his', 'her', 'our', 'their', 'mine', 'yours',
    ],
  },
  {
    id: 'places', name: 'Places', icon: 'places', type: 'noun',
    items: [
      'v:go', 'v:go to|go to@go', 'r:in', 'r:at', 'v:want', 'v:leave', 'v:stay', 'd:outside',
      'home', 'school', 'park', 'playground', 'store@shop', 'restaurant', 'bathroom', 'bedroom',
      'kitchen', 'living room', 'car', 'bus', 'doctor\'s office@doctor', 'hospital', 'library', 'pool@swimming pool',
      'beach', 'grandma\'s house|grandma\'s house@grandmother', 'zoo', 'farm', 'church', 'movies@cinema', 'party', 'friend\'s house@friend',
      'mall@shopping centre', 'gym', 'dentist', 'airport', 'train@train station', 'work', 'garden', 'upstairs',
    ],
  },
  {
    id: 'play', name: 'Play', icon: 'play', type: 'noun',
    items: [
      'v:play', 'v:want', 'v:turn|turn', 'm:my turn~☝️', 'm:your turn~👉', 'v:help', 'd:fun', 'v:stop',
      'ball', 'blocks', 'puzzle', 'doll', 'toy car', 'train', 'bubbles', 'tablet',
      'tv@television', 'video game', 'music', 'book', 'crayons@crayon', 'paint', 'play dough@modeling clay', 'lego@building blocks',
      'swing', 'slide', 'trampoline', 'bike@bicycle', 'scooter', 'sand', 'water', 'stuffed animal@teddy bear',
      'v:tickle', 'v:chase', 'v:hide and seek@hide', 'v:sing', 'v:dance', 'v:read', 'v:draw', 'v:build',
      'game', 'cards@playing cards', 'phone', 'computer', 'movie@film', 'youtube@video', 'song', 'outside',
    ],
  },
  {
    id: 'actions', name: 'Actions', icon: 'action', type: 'verb',
    items: [
      'eat', 'drink', 'sleep', 'sit', 'stand', 'walk', 'run', 'jump',
      'wash', 'read', 'watch', 'listen', 'sing', 'dance', 'swim', 'draw',
      'write', 'cut', 'throw', 'catch', 'kick', 'push', 'pull', 'climb',
      'give', 'take', 'find', 'show', 'tell', 'hug', 'kiss', 'wait',
      'know', 'think', 'love', 'fix', 'clean', 'cook', 'buy', 'ride',
      'hide', 'wake up', 'try', 'hold', 'carry', 'brush@brush teeth', 'close', 'come',
      'say', 'ask', 'call', 'use', 'work', 'learn', 'finish', 'start',
      'break#3369', 'share', 'pick', 'keep', 'bring', 'move', 'touch', 'smell',
    ],
  },
  {
    id: 'describe', name: 'Describe', icon: 'adjective', type: 'descriptor',
    items: [
      'big', 'little@small', 'hot', 'cold', 'fast', 'slow', 'good', 'bad',
      'loud', 'quiet', 'wet', 'dry', 'soft', 'hard', 'clean', 'dirty',
      'new', 'old', 'broken', 'easy', 'difficult', 'yummy', 'yucky', 'funny',
      'scary', 'full', 'empty', 'open', 'closed', 'high', 'low', 'long',
      'short', 'heavy', 'light', 'pretty', 'nice', 'mean', 'right', 'wrong',
      'very', 'too', 'really', 'again', 'fast', 'gently', 'together', 'alone',
    ],
  },
  {
    id: 'little', name: 'Little words', icon: 'word', type: 'determiner',
    items: [
      't:a', 't:the', 't:this', 't:that', 't:these', 't:those', 't:some', 't:all',
      'p:me', 'p:him', 'p:them', 'p:us', 'p:my', 'p:your', 'p:it', 'p:myself',
      'v:am', 'v:is', 'v:are', 'v:was', 'v:were', 'v:will', 'v:did', 'v:does',
      'x:not', 'x:don\'t', 'x:can\'t', 'x:won\'t', 'x:isn\'t', 'x:no', 'x:never', 'x:nothing',
      'r:to', 'r:of', 'r:for', 'r:with', 'r:from', 'r:by', 'r:about', 'r:off',
      'c:and', 'c:but', 'c:or', 'c:because', 'c:if', 'c:so', 'c:then', 'c:when',
    ],
  },
  {
    id: 'social', name: 'Social', icon: 'greet', type: 'social',
    items: [
      'hi@hello', 'bye@goodbye', 'please', 'thank you', 'sorry', 'excuse me', 'you\'re welcome', 'yes',
      'no', 'good morning', 'good night', 'how are you?|how are you?@how are you', 'I\'m fine|I\'m fine@fine', 'my name is|my name is@name', 'what\'s your name?|what\'s your name?@name', 'nice to meet you@meet',
      'I love you', 'see you later', 'good job', 'cool', 'uh oh', 'wow', 'yay@celebrate', 'oops',
      'I don\'t know|I don\'t know@not know', 'maybe', 'okay', 'awesome', 'me too', 'of course', 'leave me alone@alone', 'that\'s funny@laugh',
    ],
  },
  {
    id: 'questions', name: 'Questions', icon: 'question', type: 'question',
    items: [
      'what', 'where', 'who', 'when', 'why', 'how', 'which', 'how many',
      'what\'s that?|what\'s that?@what', 'where is|where is@where', 'can I|can I@can', 'can you|can you@can', 'is it|is it@question', 'do you|do you@question', 'what time|what time@clock', 'what\'s next?|what\'s next?@next',
      'how much', 'whose', 'are we there yet?|are we there yet?@arrive', 'what happened?|what happened?@what', 'why not?|why not?@why', 'how come?|how come?@why', 'what are you doing?|what are you doing?@do', 'where are we going?|where are we going?@go',
    ],
  },
  {
    id: 'body', name: 'Body', icon: 'body', type: 'noun',
    items: [
      'v:hurts|hurts@pain', 'd:itchy', 'd:sore@pain', 'v:feel', 'd:sick', 'd:dizzy', 'v:bleeding@blood', 'v:throw up@vomit',
      'head', 'eyes@eye', 'ears@ear', 'nose', 'mouth', 'teeth@tooth', 'tongue', 'hair',
      'face', 'neck', 'throat', 'shoulder', 'arm', 'elbow', 'hand', 'finger',
      'tummy@belly', 'back', 'chest', 'leg', 'knee', 'foot', 'toes@toe', 'bottom@buttocks',
      'skin', 'heart', 'medicine', 'band-aid@plaster', 'doctor', 'headache', 'tummy ache@stomach ache', 'toothache',
    ],
  },
  {
    id: 'clothes', name: 'Clothes', icon: 'clothes', type: 'noun',
    items: [
      'v:put on@dress', 'v:take off@undress', 'v:wear', 'd:too hot@hot', 'd:too cold@cold', 'd:itchy', 'd:tight', 'd:comfy@comfortable',
      'shirt@t-shirt', 'pants@trousers', 'shorts', 'dress#2613', 'skirt', 'socks@sock', 'shoes@shoe', 'jacket',
      'coat', 'hat', 'gloves@glove', 'pajamas', 'underwear@underpants', 'diaper@nappy', 'boots@boot', 'swimsuit@swimming costume',
      'sweater@jumper', 'hoodie@sweatshirt', 'glasses', 'backpack@rucksack', 'headphones', 'scarf', 'sandals@sandal', 'belt',
    ],
  },
  {
    id: 'animals', name: 'Animals', icon: 'animals', type: 'noun',
    items: [
      'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'pig', 'sheep',
      'chicken@hen', 'duck', 'rabbit', 'mouse', 'lion', 'tiger', 'elephant', 'monkey',
      'giraffe', 'bear', 'frog', 'snake', 'turtle', 'butterfly', 'bee', 'spider',
      'dinosaur', 'shark', 'whale', 'dolphin', 'penguin', 'owl', 'zebra', 'bug@insect',
    ],
  },
  {
    id: 'colors', name: 'Colors', icon: 'colours', type: 'descriptor',
    items: [
      'red', 'orange#2888', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown',
      'black', 'white', 'gray@grey', 'rainbow', 'gold', 'silver', 'light@light colour', 'dark@dark colour',
    ],
  },
  {
    id: 'numbers', name: 'Numbers', icon: 'numbers', type: 'descriptor',
    items: [
      'zero@0', 'one@1', 'two@2', 'three@3', 'four@4', 'five@5', 'six@6', 'seven@7',
      'eight@8', 'nine@9', 'ten@10', 'twenty@20', 'hundred@100', 'first', 'last', 'next',
      'more', 'less', 'many', 'few', 'all', 'none', 'half', 'count',
    ],
  },
  {
    id: 'time', name: 'Time', icon: 'time', type: 'descriptor',
    items: [
      'now', 'later', 'soon', 'today', 'tomorrow', 'yesterday', 'morning', 'afternoon',
      'evening', 'night', 'before', 'after', 'first', 'then', 'next', 'again',
      'wait', 'minute', 'hour', 'day', 'week', 'weekend', 'birthday', 'holiday',
      'always', 'never', 'sometimes', 'early', 'late', 'finished', 'time', 'clock',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'calendar',
    ],
  },
  {
    id: 'school', name: 'School', icon: 'school', type: 'noun',
    items: [
      'teacher', 'class@classroom', 'friend', 'desk', 'pencil', 'paper', 'book', 'scissors',
      'glue', 'computer', 'recess@playtime', 'lunch', 'bus', 'homework', 'art', 'music',
      'gym@physical education', 'math@mathematics', 'reading', 'writing', 'science', 'v:line up@queue', 'v:raise hand@raise hand', 'v:share',
      'v:help', 'v:finished', 'd:quiet', 'd:my turn', 'backpack@rucksack', 'lunchbox', 'whiteboard', 'test@exam',
    ],
  },
  {
    id: 'routines', name: 'Routines', icon: 'routine', type: 'verb',
    items: [
      'wake up', 'get dressed@dress', 'brush teeth', 'wash hands', 'bath', 'shower', 'brush hair@comb', 'go to bed@go to bed',
      'n:toilet', 'n:potty', 'n:bathroom', 'v:pee@urinate', 'v:poop@defecate', 'n:diaper@nappy', 'v:flush', 'n:towel',
      'eat breakfast@breakfast', 'eat lunch@lunch', 'eat dinner@dinner', 'take medicine@medicine', 'n:car ride@car', 'n:school', 'n:homework', 'n:screen time@tablet',
      'n:story@story', 'n:bedtime@bedtime', 'v:sleep', 'v:nap', 'v:clean up@tidy up', 'v:feed the pet@feed', 'v:pack bag@backpack', 'v:put on shoes@shoes',
    ],
  },
  {
    id: 'sensory', name: 'Calm & sensory', icon: 'relax', type: 'noun',
    items: [
      'v:need|need', 'v:break', 'd:too loud@noise', 'd:too bright@sun', 'd:too busy@crowd', 'v:stop', 'v:help', 'd:calm',
      'quiet place@silence', 'headphones', 'blanket', 'weighted blanket@blanket', 'fidget@fidget spinner', 'v:swing', 'v:rock@rocking chair', 'music',
      'hug', 'squeeze@hug', 'v:deep breath@breathe', 'v:walk', 'water', 'chewy@chewing gum', 'dim lights@lamp', 'alone time@alone',
      'v:jump', 'v:spin', 'v:stim@stereotypy', 'v:count', 'v:hide', 'd:safe', 'v:leave', 'tent',
    ],
  },
  {
    id: 'weather', name: 'Weather', icon: 'weather', type: 'descriptor',
    items: [
      'sunny', 'rainy', 'cloudy', 'windy', 'snowy@snow', 'stormy@storm', 'foggy@fog', 'hot',
      'cold', 'warm', 'n:rainbow', 'n:umbrella', 'n:sun', 'n:moon', 'n:stars@star', 'n:thunder',
    ],
  },
];

/** Folders shown on the "More" board, which lists every category. */
export const MORE_BOARD = ['>actions', '>describe', '>little', '>social', '>questions', '>people',
  '>food', '>drinks', '>feelings', '>places', '>play', '>body', '>clothes', '>animals', '>colors',
  '>numbers', '>time', '>school', '>routines', '>sensory', '>weather', '!keyboard', '!phrases', '!tools'];

/**
 * Home boards. Each layout is designed for a different device size and
 * motor ability. Words are arranged roughly left→right in sentence order
 * (pronouns → verbs → descriptors → questions → folders).
 */
export const HOME_LAYOUTS: Record<string, { cols: number; rows: number; cells: string[] }> = {
  // 4 × 3 — big targets, beginners, phones
  big: {
    cols: 4, rows: 3,
    cells: [
      'p:I', 'v:want', 'd:more', '>food',
      'v:help', 'v:go', 'v:play', '>feelings',
      'x:not', 'v:like', 'v:all done@finished', '>more',
    ],
  },
  // 6 × 5 — 30 cells
  medium: {
    cols: 6, rows: 5,
    cells: [
      'p:I', 'v:want', 'v:go', 'd:more', 'v:all done@finished', '>food',
      'p:you', 'v:help', 'v:eat', 'v:like', 'x:not', '>drinks',
      'p:it', 'v:stop', 'v:play', 'v:look', 'd:different', '>play',
      'p:me', 'v:get', 'v:drink', 'v:open', 'q:what', '>feelings',
      't:that', 'v:do', 'v:put', 'v:turn', 'q:where', '>more',
    ],
  },
  // 8 × 6 — 48 cells, Universal Core + folders (tablets)
  full: {
    cols: 8, rows: 6,
    cells: [
      'p:I', 'v:want', 'v:go', 'v:like', 'd:more', 'v:all done@finished', 'q:what', '>food',
      'p:you', 'v:help', 'v:get', 'v:look', 'd:different', 'd:same', 'q:where', '>drinks',
      'p:it', 'v:do', 'v:make', 'v:open', 'x:not', 't:some', 'q:who', '>play',
      'p:he', 'v:can', 'v:put', 'v:turn', 'r:up', 'r:on', 'q:when', '>feelings',
      'p:she', 'v:stop', 'v:eat', 'v:drink', 'r:in', 'd:here', 'q:why', '>people',
      'p:they', 'v:is', 'v:play', 'v:feel', 't:that', 't:all', '!morph', '>more',
    ],
  },
};

/** Always-visible quick bar. Protest words are always reachable. */
export const QUICK_BAR = [
  's:yes', 'x:no', 'x:stop', 'v:help', 'v:wait', 'v:break', 's:I don\'t know|I don\'t know@not know', 'm:Hey!|Hey!~👋',
];

export const PHRASE_CATEGORIES = ['Needs', 'Feelings', 'Boundaries', 'Chat', 'Questions', 'Emergency'];

export const DEFAULT_PHRASES: { category: string; text: string; icon?: string }[] = [
  { category: 'Needs', text: 'I need to use the bathroom.', icon: 'toilet' },
  { category: 'Needs', text: 'I am hungry.', icon: 'hungry' },
  { category: 'Needs', text: 'I am thirsty.', icon: 'thirsty' },
  { category: 'Needs', text: 'I need a break.', icon: 'break' },
  { category: 'Needs', text: 'I need help, please.', icon: 'help' },
  { category: 'Needs', text: 'I am tired.', icon: 'tired' },
  { category: 'Needs', text: 'I want to go home.', icon: 'home' },
  { category: 'Needs', text: 'Can I have some more, please?', icon: 'more' },
  { category: 'Feelings', text: 'I don\'t like that.', icon: 'dislike' },
  { category: 'Feelings', text: 'I feel frustrated.', icon: 'frustrated' },
  { category: 'Feelings', text: 'That hurts.', icon: 'pain' },
  { category: 'Feelings', text: 'I feel sick.', icon: 'sick' },
  { category: 'Feelings', text: 'I am happy!', icon: 'happy' },
  { category: 'Feelings', text: 'It is too loud.', icon: 'noise' },
  { category: 'Feelings', text: 'I feel overwhelmed.', icon: 'overwhelmed' },
  { category: 'Feelings', text: 'I love you.', icon: 'love' },
  { category: 'Boundaries', text: 'Please stop.', icon: 'stop' },
  { category: 'Boundaries', text: 'Leave me alone, please.', icon: 'alone' },
  { category: 'Boundaries', text: 'I need space.', icon: 'space' },
  { category: 'Boundaries', text: 'Please don\'t touch me.', icon: 'do not touch' },
  { category: 'Boundaries', text: 'Not now.', icon: 'no' },
  { category: 'Boundaries', text: 'I need quiet.', icon: 'silence' },
  { category: 'Boundaries', text: 'I need more time to answer.', icon: 'wait' },
  { category: 'Boundaries', text: 'I am done talking for now.', icon: 'finished' },
  { category: 'Chat', text: 'Hi! How are you?', icon: 'hello' },
  { category: 'Chat', text: 'I am doing well, thanks.', icon: 'fine' },
  { category: 'Chat', text: 'What did you do today?', icon: 'today' },
  { category: 'Chat', text: 'Do you want to play with me?', icon: 'play' },
  { category: 'Chat', text: 'That is so funny!', icon: 'laugh' },
  { category: 'Chat', text: 'Tell me more.', icon: 'tell' },
  { category: 'Chat', text: 'Wait, I am still talking.', icon: 'wait' },
  { category: 'Chat', text: 'See you later!', icon: 'goodbye' },
  { category: 'Questions', text: 'What are we doing next?', icon: 'next' },
  { category: 'Questions', text: 'When are we going home?', icon: 'home' },
  { category: 'Questions', text: 'Can you help me?', icon: 'help' },
  { category: 'Questions', text: 'Where are we going?', icon: 'go' },
  { category: 'Questions', text: 'Can I have a turn?', icon: 'turn' },
  { category: 'Questions', text: 'What is that?', icon: 'what' },
  { category: 'Emergency', text: 'I am autistic and I use this app to communicate. Please be patient.', icon: 'communication' },
  { category: 'Emergency', text: 'I am lost. Please help me.', icon: 'lost' },
  { category: 'Emergency', text: 'Please call my family.', icon: 'telephone' },
  { category: 'Emergency', text: 'I am hurt.', icon: 'pain' },
  { category: 'Emergency', text: 'I need a quiet place.', icon: 'silence' },
  { category: 'Emergency', text: 'I can understand you, I just can\'t talk right now.', icon: 'understand' },
];

export const DEFAULT_SCHEDULES: { name: string; steps: string[] }[] = [
  { name: 'Morning', steps: ['wake up', 'toilet', 'get dressed@dress', 'breakfast', 'brush teeth', 'shoes', 'backpack@rucksack', 'school'] },
  { name: 'Bedtime', steps: ['dinner', 'bath', 'pajamas', 'brush teeth', 'toilet', 'story', 'sleep'] },
];

/** Keywords needed for tools / misc UI that must be bundled offline. */
export const EXTRA_SYMBOLS = [
  'happy', 'sad', 'angry', 'scared', 'tired', 'sick', 'calm', 'hurt', 'pain', 'keyboard', 'phrase',
  'tools', 'first', 'then', 'now', 'next', 'later', 'finished', 'timer', 'schedule', 'choose', 'body',
  'more', 'home', 'communication', 'favourite', 'stop', 'pause', 'grammar',
];

/** Parse a spec string into its parts. */
export function parseSpec(spec: string, defaultType = 'misc') {
  let s = spec.trim();
  let type = defaultType;
  let emoji: string | undefined;
  let id: number | undefined;
  let keyword: string | undefined;
  let speak: string | undefined;
  const m = /^([a-z]):(.*)$/.exec(s);
  if (m && TYPE_CODES[m[1]]) {
    type = TYPE_CODES[m[1]];
    s = m[2];
  }
  const ei = s.indexOf('~');
  if (ei >= 0) { emoji = s.slice(ei + 1); s = s.slice(0, ei); }
  const hi = s.lastIndexOf('#');
  if (hi > 0 && /^\d+$/.test(s.slice(hi + 1))) { id = Number(s.slice(hi + 1)); s = s.slice(0, hi); }
  const ai = s.indexOf('@');
  if (ai >= 0) { keyword = s.slice(ai + 1); s = s.slice(0, ai); }
  const pi = s.indexOf('|');
  if (pi >= 0) { speak = s.slice(pi + 1); s = s.slice(0, pi); }
  const label = s;
  return { label, speak, type, keyword: keyword ?? label, id, emoji };
}

/** Every symbol keyword referenced by the default vocabulary. */
export function allKeywords(): string[] {
  const set = new Set<string>();
  const add = (spec: string) => {
    if (!spec || spec.startsWith('>') || spec.startsWith('!')) return;
    const p = parseSpec(spec);
    if (!p.emoji && !p.id) set.add(p.keyword.toLowerCase());
  };
  for (const c of CATEGORIES) { c.items.forEach(add); set.add(c.icon.toLowerCase()); }
  Object.values(HOME_LAYOUTS).forEach((l) => l.cells.forEach(add));
  QUICK_BAR.forEach(add);
  DEFAULT_PHRASES.forEach((p) => p.icon && set.add(p.icon.toLowerCase()));
  DEFAULT_SCHEDULES.forEach((s) => s.steps.forEach(add));
  EXTRA_SYMBOLS.forEach((k) => set.add(k));
  return [...set].sort();
}

import { FieldType, type FieldDescriptor, type KindDescriptor, type SelectOption } from './field-types.ts';

// The 11 content-kind descriptors — the single source of truth for the typed forms, the JSON-paste
// validation, AND the generated LLM prompt / sample JSON. Mirrors the backend zod schemas in
// apps/backend/src/features/admin/content-schemas.ts. Game descriptions are taken from each
// game's plugin header (PRD references in parentheses). When the backend schema changes, change
// it here too — it's the seam.

// ── Shared enum option sets (no inline variant strings — §0.5) ───────────────
const RATING_TIER_OPTIONS: readonly SelectOption[] = [
  { value: 'family', label: 'Family' },
  { value: 'friends', label: 'Friends' },
  { value: 'spicy', label: 'Spicy' },
  { value: 'eighteen_plus', label: '18+' },
];

const CONTENT_TAG_OPTIONS: readonly SelectOption[] = [
  { value: 'sexual', label: 'Sexual' },
  { value: 'religious', label: 'Religious' },
  { value: 'political', label: 'Political' },
  { value: 'physical', label: 'Physical' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'under_18_inappropriate', label: 'Under-18 inappropriate' },
];

const OBSCURITY_OPTIONS: readonly SelectOption[] = [
  { value: 'common', label: 'Common' },
  { value: 'academic', label: 'Academic' },
];

const TOD_KIND_OPTIONS: readonly SelectOption[] = [
  { value: 'truth', label: 'Truth' },
  { value: 'dare', label: 'Dare' },
];

const TRANSLATION_OPTIONS: readonly SelectOption[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'kjv', label: 'KJV' },
  { value: 'niv', label: 'NIV' },
  { value: 'nlt', label: 'NLT' },
  { value: 'yoruba', label: 'Yoruba' },
  { value: 'igbo', label: 'Igbo' },
  { value: 'hausa', label: 'Hausa' },
];

const TESTAMENT_OPTIONS: readonly SelectOption[] = [
  { value: 'both', label: 'Both' },
  { value: 'old', label: 'Old' },
  { value: 'new', label: 'New' },
];

const PASSAGE_LENGTH_OPTIONS: readonly SelectOption[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

const PASSAGE_SOURCE_OPTIONS: readonly SelectOption[] = [
  { value: 'general', label: 'General' },
  { value: 'nigerian', label: 'Nigerian' },
  { value: 'bible', label: 'Bible' },
  { value: 'pidgin', label: 'Pidgin' },
  { value: 'quotes', label: 'Quotes' },
];

// ── Shared field fragments ───────────────────────────────────────────────────
const ratingTier: FieldDescriptor = {
  name: 'ratingTier',
  label: 'Rating tier',
  type: FieldType.SELECT,
  required: true,
  options: RATING_TIER_OPTIONS,
  help: 'Every row must carry a tier (a missing tier is a rating-filter hole).',
  meaning:
    'The audience suitability of this item. Hosts pick which tiers are allowed for their room, so this gates who ever sees it. "family" = safe for everyone; "friends" = casual adult; "spicy" = suggestive; "eighteen_plus" = explicit.',
  sample: 'family',
};

const tags: FieldDescriptor = {
  name: 'tags',
  label: 'Tags',
  type: FieldType.MULTI_SELECT,
  options: CONTENT_TAG_OPTIONS,
  help: 'Optional content tags.',
  meaning:
    'Optional sensitivity tags. A host can EXCLUDE tags (e.g. drop anything "religious" or "political"), so tag honestly. Leave empty if none apply.',
  sample: [],
};

const difficulty: FieldDescriptor = {
  name: 'difficulty',
  label: 'Difficulty',
  type: FieldType.NUMBER,
  min: 1,
  max: 3,
  default: 1,
  help: '1–3.',
  meaning: 'Relative difficulty: 1 = easy, 2 = medium, 3 = hard.',
  sample: 1,
};

// quiz/bible questions sub-record
const questionFields: readonly FieldDescriptor[] = [
  { name: 'prompt', label: 'Prompt', type: FieldType.TEXTAREA, required: true, meaning: 'The question text shown to players.', sample: 'What is the capital of Nigeria?' },
  {
    name: 'options',
    label: 'Options',
    type: FieldType.STRING_ARRAY,
    required: true,
    exactItems: 4,
    help: 'Exactly 4 options.',
    meaning: 'Exactly 4 answer choices, in display order. One of them must be correct (see Correct option).',
    sample: ['Abuja', 'Lagos', 'Kano', 'Ibadan'],
  },
  {
    name: 'answerIdx',
    label: 'Correct option',
    type: FieldType.ANSWER_INDEX,
    required: true,
    optionsField: 'options',
    meaning: 'The 0-based index into options[] that is correct. 0 = first option, 3 = fourth. Must be 0–3 and point at the right answer above.',
    sample: 0,
  },
  { name: 'difficulty', label: 'Difficulty', type: FieldType.NUMBER, min: 1, max: 3, default: 1, meaning: 'Per-question difficulty, 1 (easy) – 3 (hard).', sample: 1 },
];

const questions: FieldDescriptor = {
  name: 'questions',
  label: 'Questions',
  type: FieldType.OBJECT_ARRAY,
  required: true,
  minItems: 1,
  fields: questionFields,
  meaning: 'The deck of questions. Each is a 4-option multiple-choice question with one correct answer.',
};

// ── Kind descriptors (mirror content-schemas.ts) ─────────────────────────────
export const KIND_DESCRIPTORS: readonly KindDescriptor[] = [
  {
    kind: 'quiz_deck',
    label: 'Quiz decks',
    titleField: 'title',
    description:
      'Quizzes (PRD §6.1 #1) — a simultaneous multiple-choice trivia game. A quiz deck is a themed set of 4-option questions; all players answer the same question at once and score is time-weighted.',
    fields: [
      { name: 'key', label: 'Key', type: FieldType.TEXT, required: true, unique: true, meaning: 'A stable, unique slug identifying this deck (lowercase-with-hyphens). Must be unique across all quiz decks — used to reference/replace the deck.', sample: 'nigeria-general-1' },
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'Human-readable deck name shown when choosing/queuing the deck.', sample: 'Nigeria: General Knowledge' },
      { name: 'category', label: 'Category', type: FieldType.TEXT, required: true, meaning: 'A free-text grouping label (e.g. "geography", "music", "history"). Used for organising decks.', sample: 'geography' },
      ratingTier,
      tags,
      questions,
    ],
  },
  {
    kind: 'word',
    label: 'Words',
    titleField: 'word',
    description:
      'The shared word pool. These words feed the casual word games — Missing Letters (PRD §6.1 #8, shows the word with gaps), Scrambled Word (#7, letters shuffled) and Spelling Fast (#3, word read aloud). Each row is ONE word plus metadata; the games sample words by length at play time.',
    fields: [
      { name: 'word', label: 'Word', type: FieldType.TEXT, required: true, meaning: 'A single word (letters only, no spaces). This is the answer players must produce. Keep it a real, common-enough word.', sample: 'banana' },
      { name: 'category', label: 'Category', type: FieldType.TEXT, required: true, meaning: 'A free-text grouping (e.g. "fruit", "animals", "everyday"). Used for organisation.', sample: 'fruit' },
      { name: 'startsWith', label: 'Starts with', type: FieldType.TEXT, required: true, maxLength: 1, help: 'A single letter.', meaning: 'The first letter of the word (a single character). Must match word[0].', selfRef: undefined, sample: 'b' },
      difficulty,
      { name: 'aliases', label: 'Aliases', type: FieldType.STRING_ARRAY, help: 'Optional accepted alternatives.', meaning: 'Optional alternative spellings/forms also accepted as correct (e.g. British/American spellings). Empty if none.', sample: [] },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'hot_take_prompt',
    label: 'Hot-take prompts',
    titleField: 'prompt',
    description:
      'Hot Take Court (PRD §6.3 #16) — a prompt is shown and each player submits a one-line defence/opinion, which the room then reacts to. A hot-take prompt is the single provocative statement or question that kicks this off.',
    fields: [
      { name: 'prompt', label: 'Prompt', type: FieldType.TEXTAREA, required: true, meaning: 'The provocative statement or question players respond to. Should invite a strong, funny, or divisive one-line take.', sample: 'Pineapple belongs on pizza.' },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'plead_scenario',
    label: 'Plead scenarios',
    titleField: 'charge',
    description:
      'Plead Your Case (PRD §6.4 #18) — a player is given a (often absurd) legal charge and must write a defence, which an AI scores on a rubric. A plead scenario is the case file: the charge plus the facts, laws, and precedents the defence can lean on.',
    fields: [
      { name: 'key', label: 'Key', type: FieldType.TEXT, required: true, unique: true, meaning: 'A stable, unique slug for this scenario (lowercase-with-hyphens). Unique across all plead scenarios.', sample: 'jollof-theft' },
      { name: 'charge', label: 'Charge', type: FieldType.TEXT, required: true, meaning: 'The accusation the defendant must argue against — short and punchy, ideally funny.', sample: 'Stealing the last piece of jollof rice at a family party.' },
      { name: 'defendant', label: 'Defendant', type: FieldType.TEXT, required: true, meaning: 'Who is on trial (a name or role). Sets the scene for the defence.', sample: 'Uncle Tunde' },
      { name: 'facts', label: 'Facts', type: FieldType.TEXTAREA, required: true, meaning: 'The agreed facts of the case — what actually happened. The defence works within these.', sample: 'At 9:42pm, Uncle Tunde was seen leaving the kitchen with a suspiciously full plate. The pot was empty.' },
      { name: 'laws', label: 'Laws', type: FieldType.TEXTAREA, required: true, meaning: '(Invented or real) laws/rules relevant to the charge that either side can cite.', sample: 'Party Etiquette Act §3: the last serving is communal property until claimed aloud.' },
      { name: 'precedents', label: 'Precedents', type: FieldType.TEXTAREA, required: true, meaning: 'Prior "cases"/precedents the defence or prosecution can reference for colour.', sample: 'In Aunty Bola v. The Family (2019), unannounced plating was ruled "fair game".' },
      ratingTier,
      tags,
      difficulty,
    ],
  },
  {
    kind: 'definition',
    label: 'Definitions',
    titleField: 'word',
    description:
      'Definition Race (PRD §6.1 #9) — a definition is shown and players race to type the word being defined. A definition row pairs the target word with the clue (its definition).',
    fields: [
      { name: 'word', label: 'Word', type: FieldType.TEXT, required: true, meaning: 'The target word players must guess from the definition. Letters only, no spaces.', sample: 'ephemeral' },
      { name: 'definition', label: 'Definition', type: FieldType.TEXTAREA, required: true, meaning: 'The clue: a clear definition of the word that does NOT contain the word itself.', sample: 'Lasting for a very short time.' },
      { name: 'obscurity', label: 'Obscurity', type: FieldType.SELECT, options: OBSCURITY_OPTIONS, default: 'common', meaning: 'How well-known the word is. "common" = everyday vocabulary; "academic" = advanced/rare.', sample: 'common' },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'thesaurus',
    label: 'Thesaurus',
    titleField: 'word',
    description:
      'Relation (PRD §6.1 #10) — a word-association game keyed on synonyms and antonyms. A thesaurus row is a base word with its lists of synonyms and antonyms.',
    fields: [
      { name: 'word', label: 'Word', type: FieldType.TEXT, required: true, meaning: 'The base word. Letters only, no spaces.', sample: 'happy' },
      { name: 'synonyms', label: 'Synonyms', type: FieldType.STRING_ARRAY, meaning: 'Words meaning the same / similar. Provide several distinct ones.', sample: ['joyful', 'cheerful', 'content'] },
      { name: 'antonyms', label: 'Antonyms', type: FieldType.STRING_ARRAY, meaning: 'Words meaning the opposite. Provide several distinct ones.', sample: ['sad', 'unhappy', 'miserable'] },
      { name: 'obscurity', label: 'Obscurity', type: FieldType.SELECT, options: OBSCURITY_OPTIONS, default: 'common', meaning: 'How well-known the base word is: "common" or "academic".', sample: 'common' },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'truth_or_dare_prompt',
    label: 'Truth or dare',
    titleField: 'prompt',
    description:
      'Truth or Dare (PRD §6.3 #13) — round-robin; the active player picks Truth or Dare and is handed a matching prompt. Each row is ONE prompt tagged as either a truth (a question) or a dare (an action).',
    fields: [
      { name: 'kind', label: 'Kind', type: FieldType.SELECT, required: true, options: TOD_KIND_OPTIONS, meaning: 'Whether this prompt is a "truth" (a question to answer honestly) or a "dare" (an action to perform). The prompt text must match this.', sample: 'truth' },
      { name: 'prompt', label: 'Prompt', type: FieldType.TEXTAREA, required: true, meaning: 'The truth question or dare instruction. For a truth, phrase it as a question; for a dare, as an action.', sample: 'What is the most embarrassing thing you’ve searched online?' },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'bible_quiz_deck',
    label: 'Bible quiz decks',
    titleField: 'title',
    description:
      'Bible Quiz (PRD §6.1 #2) — same mechanic as Quizzes (4-option, time-weighted, answers hidden) but scoped to scripture. A bible quiz deck adds a Bible translation and testament filter to a set of questions.',
    fields: [
      { name: 'key', label: 'Key', type: FieldType.TEXT, required: true, unique: true, meaning: 'A stable, unique slug for this deck (lowercase-with-hyphens). Unique across all bible quiz decks.', sample: 'gospels-easy-1' },
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'Human-readable deck name.', sample: 'The Gospels: Easy' },
      { name: 'translation', label: 'Translation', type: FieldType.SELECT, options: TRANSLATION_OPTIONS, default: 'mixed', meaning: 'Which Bible translation the questions assume. "mixed" if not specific.', sample: 'niv' },
      { name: 'testament', label: 'Testament', type: FieldType.SELECT, options: TESTAMENT_OPTIONS, default: 'both', meaning: 'Which testament the questions are drawn from: "old", "new", or "both".', sample: 'new' },
      ratingTier,
      tags,
      questions,
    ],
  },
  {
    kind: 'typing_passage',
    label: 'Typing passages',
    titleField: 'text',
    description:
      'Typing Fast (PRD §6.1 #4) — a passage is shown and players type it as fast and accurately as they can (score = WPM × accuracy). A typing passage is the block of text to be typed.',
    fields: [
      { name: 'text', label: 'Text', type: FieldType.TEXTAREA, required: true, meaning: 'The passage players type verbatim. Use normal punctuation; avoid unusual characters. Length should match the "length" field below.', sample: 'The early bird catches the worm, but the second mouse gets the cheese.' },
      { name: 'length', label: 'Length', type: FieldType.SELECT, options: PASSAGE_LENGTH_OPTIONS, default: 'medium', meaning: 'Rough length bucket: "short" (~1 sentence), "medium" (~2–3), "long" (a short paragraph). Should agree with the text.', sample: 'short' },
      { name: 'source', label: 'Source', type: FieldType.SELECT, options: PASSAGE_SOURCE_OPTIONS, default: 'general', meaning: 'Flavour of the text: "general", "nigerian", "bible", "pidgin", or "quotes".', sample: 'quotes' },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'presentation_topic',
    label: 'Presentation topics',
    titleField: 'topic',
    description:
      'Presentation (PRD §6.4 #19) — round-robin; each player must present a given topic aloud, on the spot, with no prep. A presentation topic is the single subject they have to riff on.',
    fields: [
      { name: 'topic', label: 'Topic', type: FieldType.TEXT, required: true, meaning: 'The subject the player must improvise a short talk about. Make it specific and funny enough to riff on.', sample: 'Why socks always disappear in the wash' },
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'investigation_case',
    label: 'Investigation cases',
    titleField: 'title',
    description:
      'Investigation (PRD §6.4 #17) — players are shown a case (brief, suspects, evidence, timeline), explore it on their phones during a time window, then privately accuse one suspect; the guilty party is revealed at the end and correct accusers score. An investigation case is the whole mystery: the setup, the cast of suspects, the evidence, an optional timeline, and (server-only) which suspect is actually guilty.',
    fields: [
      { name: 'key', label: 'Key', type: FieldType.TEXT, required: true, unique: true, meaning: 'A stable, unique slug for this case (lowercase-with-hyphens). Unique across all investigation cases.', sample: 'missing-jollof' },
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'The case name shown to players (e.g. "The Case of the Missing Jollof").', sample: 'The Case of the Missing Jollof' },
      { name: 'brief', label: 'Brief', type: FieldType.TEXTAREA, required: true, help: 'The case setup shown on the display.', meaning: 'The opening narration that frames the mystery — what happened, where, and what players must figure out. Do NOT reveal the culprit here.', sample: 'At a packed family party, the entire pot of jollof rice vanished between 9 and 10pm. Someone here is the thief. Find out who.' },
      {
        name: 'suspects',
        label: 'Suspects',
        type: FieldType.OBJECT_ARRAY,
        required: true,
        minItems: 2,
        meaning: 'The cast of people who COULD be guilty — players accuse one of these. Provide at least 2; exactly one is the culprit (named in solutionSuspectId).',
        samples: [
          { id: 's1', name: 'Uncle Tunde', profile: 'Notorious for going back for thirds. Claims he was outside on a call at 9:45pm.' },
          { id: 's2', name: 'Aunty Bola', profile: 'Was in charge of serving. Insists the pot was already empty when she checked.' },
        ],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this suspect within the case (e.g. "s1", "tunde"). Referenced by solutionSuspectId. Must be unique among this case’s suspects.', sample: 's1' },
          { name: 'name', label: 'Name', type: FieldType.TEXT, required: true, meaning: 'The suspect’s display name.', sample: 'Uncle Tunde' },
          { name: 'profile', label: 'Profile', type: FieldType.TEXTAREA, required: true, meaning: 'A short bio / motive / alibi for this suspect — the material players weigh when deciding.', sample: 'Notorious for going back for thirds. Claims he was outside taking a call at 9:45pm.' },
        ],
      },
      {
        name: 'evidence',
        label: 'Evidence',
        type: FieldType.OBJECT_ARRAY,
        required: true,
        minItems: 1,
        meaning: 'Clues players can inspect. At least 1. Together they should point (not too obviously) at the guilty suspect.',
        samples: [
          { id: 'e1', label: 'A half-eaten plate', detail: 'Found in the backyard — still warm, with a fork bearing Tunde’s initials.' },
          { id: 'e2', label: 'The serving spoon', detail: 'Wiped clean and put away early — unusual if the pot was still being served.' },
        ],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this evidence item within the case (e.g. "e1"). Must be unique among this case’s evidence.', sample: 'e1' },
          { name: 'label', label: 'Label', type: FieldType.TEXT, required: true, meaning: 'A short name for the clue shown in the list (e.g. "The empty pot").', sample: 'A half-eaten plate' },
          { name: 'detail', label: 'Detail', type: FieldType.TEXTAREA, required: true, meaning: 'The full description of the clue and what it might imply.', sample: 'Found in the backyard — still warm, with a fork bearing Tunde’s initials.' },
        ],
      },
      { name: 'timeline', label: 'Timeline', type: FieldType.STRING_ARRAY, help: 'Optional ordered events.', meaning: 'Optional ordered list of timestamped events that help players reason about alibis. Each entry is one event line, in chronological order. Empty if not used.', sample: ['9:00pm — Pot of jollof confirmed full.', '9:45pm — Tunde seen leaving the kitchen.', '10:00pm — Pot discovered empty.'] },
      { name: 'solutionSuspectId', label: 'Guilty suspect ID', type: FieldType.TEXT, required: true, selfRef: { field: 'suspects', element: 'id' }, meaning: 'The id of the suspect who is actually guilty. MUST exactly equal one of the suspects[].id values above. Kept server-only until the reveal.', sample: 's1' },
      difficulty,
      ratingTier,
      tags,
    ],
  },
];

export const KIND_BY_ID: Readonly<Record<string, KindDescriptor>> = Object.fromEntries(
  KIND_DESCRIPTORS.map((d) => [d.kind, d]),
);

export const descriptorFor = (kind: string): KindDescriptor | undefined => KIND_BY_ID[kind];

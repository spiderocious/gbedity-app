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

// ── Investigation enum option sets ───────────────────────────────────────────
const ALIBI_STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shaky', label: 'Shaky' },
  { value: 'broken', label: 'Broken' },
  { value: 'unchecked', label: 'Unverified' },
];
const REPORT_KIND_OPTIONS: readonly SelectOption[] = [
  { value: 'autopsy', label: 'Autopsy' },
  { value: 'forensic', label: 'Forensic' },
  { value: 'financial', label: 'Financial' },
  { value: 'digital', label: 'Digital' },
];
const FINDING_FLAG_OPTIONS: readonly SelectOption[] = [
  { value: 'key', label: 'Key lead' },
  { value: 'herring', label: 'Red herring' },
  { value: 'none', label: 'Neutral' },
];
const RELIABILITY_OPTIONS: readonly SelectOption[] = [
  { value: 'reliable', label: 'Reliable' },
  { value: 'questionable', label: 'Questionable' },
  { value: 'hostile', label: 'Hostile' },
];
const LINE_ROLE_OPTIONS: readonly SelectOption[] = [
  { value: 'q', label: 'Question' },
  { value: 'a', label: 'Answer' },
];
const TOOL_OUTCOME_OPTIONS: readonly SelectOption[] = [
  { value: 'hit', label: 'Hit' },
  { value: 'partial', label: 'Partial' },
  { value: 'dead_end', label: 'Dead end' },
];
const TOOL_ICON_OPTIONS: readonly SelectOption[] = [
  { value: 'identity', label: 'Identity Lookup' },
  { value: 'phone_records', label: 'Phone Records' },
  { value: 'call_log', label: 'Call Log' },
  { value: 'triangulation', label: 'Cell Triangulation' },
  { value: 'crime_db', label: 'Crime Database' },
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
      'Investigation (PRD §6.4 #17) — a rich detective case file. Players work suspects, forensic reports, witness statements, interview transcripts, a timeline, and investigative tools (whose lookups sometimes DEAD-END — that is the twist) on their phones within a time window, then submit a reasoned accusation: the culprit, the key evidence that proves it, and a confidence level. The truth + a written explanation are revealed at the end; correct accusers score (more for the right key evidence + higher confidence + speed). A case is the whole mystery; exactly one suspect is guilty (solutionSuspectId, server-only until reveal).',
    fields: [
      { name: 'key', label: 'Key', type: FieldType.TEXT, required: true, unique: true, meaning: 'A stable, unique slug for this case (lowercase-with-hyphens). Unique across all investigation cases.', sample: 'the-last-pour' },
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'The case name shown to players.', sample: 'The Last Pour' },
      { name: 'category', label: 'Category', type: FieldType.TEXT, required: true, default: 'Investigation', meaning: 'A short genre label shown in the case-file header (e.g. "Suspected Homicide", "Theft", "Fraud").', sample: 'Suspected Homicide' },
      { name: 'brief', label: 'Brief', type: FieldType.TEXTAREA, required: true, help: 'The case setup.', meaning: 'The opening narration that frames the mystery — what happened, where, who had access. Do NOT reveal the culprit here.', sample: 'Chief Bankole was found dead in his locked study the morning after his retirement dinner. The coroner suspects poisoning. Four people had access that night. Name who is responsible.' },
      {
        name: 'suspects',
        label: 'Suspects',
        type: FieldType.OBJECT_ARRAY,
        required: true,
        minItems: 2,
        meaning: 'The cast who COULD be guilty — players accuse one. At least 2; exactly one is the culprit (solutionSuspectId).',
        samples: [
          { id: 's1', name: 'Tunde Bankole', age: 34, role: 'Son · heir', motive: 'The new will cut his stake.', alibi: 'Says he drove straight home; gate log shows his car leaving at 11:43pm.', alibiStatus: 'shaky', phone: '+234 802 551 0098', note: 'Calm, almost rehearsed.' },
          { id: 's3', name: 'Emeka Obi', age: 47, role: 'Business partner', motive: 'A debt the Chief called in dies with him.', alibi: 'Claims a Dubai call past midnight; no number produced.', alibiStatus: 'unchecked', phone: '+234 803 419 6620', note: 'Volunteered an alibi before being asked.' },
        ],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this suspect (e.g. "s1"). Referenced by solutionSuspectId + transcripts. Unique among suspects.', sample: 's1' },
          { name: 'name', label: 'Name', type: FieldType.TEXT, required: true, meaning: 'The suspect’s display name.', sample: 'Tunde Bankole' },
          { name: 'age', label: 'Age', type: FieldType.NUMBER, min: 0, default: 30, meaning: 'The suspect’s age.', sample: 34 },
          { name: 'role', label: 'Role', type: FieldType.TEXT, required: true, meaning: 'Their relationship to the case/victim (e.g. "Son · heir", "Housekeeper").', sample: 'Son · heir' },
          { name: 'motive', label: 'Motive', type: FieldType.TEXTAREA, required: true, meaning: 'Why they might have done it.', sample: 'The new will cut his stake from 60% to 20%.' },
          { name: 'alibi', label: 'Alibi', type: FieldType.TEXTAREA, required: true, meaning: 'Where they say they were, and any record that supports or contradicts it.', sample: 'Says he left at 11:40pm; gate log shows his car leaving at 11:43pm.' },
          { name: 'alibiStatus', label: 'Alibi status', type: FieldType.SELECT, options: ALIBI_STATUS_OPTIONS, default: 'unchecked', meaning: 'How the alibi holds up: confirmed / shaky / broken / unchecked.', sample: 'shaky' },
          { name: 'phone', label: 'Phone', type: FieldType.TEXT, meaning: 'Their phone number (used by the lookup tools). Optional.', sample: '+234 802 551 0098' },
          { name: 'note', label: 'Note', type: FieldType.TEXT, meaning: 'A short demeanour / first-impression line.', sample: 'Calm, almost rehearsed.' },
        ],
      },
      {
        name: 'reports',
        label: 'Forensic reports',
        type: FieldType.OBJECT_ARRAY,
        meaning: 'Forensic/autopsy/financial/digital reports. Each has a quick header (cause of death, time, items found…) and detailed findings; flag the real leads "key" and the misdirections "herring".',
        samples: [
          { id: 'r1', kind: 'autopsy', title: 'Autopsy Report', subtitle: 'Pathology Unit', header: [{ label: 'Cause of death', value: 'Poisoning' }], findings: [{ heading: 'Toxicology', detail: 'Oleandrin — brewed from oleander leaves, not pharmaceutical.', flag: 'key' }] },
        ],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this report (e.g. "r1"). Can be named as keyEvidenceId. Unique among reports.', sample: 'r1' },
          { name: 'kind', label: 'Kind', type: FieldType.SELECT, required: true, options: REPORT_KIND_OPTIONS, meaning: 'The report type: autopsy / forensic / financial / digital.', sample: 'autopsy' },
          { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'The report title.', sample: 'Autopsy Report — A. Bankole' },
          { name: 'subtitle', label: 'Subtitle', type: FieldType.TEXT, meaning: 'A small dateline/reference under the title.', sample: 'Lagos State Forensic Pathology Unit' },
          {
            name: 'header',
            label: 'Header fields',
            type: FieldType.OBJECT_ARRAY,
            meaning: 'The quick header facts (label/value pairs) — e.g. Cause of death, Time of death, Items found.',
            samples: [{ label: 'Cause of death', value: 'Cardiac arrest secondary to poisoning' }],
            fields: [
              { name: 'label', label: 'Label', type: FieldType.TEXT, required: true, meaning: 'The header fact’s label.', sample: 'Cause of death' },
              { name: 'value', label: 'Value', type: FieldType.TEXT, required: true, meaning: 'The header fact’s value.', sample: 'Cardiac arrest secondary to poisoning' },
            ],
          },
          {
            name: 'findings',
            label: 'Findings',
            type: FieldType.OBJECT_ARRAY,
            meaning: 'The detailed findings. Flag the genuine leads "key" and the deliberate misdirections "herring"; "none" is neutral.',
            samples: [{ heading: 'Toxicology', detail: 'Lethal oleandrin — brewed from oleander leaves, not pharmaceutical.', flag: 'key' }],
            fields: [
              { name: 'heading', label: 'Heading', type: FieldType.TEXT, required: true, meaning: 'The finding’s short heading.', sample: 'Toxicology' },
              { name: 'detail', label: 'Detail', type: FieldType.TEXTAREA, required: true, meaning: 'The finding’s full text.', sample: 'Lethal concentration of oleandrin in blood and gastric contents.' },
              { name: 'flag', label: 'Flag', type: FieldType.SELECT, options: FINDING_FLAG_OPTIONS, default: 'none', meaning: 'key = a real lead; herring = a deliberate misdirection; none = neutral.', sample: 'key' },
            ],
          },
        ],
      },
      {
        name: 'witnesses',
        label: 'Witnesses',
        type: FieldType.OBJECT_ARRAY,
        meaning: 'Witness statements. Mark each reliable / questionable / hostile — not every statement is trustworthy.',
        samples: [{ id: 'w1', name: 'Dr. Nwosu', relation: 'Family physician · dinner guest', statement: 'He toasted with the brandy at 11pm and seemed perfectly well.', reliability: 'reliable' }],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this witness (e.g. "w1"). Unique among witnesses.', sample: 'w1' },
          { name: 'name', label: 'Name', type: FieldType.TEXT, required: true, meaning: 'The witness’s name.', sample: 'Dr. Ifeoma Nwosu' },
          { name: 'relation', label: 'Relation', type: FieldType.TEXT, required: true, meaning: 'Their relation to the case.', sample: 'Family physician · dinner guest' },
          { name: 'statement', label: 'Statement', type: FieldType.TEXTAREA, required: true, meaning: 'Their quoted testimony.', sample: 'He toasted with the brandy at 11pm and seemed perfectly well.' },
          { name: 'reliability', label: 'Reliability', type: FieldType.SELECT, options: RELIABILITY_OPTIONS, default: 'reliable', meaning: 'How trustworthy: reliable / questionable / hostile.', sample: 'reliable' },
        ],
      },
      {
        name: 'transcripts',
        label: 'Interview transcripts',
        type: FieldType.OBJECT_ARRAY,
        meaning: 'Interrogation transcripts, one per suspect interviewed. Each is a back-and-forth of question (q) and answer (a) lines.',
        samples: [
          { id: 't1', suspectId: 's3', title: 'Interview — Emeka Obi', lines: [{ speaker: 'Det.', role: 'q', text: 'Whose number was the Dubai call?' }, { speaker: 'Emeka', role: 'a', text: 'A supplier. I will have to find the contact.' }] },
        ],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this transcript (e.g. "t1"). Unique among transcripts.', sample: 't1' },
          { name: 'suspectId', label: 'Suspect ID', type: FieldType.TEXT, required: true, meaning: 'The id of the suspect being interviewed — should match one of suspects[].id. (Plain text: nested references aren’t auto-validated.)', sample: 's3' },
          { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'The transcript title.', sample: 'Interview — Emeka Obi' },
          {
            name: 'lines',
            label: 'Lines',
            type: FieldType.OBJECT_ARRAY,
            meaning: 'The exchange — alternating questions (q) and answers (a).',
            samples: [{ speaker: 'Det.', role: 'q', text: 'Whose number was the Dubai call?' }],
            fields: [
              { name: 'speaker', label: 'Speaker', type: FieldType.TEXT, required: true, meaning: 'Who is speaking (e.g. "Det." or the suspect’s name).', sample: 'Det.' },
              { name: 'role', label: 'Role', type: FieldType.SELECT, required: true, options: LINE_ROLE_OPTIONS, meaning: 'q = the detective’s question; a = the suspect’s answer.', sample: 'q' },
              { name: 'text', label: 'Text', type: FieldType.TEXTAREA, required: true, meaning: 'The line of dialogue.', sample: 'Whose number was the Dubai call?' },
            ],
          },
        ],
      },
      {
        name: 'timeline',
        label: 'Timeline',
        type: FieldType.OBJECT_ARRAY,
        meaning: 'Timestamped events with their source. Mark conflict=true when an event contradicts an alibi/statement — those contradictions crack the case.',
        samples: [
          { time: '11:43', event: 'Tunde’s car leaves through the main gate.', source: 'Gate log', conflict: false },
          { time: '~11:50', event: 'Emeka says goodnight in the study; Chief alive.', source: 'Emeka (unverified)', conflict: true },
        ],
        fields: [
          { name: 'time', label: 'Time', type: FieldType.TEXT, required: true, meaning: 'The timestamp (e.g. "11:43", "~00:00").', sample: '11:43' },
          { name: 'event', label: 'Event', type: FieldType.TEXTAREA, required: true, meaning: 'What happened.', sample: 'Tunde’s car leaves through the main gate.' },
          { name: 'source', label: 'Source', type: FieldType.TEXT, meaning: 'Where this fact comes from.', sample: 'Gate log' },
          { name: 'conflict', label: 'Conflicts an alibi', type: FieldType.SELECT, options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }], default: 'false', meaning: 'true if this event contradicts a suspect’s alibi or a statement.', sample: 'false' },
        ],
      },
      {
        name: 'tools',
        label: 'Investigative tools',
        type: FieldType.OBJECT_ARRAY,
        meaning: 'The detective apps (Identity Lookup, Phone Records, Call Log, Cell Triangulation, Crime DB). Each tool has canned query results — some HIT, some PARTIAL, some DEAD-END (no result). Dead ends are the twist: they rule things out or mislead.',
        samples: [
          { id: 'tool-id', name: 'Identity Lookup', tagline: 'Pull a person’s record.', icon: 'identity', results: [{ query: 'Emeka Obi', outcome: 'hit', rows: [{ label: 'Horticulture permit', value: 'Active — ornamental nursery' }], note: 'He grows oleander.' }] },
        ],
        fields: [
          { name: 'id', label: 'ID', type: FieldType.TEXT, required: true, unique: true, meaning: 'A short unique id for this tool (e.g. "tool-id"). Unique among tools.', sample: 'tool-id' },
          { name: 'name', label: 'Name', type: FieldType.TEXT, required: true, meaning: 'The tool’s display name.', sample: 'Identity Lookup' },
          { name: 'tagline', label: 'Tagline', type: FieldType.TEXT, meaning: 'A one-line description of what the tool does.', sample: 'Pull a person’s record from the registry.' },
          { name: 'icon', label: 'Icon', type: FieldType.SELECT, required: true, options: TOOL_ICON_OPTIONS, meaning: 'Which tool this is (drives the icon + framing).', sample: 'identity' },
          {
            name: 'results',
            label: 'Results',
            type: FieldType.OBJECT_ARRAY,
            meaning: 'The canned query results. Each is a query the player can run; outcome hit / partial / dead_end.',
            samples: [{ query: 'Emeka Obi', outcome: 'hit', rows: [{ label: 'Horticulture permit', value: 'Active — ornamental nursery' }], note: 'He grows oleander.' }],
            fields: [
              { name: 'query', label: 'Query', type: FieldType.TEXT, required: true, meaning: 'The lookup the player runs (a name or number).', sample: 'Emeka Obi' },
              { name: 'outcome', label: 'Outcome', type: FieldType.SELECT, required: true, options: TOOL_OUTCOME_OPTIONS, meaning: 'hit = useful result; partial = some signal; dead_end = no result (the twist).', sample: 'hit' },
              {
                name: 'rows',
                label: 'Result rows',
                type: FieldType.OBJECT_ARRAY,
                meaning: 'The data the lookup returns (label/value pairs). Leave a single "No record found" row for a dead end.',
                samples: [{ label: 'Horticulture permit', value: 'Active — ornamental nursery, Epe' }],
                fields: [
                  { name: 'label', label: 'Label', type: FieldType.TEXT, required: true, meaning: 'The row’s label.', sample: 'Horticulture permit' },
                  { name: 'value', label: 'Value', type: FieldType.TEXT, required: true, meaning: 'The row’s value.', sample: 'Active — ornamental nursery, Epe' },
                ],
              },
              { name: 'note', label: 'Note', type: FieldType.TEXTAREA, meaning: 'A short interpretation shown under the result (what it implies).', sample: 'A nursery permit — he grows ornamentals, oleander among them.' },
            ],
          },
        ],
      },
      { name: 'solutionSuspectId', label: 'Guilty suspect ID', type: FieldType.TEXT, required: true, selfRef: { field: 'suspects', element: 'id' }, meaning: 'The id of the guilty suspect. MUST exactly equal one of suspects[].id. Server-only until reveal.', sample: 's3' },
      { name: 'keyEvidenceId', label: 'Key evidence ID', type: FieldType.TEXT, selfRef: { field: 'reports', element: 'id' }, meaning: 'The report id that proves the case — naming it on accusation earns a bonus. Should equal one of reports[].id. Server-only until reveal.', sample: 'r1' },
      { name: 'explanation', label: 'Explanation', type: FieldType.TEXTAREA, meaning: 'The reveal narrative — how the evidence proves the culprit. Shown only at the reveal.', sample: 'It was Emeka: the poison was oleander, his identity lookup shows a nursery permit, the Dubai alibi never happened, and triangulation puts him on-site through the time of death.' },
      difficulty,
      ratingTier,
      tags,
    ],
  },
  {
    kind: 'guess_the_word_pack',
    label: 'Guess The Word packs',
    titleField: 'title',
    description:
      'Guess The Word — a social voice game. Each round one player is the Guesser; the rest see the word and answer the guesser\'s questions out loud. The Guesser types their answer when ready and scores points based on time left × questions remaining. A pack is a themed set of words — one word per turn. Words may contain "?" as a blank/wildcard character (e.g. "b?nana" makes the guess harder).',
    fields: [
      { name: 'key', label: 'Key', type: FieldType.TEXT, required: true, unique: true, meaning: 'A stable, unique slug identifying this pack (lowercase-with-hyphens).', sample: 'everyday-objects-1' },
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: true, meaning: 'Human-readable pack name shown when a host selects this pack.', sample: 'Everyday Objects' },
      { name: 'category', label: 'Category', type: FieldType.TEXT, required: true, meaning: 'A free-text grouping label (e.g. "animals", "food", "places"). Used for organisation and optional host filtering.', sample: 'objects' },
      {
        name: 'words',
        label: 'Words',
        type: FieldType.STRING_ARRAY,
        required: true,
        meaning: 'The list of words for this pack — one word used per turn. Use only lowercase letters (no spaces). A "?" in a word acts as a wildcard blank the guesser must fill (e.g. "b?nana"). Include at least as many words as the expected max players so every player gets a unique word.',
        sample: ['umbrella', 'elephant', 'b?cycle', 'fireplace', 'telescope'],
      },
      ratingTier,
      tags,
    ],
  },
];

export const KIND_BY_ID: Readonly<Record<string, KindDescriptor>> = Object.fromEntries(
  KIND_DESCRIPTORS.map((d) => [d.kind, d]),
);

export const descriptorFor = (kind: string): KindDescriptor | undefined => KIND_BY_ID[kind];

import { Score } from '@gbedity/ui';

import { ControlKind, type ConfigGroup } from './config-schema.ts';
import type { GameContent } from './content-types.ts';
import {
  CategoryBadge,
  CheckinDots,
  HeroNumeral,
  McqOptions,
  PlayerInputMock,
  RankedGuesses,
  SubmissionFeed,
  TimerPill,
  VoteBars,
} from './content-primitives.tsx';
import { GameKey } from './games-manifest.ts';

// The per-game content registry (§§9–26). One entry per game; the universal shells render
// it. Sketch & Guess (#15) is intentionally absent (v2 deferral).
//
// Common config groups reused across the word games keep this DRY.

const roundGroup = (
  questionUnit: string,
  countDefault: number,
  timeDefault: number,
): ConfigGroup => ({
  label: 'Round',
  controls: [
    {
      kind: ControlKind.STEPPER,
      id: 'count',
      label: questionUnit,
      min: 1,
      max: 30,
      defaultValue: countDefault,
    },
    {
      kind: ControlKind.STEPPER,
      id: 'time',
      label: 'Time per round',
      min: 5,
      max: 120,
      defaultValue: timeDefault,
      unit: 's',
    },
  ],
});

const dupGroup: ConfigGroup = {
  label: 'Duplicates',
  controls: [
    {
      kind: ControlKind.PILLS,
      id: 'dup',
      label: 'Duplicate handling',
      options: ['Strict', 'Relaxed', 'Synonym-tolerant'],
      defaultValue: 'Strict',
    },
  ],
};

const ratingGroup: ConfigGroup = {
  label: 'Content rating',
  controls: [
    {
      kind: ControlKind.MULTI,
      id: 'rating',
      label: 'Rating',
      options: ['Family', 'Friends', 'Spicy', '18+'],
      defaultSelected: ['Family', 'Friends'],
    },
  ],
};

const customContent = (noun: string): ConfigGroup => ({
  label: 'Custom content',
  controls: [
    { kind: ControlKind.CUSTOM_CONTENT, id: 'custom', label: `Custom ${noun}`, noun },
  ],
});

// ---- MCQ-family content (Quizzes, Bible Quiz) ----
function mcqDisplay(question: string) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex w-full items-center justify-between">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">
          Q 4 / 10
        </span>
        <TimerPill value="0:14" />
      </div>
      <h2 className="font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">
        {question}
      </h2>
      <McqOptions
        options={[
          { letter: 'A', text: 'Lagos' },
          { letter: 'B', text: 'Abuja' },
          { letter: 'C', text: 'Kano' },
          { letter: 'D', text: 'Ibadan' },
        ]}
      />
      <CheckinDots total={4} filled={2} />
    </div>
  );
}

function mcqPlayer() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-[13px] font-bold text-ink-3">Question 4 of 10 · 0:14 left</p>
      <McqOptions
        options={[
          { letter: 'A', text: 'Lagos' },
          { letter: 'B', text: 'Abuja' },
          { letter: 'C', text: 'Kano' },
          { letter: 'D', text: 'Ibadan' },
        ]}
      />
    </div>
  );
}

function wordDisplay(letterOrWord: string, label: string, feed: readonly string[]) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="flex w-full items-center justify-between">
        <CategoryBadge>{label}</CategoryBadge>
        <TimerPill value="0:12" />
      </div>
      <HeroNumeral value={letterOrWord} tone="accent" />
      <SubmissionFeed items={feed} />
      <CheckinDots total={4} filled={3} />
    </div>
  );
}

const GAME_CONTENT: Partial<Record<GameKey, GameContent>> = {
  [GameKey.QUIZZES]: {
    key: GameKey.QUIZZES,
    configGroups: [
      roundGroup('Round count', 10, 20),
      {
        label: 'Difficulty & content',
        controls: [
          { kind: ControlKind.PILLS, id: 'difficulty', label: 'Difficulty', options: ['Easy', 'Mixed', 'Hard'], defaultValue: 'Mixed' },
          { kind: ControlKind.DROPDOWN, id: 'category', label: 'Content category', options: ['General', 'Nigerian', 'Pop Culture', 'History', 'Sports', 'Sciences', 'Custom'], defaultValue: 'General' },
        ],
      },
      {
        label: 'Scoring',
        controls: [
          { kind: ControlKind.PILLS, id: 'scoring', label: 'Scoring mode', options: ['Time-weighted', 'Flat', 'Custom'], defaultValue: 'Time-weighted' },
          { kind: ControlKind.PILLS, id: 'penalty', label: 'Wrong-answer penalty', options: ['Off', '−50%'], defaultValue: 'Off' },
          { kind: ControlKind.DROPDOWN, id: 'cadence', label: 'Leaderboard cadence', options: ['Every round', 'Every 5', 'Only at end'], defaultValue: 'Every round' },
        ],
      },
      customContent('questions'),
    ],
    previewLines: ['Estimated duration: ~8 min', 'Questions: 10', 'Top possible score: ~1,500'],
    renderDisplay: () => mcqDisplay('What is the capital of Nigeria?'),
    renderPlayer: mcqPlayer,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">
        Most accurate · Ada · 8/10 · Fastest correct · Tobi · avg 3.2s
      </p>
    ),
    postGameStats: [
      { label: 'Most accurate', value: 'Ada · 8/10' },
      { label: 'Fastest correct', value: 'Tobi · avg 3.2s' },
    ],
  },

  [GameKey.BIBLE_QUIZ]: {
    key: GameKey.BIBLE_QUIZ,
    configGroups: [
      roundGroup('Round count', 10, 25),
      {
        label: 'Content',
        controls: [
          { kind: ControlKind.PILLS, id: 'translation', label: 'Translation focus', options: ['Mixed', 'KJV', 'NIV', 'NLT', 'Yoruba', 'Igbo', 'Hausa'], defaultValue: 'Mixed' },
          { kind: ControlKind.PILLS, id: 'testament', label: 'Testament', options: ['Both', 'Old', 'New'], defaultValue: 'Both' },
          { kind: ControlKind.PILLS, id: 'difficulty', label: 'Difficulty', options: ['Mixed', 'Sunday School', 'Intermediate', 'Scholar'], defaultValue: 'Mixed' },
        ],
      },
      customContent('questions'),
    ],
    previewLines: ['Estimated duration: ~8 min', 'Questions: 10', 'Translation: Mixed'],
    renderDisplay: () => mcqDisplay('Who led Israel out of Egypt?'),
    renderPlayer: mcqPlayer,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Strongest book · Ada · Psalms (4 right)</p>
    ),
    postGameStats: [
      { label: 'Most accurate', value: 'Ada · 8/10' },
      { label: 'Strongest book', value: 'Ada · Psalms (4 right)' },
    ],
  },

  [GameKey.SPELLING_FAST]: {
    key: GameKey.SPELLING_FAST,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'count', label: 'Round count', min: 1, max: 30, defaultValue: 15 },
          { kind: ControlKind.STEPPER, id: 'time', label: 'Time per word', min: 5, max: 60, defaultValue: 15, unit: 's' },
          { kind: ControlKind.STEPPER, id: 'replays', label: 'Audio replays allowed', min: 0, max: 3, defaultValue: 1 },
        ],
      },
      {
        label: 'Difficulty & content',
        controls: [
          { kind: ControlKind.PILLS, id: 'difficulty', label: 'Difficulty', options: ['Beginner', 'Intermediate', 'Advanced', 'Spelling Bee'], defaultValue: 'Intermediate' },
          { kind: ControlKind.DROPDOWN, id: 'category', label: 'Word category', options: ['General', 'Nigerian English', 'Yoruba loanwords', 'Scientific', 'Geographic', 'Custom'], defaultValue: 'General' },
        ],
      },
      {
        label: 'Audio',
        controls: [
          { kind: ControlKind.DROPDOWN, id: 'voice', label: 'Voice', options: ['Nigerian English', 'British', 'American'], defaultValue: 'Nigerian English' },
        ],
      },
      {
        label: 'Anti-cheat',
        controls: [
          { kind: ControlKind.SWITCH, id: 'autocorrect', label: 'Allow autocorrect', help: 'Auto-corrected answers are disqualified.', defaultValue: false },
        ],
      },
    ],
    previewLines: ['Estimated duration: ~6 min', 'Words: 15', 'Voice: Nigerian English'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">
          Listen carefully
        </span>
        <span aria-hidden="true" className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-action-soft text-action-deep">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z" /></svg>
        </span>
        <p className="font-sans text-[14px] font-bold text-ink">Word 4 of 15</p>
        <TimerPill value="0:11" />
      </div>
    ),
    renderPlayer: () => (
      <PlayerInputMock placeholder="Type what you heard" helper="Autocorrect is OFF. Spell it exactly." />
    ),
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Trickiest word · “Onomatopoeia” (only 1 correct)</p>
    ),
    postGameStats: [{ label: 'Trickiest word', value: '“Onomatopoeia” · 1 correct' }],
  },

  [GameKey.TYPING_FAST]: {
    key: GameKey.TYPING_FAST,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'count', label: 'Passage count', min: 1, max: 12, defaultValue: 5 },
          { kind: ControlKind.STEPPER, id: 'time', label: 'Time per passage', min: 20, max: 180, defaultValue: 60, unit: 's' },
        ],
      },
      {
        label: 'Difficulty & content',
        controls: [
          { kind: ControlKind.PILLS, id: 'length', label: 'Passage length', options: ['Short', 'Medium', 'Long', 'Mixed'], defaultValue: 'Mixed' },
          { kind: ControlKind.DROPDOWN, id: 'source', label: 'Passage source', options: ['General English', 'Nigerian literature', 'Bible', 'Pidgin', 'Famous quotes', 'Custom'], defaultValue: 'General English' },
        ],
      },
      {
        label: 'Scoring',
        controls: [
          { kind: ControlKind.SLIDER, id: 'accuracy', label: 'Accuracy weight', leftLabel: 'Pure speed', rightLabel: 'Pure accuracy', defaultValue: 50 },
        ],
      },
    ],
    previewLines: ['Estimated duration: ~6 min', 'Passages: 5', 'Scoring: 50/50 speed·accuracy'],
    renderDisplay: () => (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">Type this passage</span>
          <TimerPill value="0:42" />
        </div>
        <p className="font-serif text-[24px] font-semibold leading-[1.3] text-ink">
          The rain in Jos falls softly on the plateau, cooling the evening market.
        </p>
        <div className="flex flex-col gap-2">
          {['Ada · 82%', 'Tobi · 64%', 'Funmi · 51%', 'Kemi · 38%'].map((p) => (
            <div key={p} className="h-[8px] overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-action" style={{ width: p.split('· ')[1] }} />
            </div>
          ))}
        </div>
      </div>
    ),
    renderPlayer: () => (
      <PlayerInputMock placeholder="Start typing the passage…" cta="Submit" helper="Matching letters turn green, mismatches red." />
    ),
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Fastest typist · Ada · 87 WPM · 98% accuracy</p>
    ),
    postGameStats: [{ label: 'Fastest typist', value: 'Ada · 87 WPM · 98%' }],
  },

  [GameKey.WORDSHOT]: {
    key: GameKey.WORDSHOT,
    configGroups: [
      roundGroup('Round count', 10, 15),
      {
        label: 'Categories',
        controls: [
          { kind: ControlKind.MULTI, id: 'cats', label: 'Enabled categories', options: ['Names', 'Foods', 'Cities', 'Countries', 'Animals', 'Movies', 'Yoruba foods', 'Nollywood', 'Naija slang', 'Custom'], defaultSelected: ['Names', 'Foods', 'Cities', 'Countries', 'Animals'] },
        ],
      },
      { label: 'Difficulty', controls: [{ kind: ControlKind.PILLS, id: 'letters', label: 'Letter difficulty', options: ['Common only', 'Includes Q-X-Z', 'Mixed'], defaultValue: 'Mixed' }] },
      dupGroup,
      ratingGroup,
    ],
    previewLines: ['Estimated duration: ~7 min', 'Rounds: 10', 'Categories enabled: 5'],
    renderDisplay: () => wordDisplay('A', 'Foods', ['amala', 'akara', 'apple']),
    renderPlayer: () => <PlayerInputMock placeholder="A word starting with A…" helper="Letter: A · Foods" />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Fastest fingers · Ada · 8/10 correct</p>
    ),
    postGameStats: [
      { label: '🎯 Sniper', value: 'Ada · most correct' },
      { label: '⚡ Speedster', value: 'Tobi · best avg time' },
    ],
  },

  [GameKey.WORD_BOMB]: {
    key: GameKey.WORD_BOMB,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.PILLS, id: 'rounds', label: 'Round count', options: ['Best of 1', 'Best of 3', 'Best of 5'], defaultValue: 'Best of 3' },
          { kind: ControlKind.STEPPER, id: 'bomb', label: 'Bomb start time', min: 3, max: 15, defaultValue: 7, unit: 's' },
          { kind: ControlKind.PILLS, id: 'decay', label: 'Bomb decay', options: ['Fixed', 'Decay'], defaultValue: 'Decay', help: '7→5→4 across rounds' },
        ],
      },
      { label: 'Categories', controls: [{ kind: ControlKind.MULTI, id: 'cats', label: 'Category mix', options: ['Foods', 'Animals', 'Cities', 'Names', 'Naija slang'], defaultSelected: ['Foods', 'Animals', 'Cities'] }] },
      { label: 'Difficulty', controls: [{ kind: ControlKind.PILLS, id: 'letters', label: 'Letter difficulty', options: ['Common only', 'Includes Q-X-Z', 'Mixed'], defaultValue: 'Mixed' }] },
      dupGroup,
    ],
    previewLines: ['Estimated duration: ~8 min', 'First bomb: 07s', 'Estimated words: ~60'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-4 text-center">
        <CategoryBadge>Foods · A</CategoryBadge>
        <HeroNumeral value="4" tone="danger" unit="s" />
        <p className="font-serif text-[24px] font-semibold text-ink">Tobi&apos;s turn</p>
        <div className="flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-canvas px-3 py-[6px] font-sans text-[13px] font-bold text-ink">amala</span>
          <span className="rounded-full bg-canvas px-3 py-[6px] font-sans text-[13px] font-bold text-ink">akara</span>
          <span className="rounded-full bg-canvas px-3 py-[6px] font-sans text-[13px] font-bold text-ink line-through opacity-60 [color:theme(colors.danger.DEFAULT)]">apple</span>
        </div>
      </div>
    ),
    renderPlayer: () => <PlayerInputMock placeholder="A food starting with A…" helper="It's your turn — go!" />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Longest hold · Ada · 6.2s average</p>
    ),
    postGameStats: [{ label: 'Longest hold', value: 'Ada · 6.2s avg' }],
  },

  [GameKey.SCRAMBLED_WORD]: {
    key: GameKey.SCRAMBLED_WORD,
    configGroups: [
      roundGroup('Word count', 10, 20),
      {
        label: 'Difficulty',
        controls: [
          { kind: ControlKind.PILLS, id: 'length', label: 'Word length range', options: ['5–8', '6–10', '8–12', 'Mixed'], defaultValue: '5–8' },
          { kind: ControlKind.PILLS, id: 'hint', label: 'Hint mode', options: ['None', 'First letter at half time', 'Progressive reveal'], defaultValue: 'None' },
        ],
      },
      { label: 'Display', controls: [{ kind: ControlKind.PILLS, id: 'rank', label: 'Ranking display count', options: ['Top 3', 'Top 5', 'Top 10'], defaultValue: 'Top 5' }] },
      { label: 'Scoring', controls: [{ kind: ControlKind.SLIDER, id: 'weight', label: 'Scoring weight', leftLabel: 'Speed', rightLabel: 'Closeness', defaultValue: 50 }] },
    ],
    previewLines: ['Estimated duration: ~7 min', 'Words: 10', 'Ranking: Top 5'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-5 text-center">
        <TimerPill value="0:16" />
        <p className="font-serif text-[44px] font-semibold tracking-[0.3em] text-ink">T O A M A</p>
        <span className="font-sans text-[12px] font-bold uppercase tracking-[0.08em] text-ink-3">Top 5 guesses · ranked live</span>
        <RankedGuesses guesses={[{ name: 'amala', pct: 98 }, { name: 'amale', pct: 76 }, { name: 'matao', pct: 41 }]} />
      </div>
    ),
    renderPlayer: () => <PlayerInputMock placeholder="Unscramble it…" helper="Re-submit anytime — best guess counts." />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Closest guesser · Ada · 100% match</p>
    ),
    postGameStats: [{ label: 'Closest guesser', value: 'Ada · 100% match' }],
  },

  [GameKey.MISSING_LETTERS]: {
    key: GameKey.MISSING_LETTERS,
    configGroups: [
      roundGroup('Word count', 10, 15),
      {
        label: 'Difficulty',
        controls: [
          { kind: ControlKind.PILLS, id: 'length', label: 'Word length range', options: ['5–8', '6–10', '8–12', 'Mixed'], defaultValue: '5–8' },
          { kind: ControlKind.STEPPER, id: 'hidden', label: 'Letters hidden', min: 1, max: 3, defaultValue: 2 },
          { kind: ControlKind.PILLS, id: 'hint', label: 'Hint mode', options: ['None', 'Reveal one at half time'], defaultValue: 'None' },
        ],
      },
    ],
    previewLines: ['Estimated duration: ~6 min', 'Words: 10', 'Hidden letters: 2'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-5 text-center">
        <TimerPill value="0:09" />
        <p className="font-serif text-[44px] font-semibold tracking-[0.2em] text-ink">B _ N _ N _</p>
        <CheckinDots total={4} filled={1} />
      </div>
    ),
    renderPlayer: () => <PlayerInputMock placeholder="Complete the word…" helper="B _ N _ N _" />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Fastest filler · Ada · avg 4.1s per word</p>
    ),
    postGameStats: [{ label: 'Fastest filler', value: 'Ada · 4.1s avg' }],
  },

  [GameKey.DEFINITION_RACE]: {
    key: GameKey.DEFINITION_RACE,
    configGroups: [
      roundGroup('Round count', 10, 20),
      { label: 'Difficulty', controls: [{ kind: ControlKind.PILLS, id: 'obscurity', label: 'Word obscurity', options: ['Common', 'Academic', 'Mixed'], defaultValue: 'Mixed' }] },
      { label: 'Display', controls: [{ kind: ControlKind.PILLS, id: 'rank', label: 'Ranking display count', options: ['Top 3', 'Top 5', 'Top 10'], defaultValue: 'Top 5' }] },
    ],
    previewLines: ['Estimated duration: ~7 min', 'Rounds: 10', 'Ranking: Top 5'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-5 text-center">
        <TimerPill value="0:13" />
        <p className="font-serif text-[24px] font-semibold italic leading-[1.3] text-ink">
          “A traditional Yoruba dish made from yam flour, served with stew.”
        </p>
        <RankedGuesses guesses={[{ name: 'amala', pct: 100 }, { name: 'eba', pct: 62 }]} />
      </div>
    ),
    renderPlayer: () => <PlayerInputMock placeholder="Name the word…" />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Sharpest vocab · Ada · 9/10 correct</p>
    ),
    postGameStats: [{ label: 'Sharpest vocab', value: 'Ada · 9/10' }],
  },

  [GameKey.SYNONYMS]: {
    key: GameKey.SYNONYMS,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'count', label: 'Round count', min: 1, max: 30, defaultValue: 10 },
          { kind: ControlKind.STEPPER, id: 'time', label: 'Time per round', min: 5, max: 60, defaultValue: 20, unit: 's' },
          { kind: ControlKind.STEPPER, id: 'required', label: 'Synonyms required per round', min: 1, max: 5, defaultValue: 1 },
        ],
      },
      { label: 'Difficulty', controls: [{ kind: ControlKind.PILLS, id: 'obscurity', label: 'Word obscurity', options: ['Common', 'Academic', 'Mixed'], defaultValue: 'Mixed' }] },
      dupGroup,
    ],
    previewLines: ['Estimated duration: ~6 min', 'Rounds: 10', 'Required per round: 1'],
    renderDisplay: () => wordDisplay('Happy', 'Synonyms', ['joyful', 'glad', 'elated ✨']),
    renderPlayer: () => <PlayerInputMock placeholder="A synonym…" helper="Rarer answers score higher." />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Widest vocabulary · Ada · 14 valid synonyms</p>
    ),
    postGameStats: [{ label: 'Widest vocabulary', value: 'Ada · 14 valid' }],
  },

  [GameKey.ANTONYMS]: {
    key: GameKey.ANTONYMS,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'count', label: 'Round count', min: 1, max: 30, defaultValue: 10 },
          { kind: ControlKind.STEPPER, id: 'time', label: 'Time per round', min: 5, max: 60, defaultValue: 20, unit: 's' },
          { kind: ControlKind.STEPPER, id: 'required', label: 'Antonyms required per round', min: 1, max: 5, defaultValue: 1 },
        ],
      },
      { label: 'Difficulty', controls: [{ kind: ControlKind.PILLS, id: 'obscurity', label: 'Word obscurity', options: ['Common', 'Academic', 'Mixed'], defaultValue: 'Mixed' }] },
      dupGroup,
    ],
    previewLines: ['Estimated duration: ~6 min', 'Rounds: 10', 'Required per round: 1'],
    renderDisplay: () => wordDisplay('Happy', 'Antonyms', ['sad', 'gloomy', 'morose ✨']),
    renderPlayer: () => <PlayerInputMock placeholder="An antonym…" helper="Rarer answers score higher." />,
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Widest range · Ada · 12 valid antonyms</p>
    ),
    postGameStats: [{ label: 'Widest range', value: 'Ada · 12 valid' }],
  },

  [GameKey.MILLIONAIRE]: {
    key: GameKey.MILLIONAIRE,
    configGroups: [
      { label: 'Mode', controls: [{ kind: ControlKind.PILLS, id: 'turn', label: 'Turn mode', options: ['Rotational', 'Solo-full-ladder', 'Lightning-buzzer'], defaultValue: 'Rotational' }] },
      {
        label: 'Game length',
        controls: [
          { kind: ControlKind.PILLS, id: 'length', label: 'Length mode', options: ['Time', 'Question count', 'Ladder'], defaultValue: 'Time' },
          { kind: ControlKind.STEPPER, id: 'gameTime', label: 'Time per game', min: 5, max: 30, defaultValue: 15, unit: 'm' },
          { kind: ControlKind.STEPPER, id: 'qTime', label: 'Time per question', min: 10, max: 90, defaultValue: 30, unit: 's' },
        ],
      },
      { label: 'Difficulty', controls: [{ kind: ControlKind.PILLS, id: 'curve', label: 'Difficulty curve', options: ['Standard', 'Flat', 'Easy', 'Hard'], defaultValue: 'Standard' }] },
      { label: 'Lifelines', controls: [{ kind: ControlKind.MULTI, id: 'lifelines', label: 'Lifelines', options: ['50/50', 'Ask the Audience', 'Phone a Friend'], defaultSelected: ['50/50', 'Ask the Audience', 'Phone a Friend'] }] },
      { label: 'Money', controls: [{ kind: ControlKind.PILLS, id: 'currency', label: 'Currency display', options: ['₦ ladder', '$ ladder', 'Points'], defaultValue: '₦ ladder' }] },
    ],
    previewLines: ['Estimated duration: 15 min', 'Lifelines active: 3', 'Top win: ₦10M'],
    renderDisplay: () => (
      <div className="flex gap-6">
        <div className="flex-1 flex flex-col gap-4">
          <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">Tobi in the seat</span>
          <h2 className="font-serif text-[26px] font-semibold leading-[1.15] text-ink">Which river is the longest in Nigeria?</h2>
          <McqOptions options={[{ letter: 'A', text: 'Niger' }, { letter: 'B', text: 'Benue' }, { letter: 'C', text: 'Kaduna' }, { letter: 'D', text: 'Ogun' }]} />
        </div>
        <div className="flex w-[120px] flex-col gap-1">
          {['₦10M', '₦5M', '₦1M', '₦500k', '₦100k', '₦50k', '₦10k', '₦1k'].map((rung, i) => (
            <div key={rung} className={`rounded-[10px] px-3 py-[6px] text-right font-serif text-[14px] font-semibold tabular-nums ${i === 2 ? 'bg-action text-white' : 'bg-canvas text-ink-3'}`}>{rung}</div>
          ))}
        </div>
      </div>
    ),
    renderPlayer: () => (
      <div className="flex flex-col gap-3">
        <McqOptions options={[{ letter: 'A', text: 'Niger' }, { letter: 'B', text: 'Benue' }, { letter: 'C', text: 'Kaduna' }, { letter: 'D', text: 'Ogun' }]} />
        <div className="flex gap-2">
          {['50/50', 'Audience', 'Phone'].map((l) => (
            <button key={l} type="button" className="flex-1 rounded-btn-sm bg-canvas py-2 font-sans text-[13px] font-bold text-ink hover:bg-canvas-deep">{l}</button>
          ))}
        </div>
      </div>
    ),
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Banker · Ada · ₦1,000,000 banked</p>
    ),
    postGameStats: [{ label: 'Banker', value: 'Ada · ₦1,000,000' }, { label: 'Rungs reached', value: 'Ada · 11 / 15' }],
  },

  [GameKey.TRUTH_OR_DARE]: {
    key: GameKey.TRUTH_OR_DARE,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'rounds', label: 'Round count', min: 1, max: 5, defaultValue: 2 },
          { kind: ControlKind.STEPPER, id: 'truthTime', label: 'Time per truth', min: 15, max: 120, defaultValue: 45, unit: 's' },
          { kind: ControlKind.STEPPER, id: 'dareTime', label: 'Time per dare', min: 30, max: 180, defaultValue: 90, unit: 's' },
        ],
      },
      { label: 'Voting', controls: [{ kind: ControlKind.PILLS, id: 'threshold', label: 'Voting threshold', options: ['Majority', 'Unanimous', 'Any one'], defaultValue: 'Majority' }] },
      ratingGroup,
      { label: 'Content tags', controls: [{ kind: ControlKind.MULTI, id: 'tags', label: 'Exclusions', options: ['Sexual', 'Religious', 'Political', 'Physical', 'Personal', 'Relationship'], defaultSelected: [] }] },
      { label: 'Skips', controls: [{ kind: ControlKind.STEPPER, id: 'skips', label: 'Skip allowance', min: 0, max: 5, defaultValue: 1 }] },
      customContent('prompts'),
    ],
    previewLines: ['Estimated duration: ~10 min', 'Rounds: 2', 'Skips: 1 per player'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="font-serif text-[24px] font-semibold text-ink">Tobi&apos;s turn</span>
        <div className="flex gap-3">
          <span className="rounded-card bg-action px-6 py-3 font-sans text-[15px] font-bold text-white">TRUTH</span>
          <span className="rounded-card bg-canvas px-6 py-3 font-sans text-[15px] font-bold text-ink-3">DARE</span>
        </div>
        <p className="font-serif text-[22px] font-semibold leading-[1.2] text-ink">What&apos;s a secret you&apos;ve never told the room?</p>
        <TimerPill value="0:38" />
      </div>
    ),
    renderPlayer: () => (
      <div className="flex gap-3">
        <button type="button" className="flex-1 rounded-card bg-action py-6 font-sans text-[18px] font-bold text-white">TRUTH</button>
        <button type="button" className="flex-1 rounded-card border-2 border-ink py-6 font-sans text-[18px] font-bold text-ink">DARE</button>
      </div>
    ),
    renderCelebration: () => (
      <div className="flex flex-col gap-2 text-center font-sans text-[14px] text-ink-3">
        <span>Best dare · Tobi · “Sing the national anthem in falsetto.”</span>
        <span>Best truth · Ada · “I once stole jollof from my aunt&apos;s pot.”</span>
      </div>
    ),
    postGameStats: [{ label: 'Best dare', value: 'Tobi' }, { label: 'Best truth', value: 'Ada' }],
  },

  [GameKey.CATCH_THE_LIE]: {
    key: GameKey.CATCH_THE_LIE,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'submit', label: 'Submission time', min: 60, max: 240, defaultValue: 120, unit: 's' },
          { kind: ControlKind.STEPPER, id: 'vote', label: 'Voting time per reveal', min: 15, max: 60, defaultValue: 30, unit: 's' },
        ],
      },
      { label: 'Theme', controls: [{ kind: ControlKind.PILLS, id: 'theme', label: 'Theme constraint', options: ['Open', 'Childhood', 'Travel', 'Work', 'Embarrassing', 'Custom'], defaultValue: 'Open' }] },
      { label: 'Scoring', controls: [{ kind: ControlKind.SLIDER, id: 'weight', label: 'Scoring weight', leftLabel: 'Correct guess', rightLabel: 'Fooling people', defaultValue: 50 }] },
    ],
    previewLines: ['Estimated duration: ~10 min', 'Submission: 120s', 'Voting: 30s'],
    renderDisplay: () => (
      <div className="flex flex-col gap-4">
        {['I once met Burna Boy at a bus stop', 'I can solve a Rubik’s cube in under a minute', 'I have never tasted Indomie'].map((s, i) => (
          <div key={s} className="flex items-center gap-3 rounded-card bg-canvas px-4 py-4">
            <span className="font-serif text-[20px] font-semibold text-ink-3">{i + 1}</span>
            <span className="font-serif text-[18px] font-semibold text-ink">{s}</span>
          </div>
        ))}
        <VoteBars rows={[{ label: 'Statement 1', pct: 25 }, { label: 'Statement 2', pct: 50 }, { label: 'Statement 3', pct: 25 }]} />
      </div>
    ),
    renderPlayer: () => (
      <div className="flex flex-col gap-3">
        <PlayerInputMock placeholder="Truth 1" cta="" />
      </div>
    ),
    renderCelebration: () => (
      <div className="flex flex-col gap-2 text-center font-sans text-[14px] text-ink-3">
        <span>Best deceiver · Tobi · fooled 4 of 5</span>
        <span>Sharpest eye · Ada · caught 5 lies</span>
      </div>
    ),
    postGameStats: [{ label: 'Best deceiver', value: 'Tobi · fooled 4/5' }, { label: 'Sharpest eye', value: 'Ada · 5 caught' }],
  },

  [GameKey.HOT_TAKE_COURT]: {
    key: GameKey.HOT_TAKE_COURT,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.STEPPER, id: 'prompts', label: 'Prompt count', min: 1, max: 12, defaultValue: 5 },
          { kind: ControlKind.STEPPER, id: 'submit', label: 'Submission time', min: 30, max: 120, defaultValue: 60, unit: 's' },
          { kind: ControlKind.STEPPER, id: 'vote', label: 'Voting time', min: 15, max: 90, defaultValue: 45, unit: 's' },
        ],
      },
      { label: 'Content', controls: [{ kind: ControlKind.DROPDOWN, id: 'category', label: 'Prompt category', options: ['Mixed Nigerian', 'Food debates', 'Lagos vs Abuja', 'Relationships', 'Pop Culture', 'Religion-lite', 'Custom'], defaultValue: 'Mixed Nigerian' }] },
      ratingGroup,
      { label: 'Bonus', controls: [{ kind: ControlKind.SWITCH, id: 'funniest', label: 'Funniest-defence bonus round', defaultValue: true }] },
    ],
    previewLines: ['Estimated duration: ~10 min', 'Prompts: 5', 'Bonus round: on'],
    renderDisplay: () => (
      <div className="flex flex-col gap-4">
        <h2 className="text-center font-serif text-[30px] font-semibold leading-[1.15] text-ink">“Jollof is overrated”</h2>
        <div className="flex flex-col gap-3">
          {['“Only if you’ve never had it party-style over firewood.”', '“Suya is the real MVP, change my mind.”'].map((d) => (
            <div key={d} className="flex items-center justify-between rounded-card bg-canvas px-4 py-3">
              <span className="font-serif text-[16px] font-semibold italic text-ink">{d}</span>
              <span className="font-sans text-[13px] font-bold text-ink-3">7</span>
            </div>
          ))}
        </div>
      </div>
    ),
    renderPlayer: () => <PlayerInputMock placeholder="Defend it in one sentence…" helper="180 characters max" />,
    renderCelebration: () => (
      <div className="flex flex-col gap-2 text-center font-sans text-[14px] text-ink-3">
        <span>Most convincing · Ada · “Suya is overrated unless made by a Hausa man over open flame.”</span>
        <span>Funniest · Tobi · “Jollof rivalries are how Nigerians do diplomacy.”</span>
      </div>
    ),
    postGameStats: [{ label: 'Most convincing', value: 'Ada' }, { label: 'Funniest', value: 'Tobi' }],
  },

  [GameKey.INVESTIGATION]: {
    key: GameKey.INVESTIGATION,
    configGroups: [
      { label: 'Case', controls: [{ kind: ControlKind.DROPDOWN, id: 'case', label: 'Case selection', options: ['The Catered Wedding', 'The Missing Ledger', 'The Estate Dispute', 'The Late Delivery', 'The Borrowed Car', 'The Office Theft'], defaultValue: 'The Catered Wedding' }] },
      { label: 'Time', controls: [{ kind: ControlKind.PILLS, id: 'duration', label: 'Case duration', options: ['15', '30', '45', '60'], defaultValue: '30' }] },
      {
        label: 'Difficulty',
        controls: [
          { kind: ControlKind.STEPPER, id: 'suspects', label: 'Number of suspects', min: 3, max: 6, defaultValue: 4 },
          { kind: ControlKind.PILLS, id: 'herring', label: 'Red herring intensity', options: ['Light', 'Medium', 'Heavy'], defaultValue: 'Medium' },
        ],
      },
      { label: 'Collaboration', controls: [{ kind: ControlKind.PILLS, id: 'comms', label: 'Communication mode', options: ['Solo', 'Allow notes'], defaultValue: 'Solo' }] },
    ],
    previewLines: ['Case: The Catered Wedding', 'Duration: 30 min', 'Suspects: 4 · Red herrings: Medium'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="font-serif text-[28px] font-semibold text-ink">The Catered Wedding · Suspected Poisoning</h2>
        <p className="max-w-[52ch] font-sans text-[15px] leading-[1.55] text-ink-3">
          Twelve guests fell ill after the reception. The caterer, the planner, the in-law, and the ex were all in the kitchen that afternoon.
        </p>
        <TimerPill value="18:42" />
        <span className="font-sans text-[13px] font-bold text-ink-3">Players investigating · 4</span>
      </div>
    ),
    renderPlayer: () => (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto">
          {['Case', 'Suspects', 'Evidence', 'Transcripts', 'My Notes'].map((t, i) => (
            <span key={t} className={`whitespace-nowrap rounded-full px-3 py-[6px] font-sans text-[12px] font-bold ${i === 0 ? 'bg-action text-white' : 'bg-canvas text-ink-3'}`}>{t}</span>
          ))}
        </div>
        <p className="font-sans text-[14px] leading-[1.55] text-ink-2">Read the case file, work the suspects, then make your accusation when the button unlocks.</p>
        <button type="button" className="rounded-btn bg-action py-3 font-sans text-[15px] font-bold text-white">Make accusation</button>
      </div>
    ),
    renderCelebration: () => (
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">The truth</span>
        <span className="font-serif text-[22px] font-semibold text-ink">It was the planner — the allergy note was forged.</span>
      </div>
    ),
    postGameStats: [{ label: 'Top detective', value: 'Ada · correct + fastest' }],
  },

  [GameKey.PLEAD_YOUR_CASE]: {
    key: GameKey.PLEAD_YOUR_CASE,
    configGroups: [
      {
        label: 'Round',
        controls: [
          { kind: ControlKind.PILLS, id: 'time', label: 'Argument time', options: ['3 min', '5 min', '10 min'], defaultValue: '5 min' },
          { kind: ControlKind.PILLS, id: 'severity', label: 'Charge severity', options: ['Minor', 'Mixed', 'Major'], defaultValue: 'Mixed' },
        ],
      },
      {
        label: 'AI evaluation',
        controls: [
          { kind: ControlKind.SLIDER, id: 'soundness', label: 'Legal soundness weight', leftLabel: '0', rightLabel: '100', defaultValue: 50 },
          { kind: ControlKind.SLIDER, id: 'persuasion', label: 'Persuasiveness weight', leftLabel: '0', rightLabel: '100', defaultValue: 30 },
          { kind: ControlKind.SLIDER, id: 'precedent', label: 'Use of precedent weight', leftLabel: '0', rightLabel: '100', defaultValue: 20 },
        ],
      },
      { label: 'Feedback', controls: [{ kind: ControlKind.SWITCH, id: 'feedback', label: 'Show AI feedback to losers', defaultValue: true }] },
      { label: 'Content', controls: [{ kind: ControlKind.DROPDOWN, id: 'case', label: 'Case selection', options: ['Contract Dispute', 'Property Line', 'Broken Promise', 'The Unpaid Tab'], defaultValue: 'Contract Dispute' }] },
      customContent('cases'),
    ],
    previewLines: ['Sample verdict: 84/100 · Acquitted', 'Soundness 50 · Persuasion 30 · Precedent 20', 'Feedback to losers: on'],
    renderDisplay: () => (
      <div className="flex flex-col gap-4">
        <span className="font-sans text-[13px] font-bold uppercase tracking-[0.08em] text-ink-3">Verdict pending</span>
        <h2 className="font-serif text-[24px] font-semibold text-ink">Contract Dispute · Clause 3.b breach</h2>
        <ul className="flex flex-col gap-1 font-sans text-[14px] text-ink-2">
          <li>· Defendant: Tobi Enterprises</li>
          <li>· Delivery was 6 days late</li>
          <li>· Clause 3.b allows a 5-day grace window</li>
        </ul>
        <CheckinDots total={4} filled={3} />
      </div>
    ),
    renderPlayer: () => (
      <div className="flex flex-col gap-3">
        <textarea placeholder="Write your defence…" rows={5} className="block w-full rounded-input border-2 border-mist-soft bg-surface px-4 py-3 font-sans text-[15px] text-ink placeholder:text-ink-4 focus:border-action focus:outline-none" />
        <button type="button" className="rounded-btn bg-action py-3 font-sans text-[15px] font-bold text-white">Submit defence</button>
      </div>
    ),
    renderCelebration: () => (
      <div className="flex flex-col gap-3">
        <div className="rounded-card bg-accent-soft px-4 py-3">
          <p className="font-serif text-[16px] font-semibold italic text-ink">“The grace window in 3.b is silent on force majeure; the flood voids the breach.”</p>
          <p className="mt-1 font-sans text-[12px] font-bold text-ink-3">Ada · 5 min · 1 precedent cited</p>
        </div>
        <div className="rounded-card bg-ink px-4 py-4 text-white">
          <p className="font-serif text-[28px] font-semibold">84/100 · Acquitted</p>
          <p className="mt-1 font-sans text-[13px] text-white/80">Sound reasoning, well-anchored to the cited precedent.</p>
        </div>
        <VoteBars rows={[{ label: 'Legal soundness · 44/50', pct: 88 }, { label: 'Persuasiveness · 25/30', pct: 83 }, { label: 'Precedent · 15/20', pct: 75 }]} />
      </div>
    ),
    postGameStats: [{ label: 'Verdict', value: 'Ada · 84/100 · Acquitted' }],
  },

  [GameKey.PRESENTATION]: {
    key: GameKey.PRESENTATION,
    configGroups: [
      { label: 'Round', controls: [{ kind: ControlKind.STEPPER, id: 'duration', label: 'Duration per player', min: 30, max: 180, defaultValue: 90, unit: 's' }] },
      {
        label: 'Topics',
        controls: [
          { kind: ControlKind.PILLS, id: 'category', label: 'Topic category', options: ['Nigerian debates', 'Pop culture', 'Philosophy', 'Spicy', 'Custom'], defaultValue: 'Nigerian debates' },
          { kind: ControlKind.SWITCH, id: 'reveal', label: 'Reveal topic early', help: 'On = topic shown 5s before; off = cold open', defaultValue: false },
        ],
      },
      { label: 'Rating', controls: [{ kind: ControlKind.MULTI, id: 'criteria', label: 'Rating criteria', options: ['Persuasiveness', 'Entertainment', 'Confidence'], defaultSelected: ['Persuasiveness', 'Entertainment', 'Confidence'] }] },
      {
        label: 'Bonus',
        controls: [
          { kind: ControlKind.SWITCH, id: 'heckle', label: 'Heckle questions allowed', defaultValue: true },
          { kind: ControlKind.SWITCH, id: 'favourite', label: 'Audience-favourite bonus', defaultValue: true },
        ],
      },
      ratingGroup,
    ],
    previewLines: ['Duration: 90s per player', 'Cold open: on', 'Criteria: 3 enabled'],
    renderDisplay: () => (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="font-serif text-[22px] font-semibold text-ink">Tobi is presenting</span>
        <p className="font-serif text-[30px] font-semibold leading-[1.15] text-ink">“Money makes love easier.”</p>
        <HeroNumeral value="0:48" tone="ink" />
      </div>
    ),
    renderPlayer: () => (
      <div className="flex flex-col gap-3">
        <p className="font-sans text-[14px] font-bold text-ink-3">Tobi is presenting — rate when they finish</p>
        {['Persuasiveness', 'Entertainment', 'Confidence'].map((c) => (
          <div key={c} className="flex items-center justify-between rounded-card bg-canvas px-4 py-3 opacity-60">
            <span className="font-sans text-[14px] font-semibold text-ink">{c}</span>
            <span className="font-sans text-[12px] text-ink-3">locked</span>
          </div>
        ))}
        <PlayerInputMock placeholder="Submit a heckle question…" cta="Send heckle" />
      </div>
    ),
    renderCelebration: () => (
      <p className="text-center font-sans text-[15px] text-ink-3">Best presenter · Ada · avg 4.7/5</p>
    ),
    postGameStats: [{ label: 'Best presenter', value: 'Ada · 4.7/5' }],
  },
};

export function getGameContent(key: GameKey): GameContent | undefined {
  return GAME_CONTENT[key];
}

export { GAME_CONTENT };

// Re-export Score for shells that show inline numbers without importing the lib directly.
export { Score };

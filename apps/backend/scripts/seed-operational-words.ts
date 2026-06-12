import { connectDb, closeDb } from '../src/db/client';
import { wordBankRepository, type PromoteWordInput, type PromoteDefinitionInput } from '../src/features/word-bank/word-bank.repository';
import { WordSource } from '../src/features/word-bank/word-bank.types';
import { COMMON_WORD_TIERS, SEED_DEFINITIONS } from './data/common-words';

// Seed the operational collections (game_words, game_definitions) with a curated common-word set.
// Idempotent (upsert by word). Difficulty is derived from length. Definition rows take their hand
// written definition; any seed word lacking one is topped up from the dictionary.
// Run: tsx --env-file=.env scripts/seed-operational-words.ts

const isClean = (w: string): boolean => /^[a-z]{2,}$/.test(w);

// Difficulty from length: ≤5 = easy(1), 6–7 = medium(2), ≥8 = hard(3).
const difficultyForLength = (len: number): number => (len <= 5 ? 1 : len <= 7 ? 2 : 3);

const main = async (): Promise<void> => {
  await connectDb();
  await wordBankRepository.ensureIndexes();

  // ── game_words ──────────────────────────────────────────────────────────────
  const wordByName = new Map<string, PromoteWordInput>();
  for (const tier of COMMON_WORD_TIERS) {
    for (const raw of tier.words) {
      const word = raw.trim().toLowerCase();
      if (!isClean(word)) continue;
      // Keep the highest rank if a word appears in multiple tiers.
      const existing = wordByName.get(word);
      if (existing === undefined || tier.rank > existing.rank) {
        wordByName.set(word, { word, rank: tier.rank, difficulty: difficultyForLength(word.length), source: WordSource.SEED });
      }
    }
  }
  // Top up toward ~1000 with real dictionary words (shorter words skew more common). These come in
  // at rank 2 — valid and usable, but below the hand-curated tiers in selection weight. Admins can
  // re-rank or remove them. Bias toward 4–8 letters (a fair spelling-game length).
  const TARGET_WORDS = 1000;
  if (wordByName.size < TARGET_WORDS) {
    const need = TARGET_WORDS - wordByName.size;
    // oversample to absorb dupes/collisions with the curated set
    const sampled = await wordBankRepository.sampleDictionary({ count: need * 2, minLen: 4, maxLen: 8 });
    for (const { word } of sampled) {
      if (wordByName.size >= TARGET_WORDS) break;
      if (wordByName.has(word) || !isClean(word)) continue;
      wordByName.set(word, { word, rank: 2, difficulty: difficultyForLength(word.length), source: WordSource.DICTIONARY });
    }
  }

  const wordInputs = [...wordByName.values()];
  const wordRes = await wordBankRepository.upsertWords(wordInputs);
  const curated = wordInputs.filter((w) => w.source === WordSource.SEED).length;
  console.log(`game_words: ${wordInputs.length} words (${curated} curated + ${wordInputs.length - curated} from dictionary) → ${wordRes.upserted} upserted`);

  // ── game_definitions ─────────────────────────────────────────────────────────
  const defByWord = new Map<string, PromoteDefinitionInput>();
  for (const d of SEED_DEFINITIONS) {
    const word = d.word.trim().toLowerCase();
    if (!isClean(word) || d.definition.trim() === '') continue;
    defByWord.set(word, { word, definition: d.definition.trim(), rank: d.rank, difficulty: difficultyForLength(word.length), source: WordSource.SEED });
  }

  // Top up definitions from the dictionary for the seeded words that don't have a hand-written one,
  // so Definition Race has a healthy starting pool. Aim for ~200 total.
  const TARGET_DEFS = 200;
  if (defByWord.size < TARGET_DEFS) {
    const seedWords = [...wordByName.keys()].filter((w) => !defByWord.has(w));
    const fromDict = await wordBankRepository.definitionsByWords(seedWords);
    for (const [word, definition] of fromDict) {
      if (defByWord.size >= TARGET_DEFS) break;
      if (defByWord.has(word) || definition.trim() === '') continue;
      const input = wordByName.get(word);
      defByWord.set(word, {
        word,
        definition: definition.trim(),
        rank: input?.rank ?? 3,
        difficulty: difficultyForLength(word.length),
        source: WordSource.DICTIONARY,
      });
    }
  }
  const defInputs = [...defByWord.values()];
  const defRes = await wordBankRepository.upsertDefinitions(defInputs);
  console.log(`game_definitions: ${defInputs.length} definitions → ${defRes.upserted} upserted`);

  await closeDb();
};

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });

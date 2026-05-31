# Seeds

Idempotent seed scripts. Run from `apps/backend` with the env loaded.

## Words + dictionary (from wordmaster)

```bash
# Small seed (default): 200 words/category × 14 categories + 5000 dictionary words.
npx tsx --env-file=.env src/seeds/words.seed.ts
```

### Full bulk movement (USER-RUN, when ready)

The small seed is enough to play/test. To move the **full** wordmaster dataset (all 14 categories,
~1.5M words incl. city/name/country), run the same script with higher caps:

```bash
# Full(ish) bulk — every category, large dictionary slice.
PER_CATEGORY=2000000 ALLWORDS=300000 npx tsx --env-file=.env src/seeds/words.seed.ts
```

Source defaults: `WORDMASTER_URL=mongodb://127.0.0.1:27017`, `WORDMASTER_DB=wordmaster`. Override if
the wordmaster DB lives elsewhere. The script upserts on `(word, category)` so re-runs are safe and
incremental. Every word is seeded `ratingTier: family` (Q2).

> Note: `city` (~1.03M) + `name` (~200k) dominate; expect the full run to take time and disk. The
> game works on the small seed in the meantime.

## Launch content (quiz deck, hot-takes, plead scenarios, rubric)

```bash
npx tsx --env-file=.env src/seeds/content.seed.ts
```

Small launch set (Q8/Q9). Admins add the rest via the content-authoring ports (admin §2.3).

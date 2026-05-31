// Posts Wave-2 datasets (definitions, thesaurus, truth/dare) into the running backend through the
// VALIDATED admin content-authoring API — not directly into Mongo. Idempotent-ish: re-running adds
// duplicates (the admin API doesn't dedupe), so run once.
//
// Usage (server must be running):
//   node src/seeds/post-content.mjs <adminEmail> <adminPassword> [baseUrl]

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [email, password, baseUrl = 'http://localhost:8090/api/v1'] = process.argv.slice(2);

if (!email || !password) {
  console.error('usage: node post-content.mjs <adminEmail> <adminPassword> [baseUrl]');
  process.exit(1);
}

const load = async (f) => JSON.parse(await readFile(join(here, 'data', f), 'utf8'));

const run = async () => {
  // 1. login for an admin token
  const loginRes = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const login = await loginRes.json();
  const token = login?.data?.accessToken;
  if (!token) {
    console.error('login failed:', JSON.stringify(login));
    process.exit(1);
  }

  const post = async (kind, body) => {
    const res = await fetch(`${baseUrl}/admin/content/${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.status;
  };

  const seedKind = async (kind, file, mapFn) => {
    const rows = await load(file);
    let ok = 0;
    let fail = 0;
    for (const row of rows) {
      const status = await post(kind, mapFn(row));
      if (status === 201) ok += 1;
      else fail += 1;
    }
    console.error(JSON.stringify({ kind, ok, fail, total: rows.length }));
  };

  await seedKind('definition', 'definitions.json', (d) => ({
    word: d.word,
    definition: d.definition,
    obscurity: d.obscurity ?? 'common',
    ratingTier: 'family',
    tags: [],
  }));

  await seedKind('thesaurus', 'thesaurus.json', (t) => ({
    word: t.word,
    synonyms: t.synonyms ?? [],
    antonyms: t.antonyms ?? [],
    obscurity: 'common',
    ratingTier: 'family',
    tags: [],
  }));

  await seedKind('truth_or_dare_prompt', 'truth-or-dare.json', (p) => ({
    kind: p.kind,
    prompt: p.prompt,
    ratingTier: 'family',
    tags: [],
  }));

  console.error('done');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Posts Wave-3 datasets via the BULK admin endpoint (POST /admin/content/:kind/bulk) — exercises
// the new mass-create side quest. Server must be running + an admin seeded.
//   node src/seeds/post-content-w3.mjs <adminEmail> <adminPassword> [baseUrl]

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const [email, password, baseUrl = 'http://localhost:8090/api/v1'] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node post-content-w3.mjs <adminEmail> <adminPassword> [baseUrl]');
  process.exit(1);
}

const load = async (f) => JSON.parse(await readFile(join(here, 'data', f), 'utf8'));

const run = async () => {
  const loginRes = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const token = (await loginRes.json())?.data?.accessToken;
  if (!token) {
    console.error('login failed');
    process.exit(1);
  }

  const bulk = async (kind, items) => {
    const res = await fetch(`${baseUrl}/admin/content/${kind}/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ items }),
    });
    const body = await res.json();
    console.error(JSON.stringify({ kind, status: res.status, result: body.data ?? body.error }));
  };

  await bulk('bible_quiz_deck', await load('bible-quiz.json'));
  await bulk('typing_passage', (await load('typing-passages.json')).map((p) => ({ ...p, ratingTier: 'family', tags: [] })));
  await bulk('presentation_topic', (await load('presentation-topics.json')).map((t) => ({ ...t, ratingTier: 'family', tags: [] })));
  await bulk('investigation_case', await load('investigation-cases.json'));

  console.error('done');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

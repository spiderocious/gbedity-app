// Drive wordshot through round→reveal→…→leaderboard to capture every phase's patch shape
// (quizzes content is unseeded; wordshot works and shares the phase model). Backend on :8090.

import { io } from 'socket.io-client';

const API = 'http://localhost:8090/api/v1';
const WS = 'http://localhost:8090';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

const seen = new Map();
const track = (label) => (p) => seen.set(`${label}:${p?.patch?.phase ?? 'lobby'}`, p);

const host = await post('/rooms', { nickname: 'Tobi' });
const code = host.code;
const players = [];
for (const n of ['Ada', 'Funmi', 'Kemi']) players.push(await post(`/rooms/${code}/players`, { nickname: n }));

const disp = io(WS, { transports: ['websocket'] });
disp.on('server.view', track('display'));
disp.on('connect', () => disp.emit('client.join', { roomCode: code, role: 'display' }));

const socks = players.map((pl) => {
  const s = io(WS, { transports: ['websocket'] });
  s.on('server.view', track('player'));
  s.on('connect', () => s.emit('client.join', { roomCode: code, role: 'player', playerId: pl.playerId, reconnectToken: pl.reconnectToken }));
  return s;
});
await sleep(700);
seen.set('display:LOBBY-PRE', { audience: 'display', patch: { phase: 'lobby' } }); // marker

await post(`/rooms/${code}/start`, { hostId: host.hostId, gameId: 'wordshot' });
await sleep(800);

const WORDS = ['india', 'italy', 'iran', 'iraq', 'israel', 'iceland'];
for (let r = 0; r < 12; r += 1) {
  socks.forEach((s, i) => s.emit('client.action', { action: { type: 'wordshot.submit', text: WORDS[(r + i) % WORDS.length] } }));
  await sleep(2200);
}
await sleep(5000);

console.log('=== captured phases ===');
for (const [k, v] of seen) {
  console.log(`\n--- ${k} ---`);
  console.log(JSON.stringify(v.patch, null, 2));
}
disp.close();
socks.forEach((s) => s.close());
process.exit(0);

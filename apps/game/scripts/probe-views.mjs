// Throwaway probe: capture real server.view patch shapes from the live backend so we can
// author exact typed schemas instead of guessing. Run: node apps/game/scripts/probe-views.mjs
// Requires the backend running on :8090. Not shipped; lives under scripts/.

import { io } from 'socket.io-client';

const API = 'http://localhost:8090/api/v1';
const WS = 'http://localhost:8090';
const GAMES = ['quizzes', 'wordshot', 'word_bomb', 'hot_take_court', 'plead_your_case'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

function connect(roomCode, role, opts = {}) {
  const sock = io(WS, { transports: ['websocket'] });
  const views = [];
  sock.on('connect', () => sock.emit('client.join', { roomCode, role, ...opts }));
  sock.on('server.view', (p) => views.push(p));
  sock.on('server.error', (e) => console.log(`  [${role}] server.error`, e));
  return { sock, views };
}

async function probeGame(gameId) {
  console.log(`\n================ ${gameId} ================`);
  const host = await post('/rooms', { nickname: 'Tobi' });
  const code = host.code;
  const players = [];
  for (const name of ['Ada', 'Funmi', 'Kemi']) {
    players.push(await post(`/rooms/${code}/players`, { nickname: name }));
  }

  const hostC = connect(code, 'host', { reconnectToken: host.hostToken });
  const dispC = connect(code, 'display');
  const playerC = connect(code, 'player', { playerId: players[0].playerId, reconnectToken: players[0].reconnectToken });
  await sleep(600);

  await post(`/rooms/${code}/start`, { hostId: host.hostId, gameId });
  await sleep(1500);

  const sample = (label, views) => {
    const last = views[views.length - 1];
    console.log(`  --- ${label} (${views.length} views) ---`);
    console.log(JSON.stringify(last, null, 2));
  };
  sample('DISPLAY', dispC.views);
  sample('HOST', hostC.views);
  sample('PLAYER', playerC.views);

  [hostC, dispC, playerC].forEach((c) => c.sock.close());
}

for (const g of GAMES) {
  try {
    await probeGame(g);
  } catch (e) {
    console.log(`  ${g} FAILED: ${e.message}`);
  }
}
process.exit(0);

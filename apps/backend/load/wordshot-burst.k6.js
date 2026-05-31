// k6 load test (PRD §14) — simulates a burst of players hammering the room HTTP edge, the closest
// HTTP proxy for the WS ingestion burst (the real WS burst is exercised by the engine's rate
// limiter + validation hot path). Run: k6 run load/wordshot-burst.k6.js
//
// Targets the create→join path under load; p95 < 400ms, <1% errors (the testing-doctrine targets).

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8090/api/v1';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp
    { duration: '1m', target: 50 }, // sustained
    { duration: '20s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  // create a room
  const create = http.post(`${BASE}/rooms`, JSON.stringify({ nickname: `Host${__VU}` }), {
    headers: { 'content-type': 'application/json' },
  });
  check(create, { 'room created': (r) => r.status === 201 });
  const code = create.json('data.code');

  if (code) {
    // a player joins
    const join = http.post(
      `${BASE}/rooms/${code}/players`,
      JSON.stringify({ nickname: `P${__VU}_${__ITER}` }),
      { headers: { 'content-type': 'application/json' } },
    );
    check(join, { 'player joined': (r) => r.status === 201 });

    // poll the lobby (read hot path)
    const lobby = http.get(`${BASE}/rooms/${code}`);
    check(lobby, { 'lobby ok': (r) => r.status === 200 });
  }

  sleep(1);
}

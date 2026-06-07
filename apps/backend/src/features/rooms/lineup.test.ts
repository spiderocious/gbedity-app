import request from 'supertest';

import { buildApp } from '../../app';
import { bootstrapEngine } from '../../engine';

// PUT /rooms/:code/lineup → the lineup appears in GET /rooms/:code for everyone (players/display).
// bootstrapEngine() so the test game ids resolve (the gateway normally does this; HTTP tests don't
// start the gateway).
describe('rooms lineup HTTP edge', () => {
  bootstrapEngine();
  const app = buildApp();

  async function makeRoom(): Promise<{ code: string; hostId: string }> {
    const res = await request(app).post('/api/v1/rooms').send({ nickname: 'Host' });
    return { code: res.body.data.code as string, hostId: res.body.data.hostId as string };
  }

  it('host publishes a lineup and it shows up in the lobby snapshot', async () => {
    const { code, hostId } = await makeRoom();

    const put = await request(app)
      .put(`/api/v1/rooms/${code}/lineup`)
      .send({
        hostId,
        lineup: [
          { gameId: 'test_round_robin', title: 'Word Bomb', facts: [{ label: 'Rounds', value: '5' }] },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.data.lineup).toHaveLength(1);

    const lobby = await request(app).get(`/api/v1/rooms/${code}`);
    expect(lobby.status).toBe(200);
    expect(lobby.body.data.lineup).toEqual([
      { gameId: 'test_round_robin', title: 'Word Bomb', facts: [{ label: 'Rounds', value: '5' }] },
    ]);
  });

  it('a fresh room has an empty lineup', async () => {
    const { code } = await makeRoom();
    const lobby = await request(app).get(`/api/v1/rooms/${code}`);
    expect(lobby.body.data.lineup).toEqual([]);
  });

  it('publishing again replaces the whole lineup (covers add / remove / reorder)', async () => {
    const { code, hostId } = await makeRoom();
    await request(app)
      .put(`/api/v1/rooms/${code}/lineup`)
      .send({ hostId, lineup: [{ gameId: 'test_round_robin', title: 'A', facts: [] }] });

    // Re-publish with a different set — simulates the host deleting A and adding B.
    const put2 = await request(app)
      .put(`/api/v1/rooms/${code}/lineup`)
      .send({ hostId, lineup: [{ gameId: 'test_simultaneous', title: 'B', facts: [] }] });
    expect(put2.status).toBe(200);

    const lobby = await request(app).get(`/api/v1/rooms/${code}`);
    expect(lobby.body.data.lineup).toEqual([{ gameId: 'test_simultaneous', title: 'B', facts: [] }]);
  });

  it('drops unknown game ids without failing the publish', async () => {
    const { code, hostId } = await makeRoom();
    const put = await request(app)
      .put(`/api/v1/rooms/${code}/lineup`)
      .send({
        hostId,
        lineup: [
          { gameId: 'not_a_real_game', title: 'Ghost', facts: [] },
          { gameId: 'test_round_robin', title: 'Real', facts: [] },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.data.lineup).toEqual([{ gameId: 'test_round_robin', title: 'Real', facts: [] }]);
  });

  it('rejects a non-host publisher with 403 not_host', async () => {
    const { code } = await makeRoom();
    const res = await request(app)
      .put(`/api/v1/rooms/${code}/lineup`)
      .send({ hostId: 'pl_imposter', lineup: [] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('not_host');
  });

  it('rejects an unknown room with 404 room_not_found', async () => {
    const res = await request(app)
      .put('/api/v1/rooms/ZZZZZZ/lineup')
      .send({ hostId: 'pl_x', lineup: [] });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('room_not_found');
  });

  it('422s when hostId is missing', async () => {
    const { code } = await makeRoom();
    const res = await request(app).put(`/api/v1/rooms/${code}/lineup`).send({ lineup: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('422s on an oversized fact value (length guard)', async () => {
    const { code, hostId } = await makeRoom();
    const res = await request(app)
      .put(`/api/v1/rooms/${code}/lineup`)
      .send({
        hostId,
        lineup: [{ gameId: 'test_round_robin', title: 'X', facts: [{ label: 'L', value: 'v'.repeat(500) }] }],
      });
    expect(res.status).toBe(422);
  });
});

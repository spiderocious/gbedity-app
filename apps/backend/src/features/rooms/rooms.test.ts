import request from 'supertest';

import { buildApp } from '../../app';

// Minimal smoke test — proves the room HTTP edge is wired (create → join). Not full coverage.
describe('rooms HTTP edge', () => {
  const app = buildApp();

  it('creates a room and a player can join it', async () => {
    const create = await request(app).post('/api/v1/rooms').send({ nickname: 'Host' });
    expect(create.status).toBe(201);
    const code = create.body.data.code as string;
    expect(code).toHaveLength(6);

    const join = await request(app).post(`/api/v1/rooms/${code}/players`).send({ nickname: 'Tobi' });
    expect(join.status).toBe(201);
    expect(join.body.data.playerId).toMatch(/^pl_/);
  });

  it('rejects joining an unknown room with the error envelope', async () => {
    const res = await request(app).post('/api/v1/rooms/ZZZZZZ/players').send({ nickname: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('room_not_found');
  });
});

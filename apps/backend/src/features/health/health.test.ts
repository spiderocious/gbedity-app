import request from 'supertest';

import { buildApp } from '../../app';

describe('GET /api/v1/health', () => {
  const app = buildApp();

  it('returns ok with the service name', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'gbedity-backend' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'not_found' });
  });
});

import request from 'supertest';
import { buildContext } from '../../adapters/config/context.js';
import { createApp } from './app.js';

describe('app express (L0)', () => {
  const app = createApp(buildContext());

  it('GET /salud responde 200 con envelope { data }', async () => {
    const res = await request(app).get('/salud');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.servicio).toBe('agroflete-api');
  });

  it('ruta inexistente responde 404 con envelope { error }', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

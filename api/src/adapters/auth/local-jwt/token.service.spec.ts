import jwt from 'jsonwebtoken';
import { makeLocalTokenService } from './token.service.js';

const SECRET = 'secreto-de-prueba-1234567890';

describe('local token service', () => {
  const tokens = makeLocalTokenService(SECRET, '8h');
  const claims = { sub: 'u1', email: 'a@b.co', role: 'productor' as const, name: 'Ana' };

  it('firma y verifica ida y vuelta', () => {
    const token = tokens.sign(claims);
    const out = tokens.verify(token);
    expect(out.sub).toBe('u1');
    expect(out.role).toBe('productor');
    expect(out.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rechaza un token manipulado', () => {
    const token = tokens.sign(claims) + 'x';
    expect(() => tokens.verify(token)).toThrow();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const ajeno = jwt.sign(claims, 'otro-secreto');
    expect(() => tokens.verify(ajeno)).toThrow();
  });

  it('rechaza un token expirado', () => {
    const expirado = jwt.sign(claims, SECRET, { expiresIn: -10 });
    expect(() => tokens.verify(expirado)).toThrow();
  });
});

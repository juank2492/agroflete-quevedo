import { bcryptHasher } from './password.hasher.js';

describe('bcrypt password hasher', () => {
  it('el hash no es el texto plano y compara correctamente', async () => {
    const hash = await bcryptHasher.hash('Secreta123');
    expect(hash).not.toBe('Secreta123');
    expect(await bcryptHasher.compare('Secreta123', hash)).toBe(true);
    expect(await bcryptHasher.compare('otra', hash)).toBe(false);
  }, 20_000); // bcryptjs (JS puro) a 12 rondas puede tardar en máquinas cargadas
});

import type { LugarGeocodificado } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ValidationError } from '../../domain/errors.js';
import { buscarLugares } from './buscar-lugares.js';

const RESULTADO: LugarGeocodificado[] = [
  {
    nombre: 'Parque La Familia',
    etiqueta: 'Quevedo',
    tipo: 'parque',
    lat: -1.02,
    lon: -79.46,
    distanciaKm: 1.2,
  },
];

function ctxCon(buscar: (q: string) => Promise<LugarGeocodificado[]>): AppContext {
  return { geocoding: { buscar } } as unknown as AppContext;
}

describe('buscarLugares', () => {
  it('delega en el puerto de geocodificación con el texto recortado', async () => {
    let recibido = '';
    const res = await buscarLugares(
      ctxCon(async (q) => {
        recibido = q;
        return RESULTADO;
      }),
      '  parque la familia  ',
    );
    expect(recibido).toBe('parque la familia');
    expect(res).toEqual(RESULTADO);
  });

  it('rechaza textos de menos de 3 caracteres', async () => {
    await expect(
      buscarLugares(
        ctxCon(async () => []),
        'ab',
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

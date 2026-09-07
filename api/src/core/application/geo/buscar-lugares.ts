import type { LugarGeocodificado } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';
import { ValidationError } from '../../domain/errors.js';

/** Busca lugares y aplica la longitud mínima del texto. */
export async function buscarLugares(ctx: AppContext, texto: string): Promise<LugarGeocodificado[]> {
  const q = texto.trim();
  if (q.length < 3) {
    throw new ValidationError('Escribe al menos 3 caracteres');
  }
  return ctx.geocoding.buscar(q);
}

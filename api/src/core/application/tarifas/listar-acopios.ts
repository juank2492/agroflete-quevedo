import type { Acopio } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';

export function listarAcopios(ctx: AppContext): Promise<Acopio[]> {
  return ctx.repos.acopios.listar();
}

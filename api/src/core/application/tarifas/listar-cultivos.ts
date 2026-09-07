import type { CultivoOpcion } from '@agroflete/shared';
import type { AppContext } from '../../app-context.js';

export async function listarCultivos(ctx: AppContext): Promise<CultivoOpcion[]> {
  const reglas = await ctx.repos.reglas.obtener();
  return reglas.cultivos
    .filter((c) => c.activo !== false)
    .map((c) => ({ clave: c.clave, nombre: c.nombre }));
}
